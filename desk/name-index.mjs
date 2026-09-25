/**
 * Item names from the on-disk IGetPrices catalogue.
 * bunkerbot/files/catalogue_bptf_EVERY_SINGLE_ITEM.json
 * Effects are the particle names. A typed line can fill both.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PARTICLE_BY_NAME } from './particle-names.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CATALOGUE_NAME = 'catalogue_bptf_EVERY_SINGLE_ITEM.json';

export function cataloguePath(serverDir = here) {
  const fromEnv = process.env.FISHCRIMES_CATALOGUE;
  const candidates = [
    fromEnv,
    path.join(serverDir, CATALOGUE_NAME),
    path.resolve(serverDir, '..', 'bunkerbot', 'files', CATALOGUE_NAME),
  ].filter(Boolean);
  return candidates.find((file) => fs.existsSync(file)) || candidates[candidates.length - 1];
}

export function foldQuery(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function effectLabel(key) {
  return String(key).split(/(\s+)/).map((word, i) => {
    if (/^\s+$/.test(word)) return word;
    return word.split('-').map((part, j) => {
      if (part.length === 1) return part;
      if (i > 0 && j === 0 && /^(a|of|the|and|to)$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join('-');
  }).join('');
}

function rankOf(fold, query) {
  if (!query) return 3;
  if (fold === query) return 0;
  if (fold.startsWith(query)) return 1;
  if (fold.includes(query)) return 2;
  return 3;
}

export function indexFromCatalogue(raw, particles = PARTICLE_BY_NAME) {
  const rows = Array.isArray(raw) ? raw : raw?.items || [];
  const names = new Set();
  for (const row of rows) {
    if (row?.tradable === false || row?.craftable === false) continue;
    if (Number(row?.quality) !== 6) continue;
    if (Number(row?.effect_id) > 0) continue;
    const name = String(row?.base_name || row?.name || '').replace(/\s+/g, ' ').trim();
    if (name) names.add(name);
  }
  const items = [...names].map((name) => ({ name, fold: foldQuery(name) }));
  const effects = [...new Set(Object.keys(particles || {}).map(effectLabel))]
    .map((name) => ({ name, fold: foldQuery(name) }))
    .sort((a, b) => b.fold.length - a.fold.length || a.name.localeCompare(b.name));
  return { items, effects, n: rows.length };
}

export function loadCatalogueIndex(file = cataloguePath()) {
  if (!file || !fs.existsSync(file)) return { items: [], effects: [], n: 0, file: file || '', missing: true };
  const raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  return { ...indexFromCatalogue(raw), file, missing: false };
}

function byRank(query) {
  return (a, b) => a.rank - b.rank || a.row.name.localeCompare(b.row.name) || (query ? 0 : 0);
}

export function suggestNames(q, { index, limit = 8, field = 'name' } = {}) {
  const bag = index || { items: [], effects: [] };
  const query = foldQuery(q);
  if (!query) return [];
  const cap = Number(limit) > 0 ? Number(limit) : 8;
  if (field === 'effect') {
    return bag.effects
      .map((row) => ({ row, rank: rankOf(row.fold, query) }))
      .filter((hit) => hit.rank < 3)
      .sort(byRank(query))
      .slice(0, cap)
      .map((hit) => ({ name: null, effect: hit.row.name, quality: 5 }));
  }
  let effect = null;
  let nameQ = query;
  for (const row of bag.effects) {
    if (query === row.fold || query.endsWith(` ${row.fold}`)) {
      effect = row;
      nameQ = query.slice(0, query.length - row.fold.length).trim();
      break;
    }
  }
  const hits = [];
  const push = (hit) => {
    if (hits.length >= cap) return;
    if (hits.some((row) => row.name === hit.name && row.effect === hit.effect)) return;
    hits.push(hit);
  };
  if (effect && nameQ) {
    bag.items
      .map((row) => ({ row, rank: rankOf(row.fold, nameQ) }))
      .filter((hit) => hit.rank < 3)
      .sort(byRank(nameQ))
      .forEach((hit) => push({ name: hit.row.name, effect: effect.name, quality: 5 }));
  }
  const itemQ = nameQ || query;
  bag.items
    .map((row) => ({ row, rank: rankOf(row.fold, itemQ) }))
    .filter((hit) => hit.rank < 3)
    .sort(byRank(itemQ))
    .forEach((hit) => push({ name: hit.row.name, effect: null, quality: null }));
  if (!nameQ && effect) push({ name: null, effect: effect.name, quality: 5 });
  if (!effect) {
    bag.effects
      .map((row) => ({ row, rank: rankOf(row.fold, query) }))
      .filter((hit) => hit.rank < 3)
      .sort(byRank(query))
      .forEach((hit) => push({ name: null, effect: hit.row.name, quality: 5 }));
  }
  return hits;
}
