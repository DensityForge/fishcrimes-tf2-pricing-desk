/**
 * Fishcrimes system.
 * Pricing method: fishcrimes (YouTube and Discord @fishcrimes, Fishcrimes#1509).
 * Desk: donkeybrains. Contact: densityforge@gmail.com.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 */

/**
 * Fishcrimes seven — construct a price from classified sales.
 * Not Unique-6 search. Not hunt-api. Not a buy. Intel / later cash-SKU pricer.
 *
 * Steal method, not SKU. Tape-era numbers in tests are method proofs only.
 */
import fs from 'node:fs';
import path from 'node:path';

const SECRET_KEYS = new Set([
  'token',
  'tradeUrl',
  'trade_url',
  'url',
  'offersUrl',
  'offer_url',
  'tradeOfferUrl',
  'apikey',
  'apiKey',
]);

function publicize(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(publicize);
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SECRET_KEYS.has(key)) continue;
    out[key] = publicize(val);
  }
  return out;
}

export const IN_DATE_DAYS = 90;
export const IN_DATE_MS = IN_DATE_DAYS * 86_400_000;
export const UNBOX_HOLD_DAYS = 30;
export const UNBOX_HOLD_MS = UNBOX_HOLD_DAYS * 86_400_000;
export const CS2_MATURE_DAYS = 30;
export const CS2_MATURE_MS = CS2_MATURE_DAYS * 86_400_000;
export const MTF_ITEM_FEE = 0.1;

export const LAST_NAME = 'price-construct-last.json';

/** Listing / spoken ask ≥ this × kept high → DIG (Flog 86 vs 47). Named cut, not hunt-api. */
export const LISTING_OVER_RANGE = 1.5;

/** How to pick the point inside [low, high]. Clip suggestion uses range ends. */
export const AGGREGATE = Object.freeze({
  median: 'median',
  range_ends: 'range_ends',
});

export const DROP = Object.freeze({
  listing: 'listing_not_sale',
  withdrawn: 'withdrawn',
  bulk: 'bulk_unparseable',
  dupe: 'dupe',
  dupe_taint: 'dupe_taint',
  unboxer: 'unboxer_account',
  scm_unusual: 'scm_unusual',
  bot_dump: 'bot_dump_no_downstream',
  untraceable: 'untraceable',
  first_existence: 'before_first_existence',
  stale: 'out_of_window',
  unbox_week: 'unbox_week',
  last_seen: 'last_seen_not_sale',
  no_key: 'no_sale_day_key',
  missing_mini: 'missing_mini',
  cs2_immature: 'cs2_scm_immature',
  no_comps: 'no_comps',
  no_identity: 'no_identity',
  outlier: 'outlier',
  applied_skin_unsupported: 'applied_skin_unsupported',
  phantom_mark: 'phantom_mark',
});

/**
 * Research order (tape Process + seat skill). scanFlags is after, not a gate.
 * Identity is hold-if-unknown — not isPlainDecorated.
 */
export const SEVEN = Object.freeze([
  { n: 1, id: 'identity', hold: 'no_identity' },
  { n: 2, id: 'unbox_week', refuse: 'unbox_week' },
  { n: 3, id: 'in_date', note: '90d; last-seen not a sale; first-existence; CS2 ~30d; strange-unusual older ok' },
  { n: 4, id: 'classify', note: 'listings are not sales' },
  { n: 5, id: 'convert', note: 'sale-day median key; never round' },
  { n: 6, id: 'chain', note: 'mini each leg to pure/cash; sum; missing mini incomplete' },
  { n: 7, id: 'round_last', note: 'median default; range_ends clip; no round cash/pure terminals' },
]);

/** Seat said attrs unknown. Omitted identity still constructs (sheet assumes known). */
export function identityUnknown(input = {}) {
  if (input.no_identity === true || input.noIdentity === true) return true;
  const id = input.identity;
  if (id === null) return true;
  if (id && typeof id === 'object') {
    if (id.unknown === true || id.hold === true || id.known === false) return true;
  }
  return false;
}

function asMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Date.parse(value);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function dayKey(isoOrMs) {
  const ms = asMs(isoOrMs);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function nearest(n, step) {
  const r = Math.round(n / step) * step;
  const places = step >= 1 ? 0 : String(step).split('.')[1]?.length || 2;
  return Number(r.toFixed(places));
}

/**
 * Still dropping / under ~30 days post-event. Explicit `unboxUntil` wins.
 * Else `releasedAt` / `unboxedAt` / `eventAt` + UNBOX_HOLD_DAYS.
 * `stillDropping: false` is a named lift of the 30-day hold only.
 */
export function isUnboxWeek(unboxUntil, asOf, extra = {}) {
  const now = asMs(asOf);
  if (!Number.isFinite(now)) return false;
  const until = asMs(unboxUntil);
  if (Number.isFinite(until) && now < until) return true;
  if (extra.stillDropping === false || extra.still_dropping === false) return false;
  const event =
    extra.unboxedAt ?? extra.unboxed_at ?? extra.releasedAt ?? extra.released_at ?? extra.eventAt ?? extra.event_at;
  const ev = asMs(event);
  if (!Number.isFinite(ev)) return false;
  if (now < ev) return true;
  return now - ev < UNBOX_HOLD_MS;
}

/** next.backpack.tf last-seen is a scan stamp, not a sale. */
export function lastSeenIsSale(sale) {
  if (!sale || typeof sale !== 'object') return false;
  if (sale.at) return true;
  if (sale.lastSeen || sale.last_seen) return false;
  return false;
}

export function inDate(sale, asOf, opts = {}) {
  if (!sale || typeof sale !== 'object') {
    return { ok: false, reason: DROP.untraceable };
  }
  if (isUnboxWeek(opts.unboxUntil, asOf, opts)) {
    return { ok: false, reason: DROP.unbox_week };
  }
  const at = asMs(sale.at);
  const now = asMs(asOf);
  if (!Number.isFinite(at) || !Number.isFinite(now)) {
    return { ok: false, reason: sale.lastSeen || sale.last_seen ? DROP.last_seen : DROP.untraceable };
  }
  const first = asMs(opts.firstExistence ?? sale.firstExistence ?? sale.first_existence);
  if (Number.isFinite(first) && at < first) {
    return { ok: false, reason: DROP.first_existence };
  }
  if (sale.game === 'cs2') {
    const mature = asMs(sale.scmMatureAt ?? sale.scm_mature_at) || at + CS2_MATURE_MS;
    if (now < mature) return { ok: false, reason: DROP.cs2_immature };
  }
  if (opts.strangeUnusual || sale.strangeUnusual || sale.strange_unusual) {
    return { ok: true };
  }
  if (now - at > IN_DATE_MS) return { ok: false, reason: DROP.stale };
  return { ok: true };
}

export function classifySale(sale, ctx = {}) {
  if (!sale || typeof sale !== 'object') {
    return { keep: false, class: null, reason: DROP.untraceable };
  }
  if (!sale.at && (sale.lastSeen || sale.last_seen)) {
    return { keep: false, class: null, reason: DROP.last_seen };
  }
  if (sale.withdrawn) return { keep: false, class: null, reason: DROP.withdrawn };
  if (sale.duped) return { keep: false, class: null, reason: DROP.dupe };
  const owner = sale.owner || sale.steamid || sale.steamid64;
  if (owner && ctx.taintedOwners instanceof Set && ctx.taintedOwners.has(String(owner))) {
    return { keep: false, class: null, reason: DROP.dupe_taint };
  }
  if (sale.unboxer) return { keep: false, class: null, reason: DROP.unboxer };
  if (sale.untraceable) return { keep: false, class: null, reason: DROP.untraceable };
  if (sale.outlier) return { keep: false, class: null, reason: DROP.outlier };
  if (sale.kind === 'listing' || sale.transacted === false) {
    return { keep: false, class: null, reason: DROP.listing };
  }
  if (sale.kind === 'bulk' && sale.parseable !== true) {
    return { keep: false, class: null, reason: DROP.bulk };
  }
  if ((sale.kind === 'scm' || sale.venue === 'scm') && (sale.unusual || sale.quality === 5)) {
    return { keep: false, class: null, reason: DROP.scm_unusual };
  }
  if (sale.botDump && !sale.downstreamScan) {
    return { keep: false, class: null, reason: DROP.bot_dump };
  }
  if (sale.kind === 'marketplace' && sale.transacted !== true) {
    return { keep: false, class: null, reason: DROP.listing };
  }
  if (sale.kind === 'pure') return { keep: true, class: 'pure' };
  if (sale.kind === 'cash') return { keep: true, class: 'cash' };
  if (sale.kind === 'marketplace' && sale.transacted === true) {
    return { keep: true, class: 'marketplace' };
  }
  if (sale.kind === 'chain') return { keep: true, class: 'chain' };
  if (sale.kind === 'scm' && !sale.unusual) return { keep: true, class: 'scm' };
  return { keep: false, class: null, reason: DROP.untraceable };
}

export function keyMedianOnDay(keyOnDay, at) {
  if (typeof keyOnDay === 'function') {
    const v = Number(keyOnDay(at));
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  if (!keyOnDay || typeof keyOnDay !== 'object') return null;
  const day = dayKey(at);
  const direct = Number(keyOnDay[day] ?? keyOnDay[at]);
  if (Number.isFinite(direct) && direct > 0) return direct;
  return null;
}

/**
 * Convert a sale to keys. Never round here.
 * feeMode: buyer_paid (Fishcrimes suggestion) | seller_net (spbacon list).
 */
export function convertToKeys(sale, keyOnDay, opts = {}) {
  if (!sale || typeof sale !== 'object') {
    return { keys: null, unit: null, reason: DROP.untraceable };
  }
  if (sale.kind === 'chain') return sumChain(sale.legs || sale.minis || [], keyOnDay, opts);
  const rawKeys = sale.keys == null || sale.keys === '' ? NaN : Number(sale.keys);
  if (Number.isFinite(rawKeys) && sale.usd == null && sale.ref == null) {
    return { keys: rawKeys, unit: 'keys', reason: null };
  }
  const dayKeyPrice = keyMedianOnDay(keyOnDay, sale.at);
  if (sale.usd != null) {
    let usd = Number(sale.usd);
    if (!Number.isFinite(usd)) return { keys: null, unit: 'usd', reason: DROP.untraceable };
    if (!Number.isFinite(dayKeyPrice)) return { keys: null, unit: 'usd', reason: DROP.no_key };
    if (opts.feeMode === 'seller_net' && (sale.kind === 'marketplace' || sale.kind === 'cash')) {
      const fee = Number(opts.sellerFee);
      usd *= 1 - (Number.isFinite(fee) ? fee : MTF_ITEM_FEE);
    }
    return { keys: usd / dayKeyPrice, unit: 'usd', reason: null };
  }
  if (sale.ref != null) {
    const ref = Number(sale.ref);
    if (!Number.isFinite(ref)) return { keys: null, unit: 'ref', reason: DROP.untraceable };
    const refPerKey = keyMedianOnDay(opts.keyRefOnDay || opts.key_ref_on_day, sale.at);
    if (!Number.isFinite(refPerKey)) return { keys: null, unit: 'ref', reason: DROP.no_key };
    return { keys: ref / refPerKey, unit: 'ref', reason: null };
  }
  if (Number.isFinite(rawKeys)) return { keys: rawKeys, unit: 'keys', reason: null };
  return { keys: null, unit: null, reason: DROP.untraceable };
}

/** Mini each other item to a terminal, then sum. Nested chain recurses. Do not guess. */
export function sumChain(legs, keyOnDay, opts = {}) {
  if (!Array.isArray(legs) || !legs.length) {
    return { keys: null, unit: 'chain', reason: DROP.missing_mini };
  }
  let sum = 0;
  for (const leg of legs) {
    if (!leg || typeof leg !== 'object') {
      return { keys: null, unit: 'chain', reason: DROP.missing_mini };
    }
    const nested = Array.isArray(leg.legs) ? leg.legs : Array.isArray(leg.minis) ? leg.minis : null;
    const needsRecurse =
      leg.kind === 'chain' ||
      (nested && nested.length && (leg.keys == null || leg.keys === '') && leg.usd == null && leg.ref == null);
    if (needsRecurse) {
      const inner = sumChain(nested || [], keyOnDay, opts);
      if (inner.keys == null) return inner;
      sum += inner.keys;
      continue;
    }
    if ((leg.keys == null || leg.keys === '') && leg.usd == null && leg.ref == null) {
      return { keys: null, unit: 'chain', reason: DROP.missing_mini };
    }
    const conv = convertToKeys(leg, keyOnDay, opts);
    if (conv.keys == null) {
      return { keys: null, unit: 'chain', reason: conv.reason || DROP.missing_mini };
    }
    sum += conv.keys;
  }
  return { keys: sum, unit: 'chain', reason: null };
}

/**
 * Round last — never intermediates.
 * hatSale (item-to-item chain) → nearest 10.
 * cash/pure terminals → do not round.
 */
export function roundLast(keys, opts = {}) {
  const n = Number(keys);
  if (!Number.isFinite(n)) return null;
  if (opts.skipRound || opts.terminal) return n;
  if (opts.hatSale) return nearest(n, 10);
  if (n >= 1000) return nearest(n, 50);
  if (n > 10) return nearest(n, 1);
  return nearest(n, 0.05);
}

export function medianKeys(values) {
  const xs = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  if (xs.length % 2) return xs[mid];
  return (xs[mid - 1] + xs[mid]) / 2;
}

/** Midpoint of the kept range. Fishcrimes clip: (low + high) / 2, not median of interiors. */
export function rangeEndsKeys(low, high) {
  const a = Number(low);
  const b = Number(high);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (a + b) / 2;
}

export function resolveAggregate(value) {
  const s = String(value || '')
    .toLowerCase()
    .replace(/-/g, '_');
  return s === AGGREGATE.range_ends ? AGGREGATE.range_ends : AGGREGATE.median;
}

const WEAR_TITLE = /\((factory new|minimal wear|field-tested|well-worn|battle-scarred)\)/i;

/**
 * Scan-only: Unique applied skin without strange / unusual / KS / Halloween spell.
 * Not an identity gate. Spellbound is an effect — do not treat as a spell.
 */
export function isPlainDecorated(identity = {}, name = '') {
  const n = String(name || '');
  const wear =
    identity?.named?.wear_tier != null ||
    identity?.named?.texture_name != null ||
    WEAR_TITLE.test(n);
  if (!wear) return false;
  const q = Number(identity?.quality);
  const isStrange = q === 11 || /^\s*strange\b/i.test(n);
  const isUnusual = q === 5 || /^\s*unusual\b/i.test(n);
  const isKs = Number(identity?.named?.killstreak_tier || 0) > 0 || /\b(professional\s+)?killstreak\b/i.test(n);
  const extras = identity?.extras || [];
  const hasSpells =
    extras.some((e) => Array.isArray(e) && e[0] >= 1004 && e[0] <= 1009) || /\bhalloween spells?\b/i.test(n);
  return !isStrange && !isUnusual && !isKs && !hasSpells;
}

/**
 * Cheap flag pass. File-in. No HTTP. Never hunt-api.
 * DIG = Flog-style deep packet (not a catalog walk). HOLD = thin, last-seen, or no identity.
 * REFUSE = unbox-week or plain applied-skin trap. After the seven.
 */
export function scanFlags(input = {}) {
  const out = constructPrice(input);
  const flags = [];
  const dropped = Array.isArray(out.dropped) ? out.dropped : [];
  const reasons = dropped.map((d) => d.reason);
  const has = (r) => reasons.includes(r);

  if (out.reason === DROP.unbox_week) {
    flags.push({ flag: 'REFUSE', reason: DROP.unbox_week });
  } else if (out.reason === DROP.no_identity) {
    flags.push({ flag: 'HOLD', reason: DROP.no_identity });
  } else if (out.reason === DROP.no_comps) {
    flags.push({ flag: 'HOLD', reason: DROP.no_comps });
  }

  // Applied skin without strange/unusual/KS: value is bounded by unapplied war paint can
  const idObj = input.identity || out.identity;
  const nameStr = idObj?.name || input.name || input.market_hash_name || '';
  const isPlainDec = isPlainDecorated(idObj, nameStr);
  const listingAsk = Number(input.listingKeys ?? input.listing_keys ?? input.spokenAsk ?? input.spoken_ask ?? input.min_price);
  const volume90d = Number(input.volume_90d ?? input.volume ?? input.last_90_days?.volume);

  if (isPlainDec && listingAsk > 2.0 && (!out.ok || (out.n_used || 0) === 0 || volume90d === 0)) {
    flags.push({ flag: 'REFUSE', reason: DROP.applied_skin_unsupported });
  }

  if (has(DROP.outlier)) flags.push({ flag: 'DIG', reason: DROP.outlier });
  if (has(DROP.bot_dump)) flags.push({ flag: 'DIG', reason: DROP.bot_dump });
  if (has(DROP.last_seen)) flags.push({ flag: 'HOLD', reason: DROP.last_seen });
  if (has(DROP.untraceable) && (out.n_used || 0) < 2) {
    flags.push({ flag: 'HOLD', reason: DROP.untraceable });
  }

  const listing = Number(
    input.listingKeys ?? input.listing_keys ?? input.spokenAsk ?? input.spoken_ask,
  );
  const high = Number(out.high);
  if (Number.isFinite(listing) && listing > 0 && Number.isFinite(high) && high > 0) {
    if (listing >= high * LISTING_OVER_RANGE) {
      flags.push({
        flag: 'DIG',
        reason: 'listing_over_range',
        listing,
        high,
        ratio: listing / high,
      });
    }
  }

  const suggestion = out.range_ends ?? out.keys;
  const inflated = inflatedBuy(input.buyOrders ?? input.buy_orders, suggestion);
  if (inflated === true) {
    flags.push({ flag: 'DIG', reason: 'inflated_buy', intel: true });
  }

  const rank = { DIG: 3, REFUSE: 2, HOLD: 1, OK: 0 };
  const action = flags.reduce((best, f) => ((rank[f.flag] || 0) > (rank[best] || 0) ? f.flag : best), 'OK');

  return publicize({
    send: false,
    hunt_api: false,
    lane: 'comps',
    action,
    flags,
    n_used: out.n_used,
    n_dropped: dropped.length,
    keys: out.keys,
    low: out.low,
    high: out.high,
    range_ends: out.range_ends,
    median: out.median,
    reason: out.reason,
    identity: input.identity || out.identity || null,
  });
}

export function inflatedBuy(buyOrders, suggestion) {
  if (buyOrders == null || suggestion == null || buyOrders === '' || suggestion === '') return null;
  const bid = Number(buyOrders);
  const sug = Number(suggestion);
  if (!Number.isFinite(bid) || !Number.isFinite(sug) || sug <= 0) return null;
  return bid >= sug;
}

function taintedOwnersOf(sales) {
  const tainted = new Set();
  for (const sale of sales) {
    if (!sale?.duped) continue;
    const owner = sale.owner || sale.steamid || sale.steamid64;
    if (owner) tainted.add(String(owner));
  }
  return tainted;
}

function isCashOrPureClass(cls) {
  return cls === 'pure' || cls === 'cash' || cls === 'marketplace';
}

/**
 * Construct a price from already-classified sales + sale-day key medians.
 * Does not fetch HTTP. Does not search Unique-6. send is always false.
 */
export function constructPrice(input = {}) {
  const asOf = input.asOf || new Date().toISOString();
  const sales = Array.isArray(input.sales) ? input.sales : [];
  const keyOnDay = input.keyOnDay || input.key_on_day || {};
  const opts = {
    firstExistence: input.firstExistence ?? input.first_existence,
    unboxUntil: input.unboxUntil ?? input.unbox_until,
    unboxedAt: input.unboxedAt ?? input.unboxed_at,
    releasedAt: input.releasedAt ?? input.released_at,
    eventAt: input.eventAt ?? input.event_at,
    stillDropping: input.stillDropping ?? input.still_dropping,
    strangeUnusual: Boolean(input.strangeUnusual ?? input.strange_unusual),
    hatSale: Boolean(input.hatSale ?? input.hat_sale),
    feeMode: input.feeMode || input.fee_mode || 'buyer_paid',
    sellerFee: input.sellerFee ?? input.seller_fee,
    aggregate: resolveAggregate(input.aggregate),
    keyRefOnDay: input.keyRefOnDay || input.key_ref_on_day || {},
  };

  const refuse = (reason, extra = {}) =>
    publicize({
      ok: false,
      send: false,
      lane: 'comps',
      method: 'fishcrimes-seven',
      keys: null,
      low: null,
      high: null,
      rounded: null,
      used: extra.used || [],
      dropped: extra.dropped || [],
      reason,
      inflated: inflatedBuy(input.buyOrders ?? input.buy_orders, input.suggestion),
      n_sales: sales.length,
      n_used: extra.n_used ?? 0,
      identity: input.identity !== undefined ? input.identity : null,
    });

  if (identityUnknown(input)) return refuse(DROP.no_identity);
  if (isUnboxWeek(opts.unboxUntil, asOf, opts)) return refuse(DROP.unbox_week);

  const taintedOwners = taintedOwnersOf(sales);
  const used = [];
  const dropped = [];

  for (const sale of sales) {
    const id = sale?.id || sale?.at || null;
    const dated = inDate(sale, asOf, opts);
    if (!dated.ok) {
      dropped.push({ id, reason: dated.reason });
      continue;
    }
    const cls = classifySale(sale, { taintedOwners });
    if (!cls.keep) {
      dropped.push({ id, reason: cls.reason });
      continue;
    }
    const conv = convertToKeys(sale, keyOnDay, opts);
    if (conv.keys == null) {
      dropped.push({ id, reason: conv.reason || DROP.untraceable });
      continue;
    }
    used.push({
      id,
      class: cls.class,
      keys: conv.keys,
      unit: conv.unit,
      at: sale.at || null,
    });
  }

  if (!used.length) return refuse(DROP.no_comps, { used, dropped, n_used: 0 });

  const values = used.map((u) => u.keys);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const median = medianKeys(values);
  const ends = rangeEndsKeys(low, high);
  const mid = opts.aggregate === AGGREGATE.range_ends ? ends : median;
  const terminalsOnly = used.every((u) => isCashOrPureClass(u.class));
  const skipRound = terminalsOnly && !opts.hatSale;
  const rounded = roundLast(mid, {
    skipRound,
    hatSale: opts.hatSale,
  });
  const rangeOnly = used.length >= 2 && low !== high;

  return publicize({
    ok: true,
    send: false,
    lane: 'comps',
    method: 'fishcrimes-seven',
    keys: mid,
    low,
    high,
    rounded: skipRound ? mid : rounded,
    range_only: rangeOnly,
    used,
    dropped,
    reason: null,
    inflated: inflatedBuy(input.buyOrders ?? input.buy_orders, input.suggestion),
    n_sales: sales.length,
    n_used: used.length,
    identity: input.identity !== undefined ? input.identity : null,
    fee_mode: opts.feeMode,
    aggregate: opts.aggregate,
    median,
    range_ends: ends,
  });
}

export function lastPath(dir) {
  return path.join(dir || path.join(process.cwd(), 'files'), LAST_NAME);
}

export function writeLast(body, file = lastPath()) {
  const clean = publicize({
    ...body,
    send: false,
    ts: body?.ts || new Date().toISOString(),
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(clean, null, 2)}\n`);
  return clean;
}

export function readLast(file = lastPath()) {
  try {
    const row = JSON.parse(fs.readFileSync(file, 'utf8'));
    return row && typeof row === 'object' ? row : null;
  } catch {
    return null;
  }
}
