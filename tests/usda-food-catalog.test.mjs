import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  extractNutrients,
  normalizeBarcode,
  normalizeFoodRecord,
  streamUsdaJsonRecords,
  validateNormalizedRecord,
} from '../scripts/food-data/lib.mjs';
import { readProjectFile } from './helpers/project.mjs';

test('USDA migration creates a read-only catalog, private custom foods, ranked search, barcode lookup, and staging promotion', () => {
  const sql = readProjectFile('supabase/migrations/0006_add_usda_food_catalog.sql');

  assert.match(sql, /create table if not exists public\.food_catalog \(/);
  assert.match(sql, /fdc_id bigint not null unique/);
  assert.match(sql, /source_type text not null check/);
  assert.match(sql, /create table if not exists public\.food_catalog_staging/);
  assert.match(sql, /create unique index if not exists food_catalog_staging_import_fdc_idx/);
  assert.match(sql, /create table if not exists public\.user_foods/);
  assert.match(sql, /alter table public\.food_catalog enable row level security/);
  assert.match(sql, /Public clients can read food catalog/);
  assert.match(sql, /create or replace function public\.search_food_catalog/);
  assert.match(sql, /similarity\(lower\(fc\.description\), i\.q\)/);
  assert.match(sql, /create or replace function public\.search_food_by_barcode/);
  assert.match(sql, /and fc\.gtin_upc = i\.barcode/);
  assert.match(sql, /create or replace function public\.promote_food_catalog_import/);
  assert.match(sql, /revoke all on function public\.promote_food_catalog_import\(uuid\) from public, anon, authenticated/);
  assert.match(sql, /add column if not exists food_source text/);
  assert.match(sql, /add column if not exists fdc_id bigint/);
});

test('barcode normalization preserves meaningful leading zeros', () => {
  assert.equal(normalizeBarcode(' 0-12345-67890-5 '), '012345678905');
  assert.equal(normalizeBarcode('0001234567890'), '0001234567890');
  assert.equal(normalizeBarcode(''), null);
});

test('nutrient mapper preserves nulls and maps known nutrient IDs with explicit units', () => {
  const food = {
    foodNutrients: [
      { nutrient: { id: 1008, name: 'Energy', unitName: 'kcal' }, amount: 89 },
      { nutrient: { id: 1003, name: 'Protein', unitName: 'g' }, amount: 1.1 },
      { nutrient: { id: 1093, name: 'Sodium, Na', unitName: 'mg' }, amount: 1 },
    ],
  };
  const result = extractNutrients(food);
  assert.equal(result.calories, 89);
  assert.equal(result.protein_g, 1.1);
  assert.equal(result.sodium_mg, 1);
  assert.equal(result.fiber_g, null);
  assert.deepEqual(result.unitErrors, []);
});

test('normalizer creates a canonical Foundation record without fabricating missing nutrients', () => {
  const { record, unitErrors } = normalizeFoodRecord({
    fdcId: 123,
    dataType: 'Foundation',
    description: 'Bananas, raw',
    foodNutrients: [
      { nutrient: { id: 1008, unitName: 'kcal' }, amount: 89 },
      { nutrient: { id: 1005, unitName: 'g' }, amount: 22.8 },
    ],
  });
  assert.equal(record.source_type, 'usda_foundation');
  assert.equal(record.fdc_id, 123);
  assert.equal(record.calories, 89);
  assert.equal(record.carbohydrates_g, 22.8);
  assert.equal(record.protein_g, null);
  assert.equal(record.gtin_upc, null);
  assert.deepEqual(unitErrors, []);
  assert.deepEqual(validateNormalizedRecord(record), []);
});


test('branded label servings in grams scale USDA per-100g nutrients without losing the raw basis', () => {
  const { record } = normalizeFoodRecord({
    fdcId: 456,
    dataType: 'Branded',
    description: 'Protein bar',
    servingSize: 40,
    servingSizeUnit: 'g',
    householdServingFullText: '1 bar (40 g)',
    gtinUpc: '0012345678905',
    foodNutrients: [
      { nutrient: { id: 1008, unitName: 'kcal' }, amount: 400 },
      { nutrient: { id: 1003, unitName: 'g' }, amount: 25 },
    ],
  });

  assert.equal(record.serving_size, 40);
  assert.equal(record.serving_unit, 'g');
  assert.equal(record.calories, 160);
  assert.equal(record.protein_g, 10);
  assert.equal(record.nutrient_data.basis, 'per_100_g');
  assert.equal(record.nutrient_data.nutrients['1008'].amount, 400);
});

test('bulk JSON reader streams recognized USDA root arrays', async () => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'food-stream-'));
  const file = path.join(dir, 'fixture.json');
  await fs.promises.writeFile(file, JSON.stringify({ FoundationFoods: [
    { fdcId: 1, description: 'One' },
    { fdcId: 2, description: 'Two', nested: { value: 'brace } inside string' } },
  ] }));

  const ids = [];
  for await (const food of streamUsdaJsonRecords(file)) ids.push(food.fdcId);
  assert.deepEqual(ids, [1, 2]);
});

test('normalized NDJSON validator script rejects duplicate FDC IDs', async () => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'food-catalog-'));
  const file = path.join(dir, 'fixture.ndjson');
  const row = {
    fdc_id: 42,
    source_type: 'usda_foundation',
    description: 'Fixture food',
    calories: null,
    protein_g: null,
    carbohydrates_g: null,
    fat_g: null,
    fiber_g: null,
    sugar_g: null,
    saturated_fat_g: null,
    sodium_mg: null,
  };
  await fs.promises.writeFile(file, `${JSON.stringify(row)}\n${JSON.stringify(row)}\n`);
  const source = readProjectFile('scripts/food-data/validate-food-catalog.mjs');
  assert.match(source, /duplicate fdc_id in normalized file/);
});

test('live FoodData Central search normalizer exposes apple and yogurt results from API-shaped payloads', async () => {
  const { searchFoodDataCentral } = await import('../supabase/functions/_shared/usda-fdc.mjs');
  const payload = {
    foods: [
      {
        fdcId: 111,
        dataType: 'Foundation',
        description: 'Apples, raw, with skin',
        foodNutrients: [
          { nutrientId: 1008, nutrientName: 'Energy', unitName: 'KCAL', value: 52 },
          { nutrientId: 1003, nutrientName: 'Protein', unitName: 'G', value: 0.26 },
        ],
      },
      {
        fdcId: 222,
        dataType: 'Branded',
        description: 'Greek Yogurt, Plain',
        brandOwner: 'Example Dairy',
        gtinUpc: '00012345678905',
        servingSize: 170,
        servingSizeUnit: 'g',
        foodNutrients: [
          { nutrientId: 1008, nutrientName: 'Energy', unitName: 'KCAL', value: 59 },
          { nutrientId: 1003, nutrientName: 'Protein', unitName: 'G', value: 10.3 },
        ],
      },
    ],
  };

  const fetchImpl = async () => new Response(JSON.stringify(payload), { status: 200 });
  const apple = await searchFoodDataCentral({ query: 'Apple', apiKey: 'test-key', fetchImpl });
  const yogurt = await searchFoodDataCentral({ query: 'Yogurt', apiKey: 'test-key', fetchImpl });

  assert.equal(apple[0].description, 'Apples, raw, with skin');
  assert.equal(apple[0].source_type, 'usda_foundation');
  assert.equal(yogurt.some((food) => /yogurt/i.test(food.description)), true);
  assert.equal(yogurt.find((food) => food.fdc_id === 222)?.gtin_upc, '00012345678905');
});

test('USDA backend proxy keeps the secret key server-side and exposes search plus barcode actions', () => {
  const edge = readProjectFile('supabase/functions/search-usda-foods/index.ts');
  const shared = readProjectFile('supabase/functions/_shared/usda-fdc.mjs');

  assert.match(edge, /Deno\.env\.get\('USDA_FDC_API_KEY'\)/);
  assert.match(edge, /action === 'barcode'/);
  assert.match(edge, /searchFoodDataCentral\(/);
  assert.match(edge, /searchFoodDataCentralByBarcode\(/);
  assert.match(shared, /\/foods\/search\?api_key=/);
  assert.doesNotMatch(shared, /USDA_FDC_API_KEY\s*=/);
});
