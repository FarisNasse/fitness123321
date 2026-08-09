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


test('USDA integrity migration fixes source types, basis fields, canonical barcode lookup, and release reconciliation', () => {
  const sql = readProjectFile('supabase/migrations/0008_fix_usda_catalog_integrity.sql');
  assert.match(sql, /food_data_imports_source_type_check/);
  assert.match(sql, /usda_sr_legacy/);
  assert.match(sql, /usda_experimental/);
  assert.match(sql, /nutrition_basis_size/);
  assert.match(sql, /serving_options jsonb/);
  assert.match(sql, /canonical_food_gtin/);
  assert.match(sql, /source_type='usda_branded'/);
  assert.match(sql, /publication_date desc nulls last/);
  assert.match(sql, /set status='retired'/);
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


test('branded servings remain separate from an explicit per-100g nutrient basis', () => {
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
  assert.equal(record.calories, 400);
  assert.equal(record.protein_g, 25);
  assert.equal(record.nutrition_basis_size, 100);
  assert.equal(record.nutrition_basis_unit, 'g');
  assert.equal(record.nutrient_data.basis, 'per_100_g');
  assert.equal(record.nutrient_data.nutrients['1008'].amount, 400);
});

test('branded mL servings, branded categories, and all portion choices are retained', () => {
  const { record } = normalizeFoodRecord({
    fdcId: 457,
    dataType: 'Branded',
    description: 'Sparkling drink',
    brandedFoodCategory: 'Beverages',
    servingSize: 355,
    servingSizeUnit: 'mL',
    foodPortions: [
      { amount: 2, modifier: 'tbsp', gramWeight: 30 },
      { amount: 1, modifier: 'cup', gramWeight: 240 },
    ],
    foodNutrients: [{ nutrient: { id: 1008, unitName: 'kcal' }, amount: 12 }],
  });

  assert.equal(record.food_category, 'Beverages');
  assert.equal(record.serving_size, 355);
  assert.equal(record.serving_unit, 'mL');
  assert.deepEqual(
    record.serving_options.map(({ amount, unit, gram_weight }) => ({ amount, unit, gram_weight })),
    [
      { amount: 355, unit: 'mL', gram_weight: null },
      { amount: 2, unit: 'tbsp', gram_weight: 30 },
      { amount: 1, unit: 'cup', gram_weight: 240 },
    ]
  );
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

test('live FoodData Central search is query-sensitive and requires details hydration before logging', async () => {
  const { getFoodDataCentralDetails, searchFoodDataCentral } = await import('../supabase/functions/_shared/usda-fdc.mjs');
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (String(url).includes('/food/222?')) {
      return new Response(JSON.stringify({
        fdcId: 222,
        dataType: 'Branded',
        description: 'Greek Yogurt, Plain',
        brandOwner: 'Example Dairy',
        gtinUpc: '00012345678905',
        servingSize: 170,
        servingSizeUnit: 'g',
        publicationDate: '2026-07-23',
        foodPortions: [{ amount: 1, modifier: 'container', gramWeight: 170 }],
        foodNutrients: [
          { nutrient: { id: 1008, unitName: 'kcal' }, amount: 59 },
          { nutrient: { id: 1003, unitName: 'g' }, amount: 10.3 },
        ],
      }), { status: 200 });
    }

    const body = JSON.parse(String(init.body ?? '{}'));
    const foods = /yogurt/i.test(body.query)
      ? [{
          fdcId: 222,
          dataType: 'Branded',
          description: 'Greek Yogurt, Plain',
          brandOwner: 'Example Dairy',
          gtinUpc: '00012345678905',
          foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 59 }],
        }]
      : [{
          fdcId: 111,
          dataType: 'Foundation',
          description: 'Apples, raw, with skin',
          foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 52 }],
        }];
    return new Response(JSON.stringify({ foods }), { status: 200 });
  };

  const apple = await searchFoodDataCentral({ query: 'Apple', apiKey: 'test-key', fetchImpl });
  const yogurt = await searchFoodDataCentral({ query: 'Yogurt', apiKey: 'test-key', fetchImpl });

  assert.equal(apple.length, 1);
  assert.equal(apple[0].description, 'Apples, raw, with skin');
  assert.equal(yogurt.length, 1);
  assert.equal(yogurt[0].description, 'Greek Yogurt, Plain');
  assert.equal(yogurt[0].details_complete, false);
  assert.equal(yogurt[0].nutrition_basis_size, 100);
  assert.equal(yogurt[0].nutrition_basis_unit, 'g');

  const details = await getFoodDataCentralDetails({ fdcId: 222, apiKey: 'test-key', fetchImpl });
  assert.equal(details.details_complete, true);
  assert.equal(details.serving_size, 170);
  assert.equal(details.publication_date, '2026-07-23');
  assert.equal(requests.some(({ url }) => url.includes('/food/222?')), true);
});

test('GTIN handling validates check digits, canonicalizes padding, expands UPC-E, and extracts only AI 01 from GS1 payloads', async () => {
  const {
    canonicalizeFdcGtin,
    extractFdcBarcode,
    isValidFdcGtin,
  } = await import('../supabase/functions/_shared/usda-fdc.mjs');

  assert.equal(isValidFdcGtin('012345678905'), true);
  assert.equal(isValidFdcGtin('012345678904'), false);
  assert.equal(canonicalizeFdcGtin('012345678905'), '00012345678905');
  assert.equal(canonicalizeFdcGtin('00012345678905'), '00012345678905');
  assert.equal(isValidFdcGtin('04252614'), true);
  assert.equal(canonicalizeFdcGtin('04252614'), '00042100005264');
  assert.equal(
    extractFdcBarcode('https://id.gs1.org/01/00012345678905/10/LOT123/21/9999'),
    '00012345678905'
  );
  assert.equal(extractFdcBarcode('prefix 00012345678905 lot 9999'), null);
});

test('barcode search is Branded-only, hydrates exact GTIN matches, and returns newest publication first', async () => {
  const { searchFoodDataCentralByBarcode } = await import('../supabase/functions/_shared/usda-fdc.mjs');
  const detailPayloads = new Map([
    [1001, { publicationDate: '2025-01-01', description: 'Yogurt old' }],
    [1002, { publicationDate: '2026-07-23', description: 'Yogurt new' }],
  ]);
  const requestBodies = [];
  const fetchImpl = async (url, init = {}) => {
    const textUrl = String(url);
    if (textUrl.includes('/foods/search?')) {
      const body = JSON.parse(String(init.body));
      requestBodies.push(body);
      return new Response(JSON.stringify({ foods: [
        { fdcId: 1001, dataType: 'Branded', description: 'Yogurt old', gtinUpc: '012345678905' },
        { fdcId: 1002, dataType: 'Branded', description: 'Yogurt new', gtinUpc: '00012345678905' },
        { fdcId: 9999, dataType: 'Branded', description: 'Wrong', gtinUpc: '036000291452' },
      ] }), { status: 200 });
    }
    const id = Number(textUrl.match(/\/food\/(\d+)/)?.[1]);
    const meta = detailPayloads.get(id);
    return new Response(JSON.stringify({
      fdcId: id,
      dataType: 'Branded',
      description: meta.description,
      gtinUpc: '00012345678905',
      servingSize: 170,
      servingSizeUnit: 'g',
      publicationDate: meta.publicationDate,
      foodNutrients: [{ nutrient: { id: 1008, unitName: 'kcal' }, amount: 59 }],
    }), { status: 200 });
  };

  const foods = await searchFoodDataCentralByBarcode({
    barcode: '012345678905', apiKey: 'test-key', fetchImpl,
  });
  assert.equal(requestBodies.every((body) => body.dataType?.[0] === 'Branded'), true);
  assert.equal(requestBodies.every((body) => String(body.query).startsWith('gtinUpc:')), true);
  assert.deepEqual(foods.map((food) => food.fdc_id), [1002, 1001]);
  assert.equal(foods.every((food) => food.details_complete), true);
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

test('FoodData Central search retries throttled requests and succeeds after Retry-After', async () => {
  const { searchFoodDataCentral } = await import('../supabase/functions/_shared/usda-fdc.mjs');
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: 'rate limited' }), {
        status: 429,
        headers: { 'retry-after': '0' },
      });
    }
    return new Response(JSON.stringify({
      foods: [{
        fdcId: 999,
        dataType: 'Foundation',
        description: 'Apple, test fixture',
        foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 52 }],
      }],
    }), { status: 200 });
  };

  const foods = await searchFoodDataCentral({
    query: 'apple', apiKey: 'test-key', fetchImpl, pageSize: 25, pageNumber: 1,
  });
  assert.equal(calls, 2);
  assert.equal(foods[0].fdc_id, 999);
});

test('nutrition unit math converts compatible units and USDA portion gram weights without guessing', async () => {
  const { calculateFoodMultiplier } = await import('../src/features/nutrition/nutrition-unit-math.mjs');
  const baseFood = {
    nutritionBasisSize: 100,
    nutritionBasisUnit: 'g',
    servingSize: 100,
    servingUnit: 'g',
    servingOptions: [],
  };

  assert.ok(Math.abs(calculateFoodMultiplier(baseFood, 1, 'oz') - 0.28349523125) < 1e-12);
  assert.equal(calculateFoodMultiplier({
    ...baseFood,
    servingSize: 1,
    servingUnit: 'cup',
    servingOptions: [{ amount: 1, unit: 'cup', gramWeight: 240 }],
  }, 1, 'cup'), 2.4);
  assert.throws(() => calculateFoodMultiplier(baseFood, 1, 'cup'), /Cannot convert cup/);
});
