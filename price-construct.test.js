import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  CS2_MATURE_DAYS,
  DROP,
  IN_DATE_DAYS,
  SEVEN,
  UNBOX_HOLD_DAYS,
  classifySale,
  constructPrice,
  convertToKeys,
  identityUnknown,
  inflatedBuy,
  isPlainDecorated,
  isUnboxWeek,
  LISTING_OVER_RANGE,
  scanFlags,
  inDate,
  lastSeenIsSale,
  medianKeys,
  rangeEndsKeys,
  resolveAggregate,
  roundLast,
  sumChain,
  writeLast,
} from './price-construct.js';

const AS_OF = '2026-03-01T00:00:00.000Z';

test('in-date window is 90 days; strange-unusual keeps older', () => {
  const fresh = { at: '2026-01-15T00:00:00.000Z' };
  const stale = { at: '2025-11-01T00:00:00.000Z' };
  assert.equal(inDate(fresh, AS_OF).ok, true);
  assert.equal(inDate(stale, AS_OF).ok, false);
  assert.equal(inDate(stale, AS_OF).reason, DROP.stale);
  assert.equal(inDate(stale, AS_OF, { strangeUnusual: true }).ok, true);
  assert.equal(IN_DATE_DAYS, 90);
});

test('first-existence miss and unbox-week refuse', () => {
  const sale = { at: '2025-12-01T00:00:00.000Z' };
  assert.equal(inDate(sale, AS_OF, { firstExistence: '2026-01-01T00:00:00.000Z' }).reason, DROP.first_existence);
  assert.equal(inDate(sale, '2026-01-10T00:00:00.000Z', { unboxUntil: '2026-02-01T00:00:00.000Z' }).reason, DROP.unbox_week);
  assert.equal(UNBOX_HOLD_DAYS, 30);
});

test('CS2 SCM median must mature ~30 days', () => {
  const sale = { at: '2026-02-20T00:00:00.000Z', game: 'cs2' };
  assert.equal(inDate(sale, AS_OF).reason, DROP.cs2_immature);
  assert.equal(inDate({ ...sale, scmMatureAt: '2026-02-28T00:00:00.000Z' }, AS_OF).ok, true);
  assert.equal(CS2_MATURE_DAYS, 30);
});

test('last-seen is not a sale date', () => {
  assert.equal(lastSeenIsSale({ lastSeen: '2026-02-01T00:00:00.000Z' }), false);
  assert.equal(lastSeenIsSale({ at: '2026-02-01T00:00:00.000Z' }), true);
  assert.equal(classifySale({ lastSeen: '2026-02-01T00:00:00.000Z' }).reason, DROP.last_seen);
});

test('classify drops listings, withdrawn, bulk, dupe taint, unboxer, SCM unusual, bot dump', () => {
  assert.equal(classifySale({ kind: 'listing' }).reason, DROP.listing);
  assert.equal(classifySale({ kind: 'marketplace', transacted: false }).reason, DROP.listing);
  assert.equal(classifySale({ kind: 'cash', withdrawn: true }).reason, DROP.withdrawn);
  assert.equal(classifySale({ kind: 'bulk' }).reason, DROP.bulk);
  assert.equal(classifySale({ kind: 'pure', duped: true }).reason, DROP.dupe);
  assert.equal(
    classifySale({ kind: 'pure', owner: 'A' }, { taintedOwners: new Set(['A']) }).reason,
    DROP.dupe_taint,
  );
  assert.equal(classifySale({ kind: 'pure', unboxer: true }).reason, DROP.unboxer);
  assert.equal(classifySale({ kind: 'pure', untraceable: true }).reason, DROP.untraceable);
  assert.equal(classifySale({ kind: 'pure', keys: 86, outlier: true }).reason, DROP.outlier);
  assert.equal(classifySale({ kind: 'scm', unusual: true }).reason, DROP.scm_unusual);
  assert.equal(classifySale({ kind: 'pure', botDump: true }).reason, DROP.bot_dump);
  assert.equal(classifySale({ kind: 'pure', botDump: true, downstreamScan: true }).keep, true);
  assert.equal(classifySale({ kind: 'marketplace', transacted: true }).class, 'marketplace');
  assert.equal(classifySale({ kind: 'pure' }).class, 'pure');
});

test('convert uses sale-day key median; does not round; seller-net subtracts 10%', () => {
  const keyOnDay = { '2026-02-01': 1.9 };
  const cash = convertToKeys({ at: '2026-02-01T00:00:00.000Z', kind: 'cash', usd: 7.6 }, keyOnDay);
  assert.equal(cash.keys, 4);
  assert.equal(cash.unit, 'usd');
  const net = convertToKeys(
    { at: '2026-02-01T00:00:00.000Z', kind: 'marketplace', usd: 10, transacted: true },
    keyOnDay,
    { feeMode: 'seller_net' },
  );
  assert.equal(net.keys, 9 / 1.9);
  const missing = convertToKeys({ at: '2026-02-02T00:00:00.000Z', usd: 7.6 }, keyOnDay);
  assert.equal(missing.reason, DROP.no_key);
  const keys = convertToKeys({ kind: 'pure', keys: 3.54 });
  assert.equal(keys.keys, 3.54);
});

test('ref ÷ sale-day ref-per-key, not the dollar map', () => {
  const sale = { at: '2026-02-01T00:00:00.000Z', ref: 64.33 };
  const conv = convertToKeys(sale, { '2026-02-01': 1.8 }, { keyRefOnDay: { '2026-02-01': 64.33 } });
  assert.equal(conv.keys, 1);
  assert.equal(conv.unit, 'ref');
  const dollarOnly = convertToKeys(sale, { '2026-02-01': 64.33 });
  assert.equal(dollarOnly.keys, null);
  assert.equal(dollarOnly.reason, DROP.no_key);
});

test('chain without a mini is incomplete', () => {
  assert.equal(sumChain([{ keys: 10 }, { keys: null }]).reason, DROP.missing_mini);
  assert.equal(sumChain([{ keys: 10 }, { keys: 2.5 }]).keys, 12.5);
  assert.equal(convertToKeys({ kind: 'chain', legs: [{ keys: 5 }] }).keys, 5);
  assert.equal(convertToKeys({ kind: 'chain', legs: [{}] }).reason, DROP.missing_mini);
});

test('round last: 3.54 → 3.55; do not round cash/pure terminals; hat-sale → 10', () => {
  assert.equal(roundLast(3.54), 3.55);
  assert.equal(roundLast(6.02), 6);
  assert.equal(roundLast(26.4), 26);
  assert.equal(roundLast(26.4, { hatSale: true }), 30);
  assert.equal(roundLast(3850), 3850);
  assert.equal(roundLast(3870), 3850);
  assert.equal(roundLast(3.54, { skipRound: true }), 3.54);
  assert.equal(roundLast(3.54, { terminal: true }), 3.54);
});

test('median of two sales is the midpoint', () => {
  assert.equal(medianKeys([3, 5]), 4);
  assert.equal(medianKeys([1, 2, 3]), 2);
});

test('range_ends is midpoint of min/max, not median of interiors', () => {
  assert.equal(rangeEndsKeys(1, 10), 5.5);
  assert.equal(rangeEndsKeys(23.24, 30), (23.24 + 30) / 2);
  assert.equal(resolveAggregate('range-ends'), 'range_ends');
  assert.equal(resolveAggregate('median'), 'median');
  assert.equal(resolveAggregate('nope'), 'median');

  const three = constructPrice({
    asOf: AS_OF,
    aggregate: 'range_ends',
    sales: [
      { id: 'lo', at: '2026-01-15T00:00:00.000Z', kind: 'pure', keys: 1 },
      { id: 'mid', at: '2026-02-01T00:00:00.000Z', kind: 'pure', keys: 2 },
      { id: 'hi', at: '2026-02-10T00:00:00.000Z', kind: 'pure', keys: 10 },
    ],
  });
  assert.equal(three.ok, true);
  assert.equal(three.aggregate, 'range_ends');
  assert.equal(three.low, 1);
  assert.equal(three.high, 10);
  assert.equal(three.median, 2);
  assert.equal(three.range_ends, 5.5);
  assert.equal(three.keys, 5.5);

  const defaulted = constructPrice({
    asOf: AS_OF,
    sales: [
      { id: 'lo', at: '2026-01-15T00:00:00.000Z', kind: 'pure', keys: 1 },
      { id: 'mid', at: '2026-02-01T00:00:00.000Z', kind: 'pure', keys: 2 },
      { id: 'hi', at: '2026-02-10T00:00:00.000Z', kind: 'pure', keys: 10 },
    ],
  });
  assert.equal(defaulted.aggregate, 'median');
  assert.equal(defaulted.keys, 2);
  assert.equal(defaulted.range_ends, 5.5);
});

test('buy order at/above suggestion is inflated (intel flag, not a hunt filter)', () => {
  assert.equal(inflatedBuy(40, 40), true);
  assert.equal(inflatedBuy(39, 40), false);
  assert.equal(inflatedBuy(null, 40), null);
});

test('constructPrice: one pure sale is a point; two sales are a range', () => {
  const one = constructPrice({
    asOf: AS_OF,
    sales: [{ id: 'a', at: '2026-02-01T00:00:00.000Z', kind: 'pure', keys: 3.54 }],
  });
  assert.equal(one.ok, true);
  assert.equal(one.send, false);
  assert.equal(one.lane, 'comps');
  assert.equal(one.keys, 3.54);
  assert.equal(one.range_only, false);
  assert.equal(one.n_used, 1);

  const two = constructPrice({
    asOf: AS_OF,
    sales: [
      { id: 'a', at: '2026-01-15T00:00:00.000Z', kind: 'pure', keys: 3 },
      { id: 'b', at: '2026-02-01T00:00:00.000Z', kind: 'pure', keys: 5 },
    ],
  });
  assert.equal(two.ok, true);
  assert.equal(two.low, 3);
  assert.equal(two.high, 5);
  assert.equal(two.keys, 4);
  assert.equal(two.range_only, true);
  assert.equal(two.rounded, 4);
});

test('constructPrice drops listing and keeps transacted marketplace', () => {
  const out = constructPrice({
    asOf: AS_OF,
    keyOnDay: { '2026-02-01': 2 },
    sales: [
      { id: 'list', at: '2026-02-01T00:00:00.000Z', kind: 'marketplace', usd: 8, transacted: false },
      { id: 'sold', at: '2026-02-01T00:00:00.000Z', kind: 'marketplace', usd: 8, transacted: true },
    ],
  });
  assert.equal(out.ok, true);
  assert.equal(out.n_used, 1);
  assert.equal(out.keys, 4);
  assert.equal(out.dropped[0].reason, DROP.listing);
  assert.equal(out.fee_mode, 'buyer_paid');
});

test('dupe taints later sales from that owner', () => {
  const out = constructPrice({
    asOf: AS_OF,
    sales: [
      { id: 'bad', at: '2026-01-10T00:00:00.000Z', kind: 'pure', keys: 9, owner: 'X', duped: true },
      { id: 'later', at: '2026-02-01T00:00:00.000Z', kind: 'pure', keys: 10, owner: 'X' },
      { id: 'ok', at: '2026-02-10T00:00:00.000Z', kind: 'pure', keys: 11, owner: 'Y' },
    ],
  });
  assert.equal(out.n_used, 1);
  assert.equal(out.keys, 11);
  assert.deepEqual(
    out.dropped.map((d) => d.reason).sort(),
    [DROP.dupe, DROP.dupe_taint].sort(),
  );
});

test('unbox-week refuses the whole construct', () => {
  const out = constructPrice({
    asOf: '2026-01-10T00:00:00.000Z',
    unboxUntil: '2026-02-01T00:00:00.000Z',
    sales: [{ id: 'a', at: '2026-01-09T00:00:00.000Z', kind: 'pure', keys: 2 }],
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, DROP.unbox_week);
  assert.equal(out.send, false);
});

test('no usable comps → no_comps', () => {
  const out = constructPrice({
    asOf: AS_OF,
    sales: [{ id: 'old', at: '2024-01-01T00:00:00.000Z', kind: 'pure', keys: 12 }],
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, DROP.no_comps);
});

test('key-denominated unusual (not cash/pure-only) rounds last', () => {
  const out = constructPrice({
    asOf: AS_OF,
    hatSale: true,
    sales: [
      {
        id: 'chain',
        at: '2026-02-01T00:00:00.000Z',
        kind: 'chain',
        legs: [{ keys: 26 }, { keys: 4 }],
      },
    ],
  });
  assert.equal(out.ok, true);
  assert.equal(out.keys, 30);
  assert.equal(out.rounded, 30);
});

test('writeLast publicizes and forces send false', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'price-construct-'));
  const file = path.join(dir, 'last.json');
  const written = writeLast({ ok: true, send: true, token: 'SECRET', keys: 3 }, file);
  assert.equal(written.send, false);
  assert.equal(written.token, undefined);
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(disk.send, false);
  assert.equal(disk.token, undefined);
});

test('scanFlags DIG when listing is 1.5× kept high; never hunt-api', () => {
  const sales = [
    { id: 'lo', at: '2026-02-01T00:00:00.000Z', kind: 'pure', keys: 40 },
    { id: 'hi', at: '2026-02-10T00:00:00.000Z', kind: 'pure', keys: 47 },
    { id: 'rip', at: '2026-02-15T00:00:00.000Z', kind: 'marketplace', usd: 159.99, transacted: true, outlier: true },
  ];
  const dig = scanFlags({
    asOf: AS_OF,
    listingKeys: 86,
    sales,
  });
  assert.equal(dig.send, false);
  assert.equal(dig.hunt_api, false);
  assert.equal(dig.action, 'DIG');
  assert.equal(LISTING_OVER_RANGE, 1.5);
  assert.ok(dig.flags.some((f) => f.reason === 'listing_over_range'));
  assert.ok(dig.flags.some((f) => f.reason === DROP.outlier));

  const quiet = scanFlags({
    asOf: AS_OF,
    listingKeys: 48,
    sales: sales.filter((s) => s.id !== 'rip'),
  });
  assert.equal(quiet.action, 'OK');
});

test('does not invent a Unique-6 hunt or a send gate', () => {
  const out = constructPrice({
    asOf: AS_OF,
    sales: [{ id: 'a', at: '2026-02-01T00:00:00.000Z', kind: 'pure', keys: 1 }],
    buyOrders: 12,
    suggestion: 10,
  });
  assert.equal(out.send, false);
  assert.equal(out.lane, 'comps');
  assert.equal(out.inflated, true);
  assert.equal(Object.hasOwn(out, 'sku'), false);
});

test('scanFlags refuses plain decorated skin without comps (applied skin law)', () => {
  const scan = scanFlags({
    name: 'Skull Cracked Back Scratcher (Well-Worn)',
    listingKeys: 13.05,
    volume_90d: 0,
    sales: [],
    identity: {
      quality: 6,
      named: { wear_tier: 4, texture_name: 120, killstreak_tier: 0 },
    },
  });
  assert.equal(scan.action, 'REFUSE');
  assert.equal(scan.flags.some((f) => f.reason === DROP.applied_skin_unsupported), true);
});

test('SEVEN is research order: identity → unbox → in-date → classify → convert → chain → round last', () => {
  assert.equal(SEVEN.length, 7);
  assert.deepEqual(
    SEVEN.map((s) => s.id),
    ['identity', 'unbox_week', 'in_date', 'classify', 'convert', 'chain', 'round_last'],
  );
});

test('identity unknown holds the construct; omitted identity still prices', () => {
  assert.equal(identityUnknown({ identity: { unknown: true } }), true);
  assert.equal(identityUnknown({ identity: { hold: true } }), true);
  assert.equal(identityUnknown({ identity: null }), true);
  assert.equal(identityUnknown({}), false);
  const held = constructPrice({
    asOf: AS_OF,
    identity: { unknown: true },
    sales: [{ id: 'a', at: '2026-02-01T00:00:00.000Z', kind: 'pure', keys: 3 }],
  });
  assert.equal(held.ok, false);
  assert.equal(held.reason, DROP.no_identity);
  assert.equal(held.send, false);
  assert.equal(held.method, 'fishcrimes-seven');
  const scan = scanFlags({
    asOf: AS_OF,
    identity: { known: false },
    sales: [{ id: 'a', at: '2026-02-01T00:00:00.000Z', kind: 'pure', keys: 3 }],
  });
  assert.equal(scan.action, 'HOLD');
  assert.ok(scan.flags.some((f) => f.reason === DROP.no_identity));
});

test('unbox-week also refuses releasedAt within 30 days unless stillDropping is false', () => {
  assert.equal(isUnboxWeek(null, '2026-01-20T00:00:00.000Z', { releasedAt: '2026-01-01T00:00:00.000Z' }), true);
  assert.equal(isUnboxWeek(null, '2026-03-01T00:00:00.000Z', { releasedAt: '2026-01-01T00:00:00.000Z' }), false);
  assert.equal(
    isUnboxWeek(null, '2026-01-20T00:00:00.000Z', { releasedAt: '2026-01-01T00:00:00.000Z', stillDropping: false }),
    false,
  );
  const out = constructPrice({
    asOf: '2026-01-20T00:00:00.000Z',
    releasedAt: '2026-01-01T00:00:00.000Z',
    sales: [{ id: 'a', at: '2026-01-15T00:00:00.000Z', kind: 'pure', keys: 2 }],
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, DROP.unbox_week);
});

test('chain minis recurse: cash leg converts on sale day; nested chain sums; missing mini incomplete', () => {
  const keyOnDay = { '2026-02-01': 2 };
  const cash = sumChain(
    [
      { keys: 10 },
      { kind: 'cash', usd: 8, at: '2026-02-01T00:00:00.000Z' },
    ],
    keyOnDay,
  );
  assert.equal(cash.keys, 14);
  const nested = convertToKeys(
    {
      kind: 'chain',
      legs: [{ keys: 3 }, { kind: 'chain', legs: [{ keys: 1 }, { keys: 1 }] }],
    },
    keyOnDay,
  );
  assert.equal(nested.keys, 5);
  assert.equal(sumChain([{ keys: 4 }, { usd: 8, at: '2026-02-02T00:00:00.000Z' }], keyOnDay).reason, DROP.no_key);
});

test('isPlainDecorated is scan-only; Spellbound is an effect not a Halloween spell', () => {
  assert.equal(
    isPlainDecorated({ quality: 6, named: { wear_tier: 4, texture_name: 1, killstreak_tier: 0 } }, 'Foo (Field-Tested)'),
    true,
  );
  assert.equal(
    isPlainDecorated({ quality: 5, named: { wear_tier: 3 } }, 'Unusual Spellbound Foo (Field-Tested)'),
    false,
  );
  assert.equal(isPlainDecorated({ quality: 6 }, 'Spellbound Foo (Field-Tested)'), true);
  assert.equal(isPlainDecorated({ quality: 11, named: { wear_tier: 2 } }, 'Strange Foo (Well-Worn)'), false);
});
