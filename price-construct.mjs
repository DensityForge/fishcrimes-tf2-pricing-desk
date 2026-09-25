/**
 * Fishcrimes system. Same arithmetic as the page, from a sheet file.
 * Pricing method: fishcrimes (YouTube and Discord @fishcrimes, Fishcrimes#1509).
 * Desk: donkeybrains. Contact: densityforge@gmail.com.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 * Refuses --send and --write. Does not post a suggestion.
 *
 *   node price-construct.mjs --file sample.sales.json
 *   node price-construct.mjs --scan --file sample.sales.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { constructPrice, scanFlags } from './price-construct.js';

const argv = process.argv.slice(2);
if (argv.includes('--send') || argv.includes('--write')) {
  console.error('refused. This tool does not post a suggestion and does not write a result file.');
  process.exit(2);
}

function flagStr(name) {
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  return '';
}

const here = path.dirname(fileURLToPath(import.meta.url));
const file = flagStr('--file') || path.join(here, 'sample.sales.json');
if (!fs.existsSync(file)) {
  console.error('needs --file <sales.json>');
  process.exit(1);
}
const input = JSON.parse(fs.readFileSync(file, 'utf8'));
const price = constructPrice(input);
const scan = scanFlags(input);
if (argv.includes('--scan')) {
  process.stdout.write(`${JSON.stringify(scan, null, 2)}\n`);
  process.exit(scan.action === 'REFUSE' ? 1 : 0);
}
process.stdout.write(`${JSON.stringify({ price, scan }, null, 2)}\n`);
process.exit(price.ok ? 0 : 1);
