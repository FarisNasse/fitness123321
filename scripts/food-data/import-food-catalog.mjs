#!/usr/bin/env node
import { VALID_SOURCES, readNdjson, validateNormalizedRecord } from './lib.mjs';

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const input = arg('--input');
const source = arg('--source');
const version = arg('--version') ?? null;
const releaseDate = arg('--release-date') ?? null;
const batchSize = Math.min(Math.max(Number(arg('--batch-size') ?? 500), 1), 1000);
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!input || !source || !VALID_SOURCES.has(source) || !supabaseUrl || !serviceKey) {
  console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node import-food-catalog.mjs --input normalized.ndjson --source usda_foundation|usda_fndds|usda_branded [--version VERSION] [--release-date YYYY-MM-DD]');
  process.exit(2);
}

const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
  'content-type': 'application/json',
};

async function request(path, init = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text}`);
  return body;
}

const [importRow] = await request('/rest/v1/food_data_imports', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({
    source_type: source,
    source_version: version,
    release_date: releaseDate,
    status: 'running',
  }),
});

const importId = importRow.id;
let batch = [];
let recordsRead = 0;

async function flush() {
  if (!batch.length) return;
  await request('/rest/v1/food_catalog_staging', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(batch),
  });
  batch = [];
}

try {
  const seen = new Set();
  for await (const { lineNumber, value } of readNdjson(input)) {
    const errors = validateNormalizedRecord(value, { expectedSource: source });
    if (seen.has(value?.fdc_id)) errors.push('duplicate fdc_id');
    if (errors.length) throw new Error(`Validation failed on line ${lineNumber}: ${errors.join('; ')}`);
    seen.add(value.fdc_id);
    recordsRead += 1;
    batch.push({ import_id: importId, ...value });
    if (batch.length >= batchSize) await flush();
  }
  await flush();
  if (recordsRead === 0) throw new Error('Normalized file contains no records.');

  const result = await request('/rest/v1/rpc/promote_food_catalog_import', {
    method: 'POST',
    body: JSON.stringify({ input_import_id: importId }),
  });
  console.log(JSON.stringify({ importId, source, recordsRead, result }, null, 2));
} catch (error) {
  try {
    await request(`/rest/v1/food_data_imports?id=eq.${encodeURIComponent(importId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'failed',
        completed_at: new Date().toISOString(),
        records_read: recordsRead,
        error_summary: String(error?.message ?? error).slice(0, 2000),
      }),
    });
  } catch {}
  throw error;
}
