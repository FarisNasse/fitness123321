#!/usr/bin/env node
import { VALID_SOURCES, readNdjson, validateNormalizedRecord } from './lib.mjs';

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const input = arg('--input');
const source = arg('--source');
if (!input || (source && !VALID_SOURCES.has(source))) {
  console.error('Usage: node validate-food-catalog.mjs --input normalized.ndjson [--source usda_foundation|usda_fndds|usda_branded]');
  process.exit(2);
}

const seen = new Set();
let valid = 0;
let invalid = 0;
const samples = [];

for await (const { lineNumber, value } of readNdjson(input)) {
  const errors = validateNormalizedRecord(value, { expectedSource: source });
  if (seen.has(value?.fdc_id)) errors.push('duplicate fdc_id in normalized file');
  seen.add(value?.fdc_id);

  if (errors.length) {
    invalid += 1;
    if (samples.length < 20) samples.push({ lineNumber, fdc_id: value?.fdc_id, errors });
  } else {
    valid += 1;
  }
}

console.log(JSON.stringify({ valid, invalid, samples }, null, 2));
if (invalid > 0 || valid === 0) process.exit(1);
