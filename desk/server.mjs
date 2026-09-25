/**
 * Fishcrimes system. Local item desk. 127.0.0.1 only.
 * Pricing method: fishcrimes (YouTube and Discord @fishcrimes, Fishcrimes#1509).
 * Desk: donkeybrains. Contact: densityforge@gmail.com.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 * Does not write a last-result file. Does not post a suggestion.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { constructPrice, scanFlags } from '../price-construct.js';
import { loadCatalogueIndex, suggestNames } from './name-index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export function sampleFile(base = here) {
  const beside = path.join(base, 'sample.sales.json');
  if (fs.existsSync(beside)) return beside;
  return path.join(base, '..', 'sample.sales.json');
}

const SLUG = /^[a-z0-9-]+$/;
const MAX_BODY = 1_000_000;

function sendJson(res, code, body) {
  const raw = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(raw),
  });
  res.end(raw);
}

function sendBytes(res, code, raw, type) {
  res.writeHead(code, {
    'content-type': type,
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(raw),
  });
  res.end(raw);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('too_large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function itemsDirOf(root) {
  return path.join(path.resolve(root), 'items');
}

/**
 * Packed desk lives in desk/server.mjs. Sheets and the sample sit beside desk/, not inside it.
 * The repo copy sits beside items/ and sample.sales.json, so that folder stays the root.
 */
export function resolveDeskRoot(serverDir, { exists = fs.existsSync } = {}) {
  const dir = path.resolve(serverDir);
  const parent = path.resolve(dir, '..');
  const packed = path.basename(dir) === 'desk'
    && exists(path.join(parent, 'items'))
    && exists(path.join(parent, 'sample.sales.json'));
  return packed ? parent : dir;
}

function itemFile(itemsDir, slug) {
  if (!SLUG.test(slug)) return null;
  let base = itemsDir;
  try {
    base = fs.realpathSync(itemsDir);
  } catch {
    return null;
  }
  const file = path.resolve(base, `${slug}.sales.json`);
  const rel = path.relative(base, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return file;
}

function parseSheet(text) {
  let sheet;
  try {
    sheet = JSON.parse(text);
  } catch {
    return null;
  }
  if (!sheet || typeof sheet !== 'object' || Array.isArray(sheet)) return null;
  return sheet;
}

function listItems(itemsDir) {
  let names = [];
  try {
    names = fs.readdirSync(itemsDir);
  } catch {
    return [];
  }
  const rows = [];
  for (const name of names) {
    if (!name.endsWith('.sales.json')) continue;
    const slug = name.slice(0, -'.sales.json'.length);
    const file = itemFile(itemsDir, slug);
    if (!file) continue;
    const saved = fs.statSync(file).mtime.toISOString();
    let sheet;
    try {
      sheet = parseSheet(fs.readFileSync(file, 'utf8'));
    } catch {
      sheet = null;
    }
    if (!sheet) {
      rows.push({ slug, error: 'bad_json', saved });
      continue;
    }
    const price = constructPrice(sheet);
    const scan = scanFlags(sheet);
    const id = sheet.identity;
    const named = id && typeof id === 'object' ? id : null;
    rows.push({
      slug,
      name: named?.name || null,
      effect: named?.effect || null,
      held: sheet.identity == null,
      status: scan.action,
      reason: price.reason,
      low: price.ok ? price.low : null,
      high: price.ok ? price.high : null,
      dated: Array.isArray(sheet.historyMoves) ? sheet.historyMoves.filter((move) => move.at).length : 0,
      stage2: sheet.stage2 === 'done',
      saved,
    });
    if (sheet.searchNote) rows[rows.length - 1].reason = sheet.searchNote;
  }
  rows.sort((a, b) => a.slug.localeCompare(b.slug));
  return rows;
}

function requestPath(req) {
  return (req.url || '/').split('?')[0];
}

async function searchPayload(req, itemsDir, searches) {
  if (req.method === 'GET') {
    let queue;
    try {
      queue = await searches.ready();
    } catch {
      return { status: 200, payload: { ok: false, reason: 'no_history_pull', jobs: [] } };
    }
    return { status: 200, payload: { jobs: queue.list() } };
  }
  const body = parseSheet(await readBody(req));
  if (!body) return { status: 400, payload: { error: 'bad_json' } };
  if (body.stage === 2) {
    const slug = String(body.slug || '');
    if (!/^[a-z0-9-]+$/.test(slug)) return { status: 400, payload: { error: 'bad_slug' } };
    const file = itemFile(itemsDir, slug);
    if (!file || !fs.existsSync(file)) return { status: 404, payload: { error: 'no_sheet' } };
  }
  let queue;
  try {
    queue = await searches.ready();
  } catch {
    return { status: 200, payload: { ok: false, reason: 'no_history_pull', jobs: [] } };
  }
  const mod = await import('./search.mjs');
  if (body.stage === 2) {
    const job = queue.enqueue({ stage: 2, slug: String(body.slug || ''), name: String(body.slug || '') });
    return { status: 200, payload: { ok: true, job } };
  }
  const spec = mod.checkSearch(body);
  if (!spec.ok) return { status: 400, payload: { error: spec.reason } };
  const job = queue.enqueue(spec);
  return { status: 200, payload: { ok: true, job } };
}

async function historyPayload(body, pull) {
  if (!body) return { status: 400, payload: { error: 'bad_json' } };
  if (typeof body.html === 'string') {
    if (!pull.allowHtml) return { status: 400, payload: { error: 'html_refused' } };
    const hops = (await import('./history.mjs')).hopsFromHtml(body.html);
    const moves = (await import('./history.mjs')).saleClocks(hops);
    if (!hops.length) return { status: 200, payload: { ok: false, reason: 'no_hops', moves: [] } };
    return { status: 200, payload: { ok: true, via: 'html', moves } };
  }
  const pageID = String(body.pageID || '').trim();
  if (!/^\d{1,24}$/.test(pageID)) return { status: 400, payload: { error: 'bad_page' } };
  if (pull.busy()) return { status: 200, payload: { ok: false, reason: 'busy', pageID } };
  pull.setBusy(true);
  try {
    const sheet = pull.fn
      ? await pull.fn(pageID)
      : await import('./history.mjs').then((mod) => mod.pullItemSheet(pageID));
    if (!sheet?.ok) {
      return { status: 200, payload: { ok: false, reason: sheet?.reason || 'pull_failed', pageID } };
    }
    const mod = await import('./history.mjs');
    const hops = mod.hopsFromHtml(sheet.html || '');
    const moves = mod.saleClocks(hops);
    if (!hops.length) {
      return { status: 200, payload: { ok: false, reason: 'no_hops', pageID, url: sheet.url || null, moves: [] } };
    }
    return {
      status: 200,
      payload: { ok: true, pageID, url: sheet.url || null, via: sheet.via || 'research', moves },
    };
  } catch {
    return { status: 200, payload: { ok: false, reason: 'no_history_pull', pageID } };
  } finally {
    pull.setBusy(false);
  }
}

async function handle(req, res, itemsDir, pull, names, searches) {
  const pathname = requestPath(req);
  const parts = pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && pathname === '/') {
    const html = fs.readFileSync(path.join(here, 'index.html'));
    sendBytes(res, 200, html, 'text/html; charset=utf-8');
    return;
  }
  if (req.method === 'GET' && pathname === '/sample.sales.json') {
    const raw = fs.readFileSync(sampleFile());
    sendBytes(res, 200, raw, 'application/json; charset=utf-8');
    return;
  }
  if (req.method === 'POST' && pathname === '/construct') {
    const sheet = parseSheet(await readBody(req));
    if (!sheet) {
      sendJson(res, 400, { error: 'bad_json' });
      return;
    }
    sendJson(res, 200, { price: constructPrice(sheet), scan: scanFlags(sheet) });
    return;
  }
  if (req.method === 'GET' && pathname === '/names') {
    const params = new URL(req.url || '/', 'http://127.0.0.1').searchParams;
    let index;
    try {
      index = names.ready();
    } catch {
      sendJson(res, 200, { hits: [], n: 0, missing: true });
      return;
    }
    sendJson(res, 200, {
      hits: suggestNames(params.get('q') || '', { index, field: params.get('field') || 'name' }),
      n: index.n || 0,
      missing: index.missing === true,
    });
    return;
  }
  if (pathname === '/searches' && (req.method === 'GET' || req.method === 'POST')) {
    const out = await searchPayload(req, itemsDir, searches);
    sendJson(res, out.status, out.payload);
    return;
  }
  if (req.method === 'POST' && pathname === '/history') {
    const body = parseSheet(await readBody(req));
    const out = await historyPayload(body, pull);
    sendJson(res, out.status, out.payload);
    return;
  }
  if (parts[0] !== 'items') {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }
  if (parts.length === 1 && req.method === 'GET') {
    sendJson(res, 200, { items: listItems(itemsDir) });
    return;
  }
  if (parts.length !== 2) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }
  let slug = parts[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    sendJson(res, 400, { error: 'bad_slug' });
    return;
  }
  const file = itemFile(itemsDir, slug);
  if (!file) {
    sendJson(res, 400, { error: 'bad_slug' });
    return;
  }
  if (req.method === 'GET') {
    if (!fs.existsSync(file)) {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }
    sendBytes(res, 200, fs.readFileSync(file), 'application/json; charset=utf-8');
    return;
  }
  if (req.method === 'PUT') {
    const sheet = parseSheet(await readBody(req));
    if (!sheet) {
      sendJson(res, 400, { error: 'bad_json' });
      return;
    }
    fs.writeFileSync(file, `${JSON.stringify(sheet, null, 2)}\n`);
    sendJson(res, 200, { ok: true, slug });
    return;
  }
  if (req.method === 'DELETE') {
    if (!fs.existsSync(file)) {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }
    fs.unlinkSync(file);
    sendJson(res, 200, { ok: true, slug });
    return;
  }
  sendJson(res, 405, { error: 'method' });
}

export async function startDesk({
  root = here,
  port = 0,
  pull = null,
  allowHtml = false,
  index = null,
  catalogue = null,
  snap = null,
} = {}) {
  const itemsDir = itemsDirOf(root);
  fs.mkdirSync(itemsDir, { recursive: true });
  let busy = false;
  let loaded = index;
  const pullState = {
    fn: pull,
    allowHtml,
    busy: () => busy,
    setBusy(value) { busy = value; },
  };
  const names = {
    ready() {
      if (!loaded) loaded = loadCatalogueIndex(catalogue || undefined);
      return loaded;
    },
  };
  let queue = null;
  const searches = {
    async ready() {
      if (queue) return queue;
      const mod = await import('./search.mjs');
      queue = mod.createSearchQueue({ itemsDir, snap: snap || mod.researchSnap });
      return queue;
    },
  };
  const server = http.createServer((req, res) => {
    handle(req, res, itemsDir, pullState, names, searches).catch((err) => {
      if (res.headersSent) return;
      const code = Number(err?.status) || 500;
      sendJson(res, code, { error: code === 413 ? 'too_large' : 'server' });
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const addr = server.address();
  const url = `http://127.0.0.1:${addr.port}`;
  return { server, url, itemsDir };
}

const isDirect = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag >= 0 ? process.argv[rootFlag + 1] : resolveDeskRoot(here);
  const portFlag = process.argv.indexOf('--port');
  const port = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : 6217;
  const index = loadCatalogueIndex();
  const line = index.missing
    ? `catalogue missing ${index.file}`
    : `catalogue ${index.n} rows, ${index.items.length} names`;
  const desk = await startDesk({ root, port, index });
  process.stdout.write(`fishcrimes desk ${desk.url}\n${line}\n`);
}
