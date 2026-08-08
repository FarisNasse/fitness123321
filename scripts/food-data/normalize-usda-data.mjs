#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  VALID_SOURCES,
  normalizeFoodRecord,
  streamUsdaJsonRecords,
  validateNormalizedRecord,
} from './lib.mjs';

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const input = arg('--input');
const output = arg('--output');
const source = arg('--source');

if (!input || !output || !source || !VALID_SOURCES.has(source)) {
  console.error('Usage: node normalize-usda-data.mjs --input source.json --output normalized.ndjson --source usda_foundation|usda_fndds|usda_branded');
  process.exit(2);
}

await fs.promises.mkdir(path.dirname(path.resolve(output)), { recursive: true });
const stream = fs.createWriteStream(output, { encoding: 'utf8' });
const seen = new Set();
let inputRecords = 0;
let outputRecords = 0;
let rejected = 0;
let unitWarnings = 0;

for await (const food of streamUsdaJsonRecords(input)) {
  inputRecords += 1;
  const { record, unitErrors } = normalizeFoodRecord(food, source);
  const errors = validateNormalizedRecord(record, { expectedSource: source });
  if (unitErrors.length) unitWarnings += unitErrors.length;
  if (record.fdc_id != null && seen.has(record.fdc_id)) errors.push('duplicate fdc_id in source release');

  if (errors.length) {
    rejected += 1;
    continue;
  }

  seen.add(record.fdc_id);
  stream.write(`${JSON.stringify(record)}\n`);
  outputRecords += 1;
}
await new Promise((resolve, reject) => stream.end((error) => (error ? reject(error) : resolve())));

console.log(JSON.stringify({ inputRecords, outputRecords, rejected, unitWarnings, output }, null, 2));
