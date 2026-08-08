const FDC_API_BASE = 'https://api.nal.usda.gov/fdc/v1';

const NUTRIENT_MAP = new Map([
  [1003, ['protein_g', 'g']],
  [1004, ['fat_g', 'g']],
  [1005, ['carbohydrates_g', 'g']],
  [1008, ['calories', 'kcal']],
  [2047, ['calories', 'kcal']],
  [2048, ['calories', 'kcal']],
  [1079, ['fiber_g', 'g']],
  [2000, ['sugar_g', 'g']],
  [1258, ['saturated_fat_g', 'g']],
  [1093, ['sodium_mg', 'mg']],
]);

const CORE_NUTRIENTS = [
  'calories',
  'protein_g',
  'carbohydrates_g',
  'fat_g',
  'fiber_g',
  'sugar_g',
  'saturated_fat_g',
  'sodium_mg',
];

export function normalizeFdcBarcode(value) {
  if (value == null) return null;
  const normalized = String(value).trim().replace(/[^0-9]/g, '');
  return normalized || null;
}

export function normalizeFdcSourceType(value) {
  const source = String(value ?? '').trim().toLowerCase();
  if (source.includes('foundation')) return 'usda_foundation';
  if (source.includes('fndds') || source.includes('survey')) return 'usda_fndds';
  if (source.includes('branded')) return 'usda_branded';
  if (source.includes('sr legacy') || source === 'sr legacy') return 'usda_sr_legacy';
  if (source.includes('experimental')) return 'usda_experimental';
  return 'usda_other';
}

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractSearchNutrients(food) {
  const values = Object.fromEntries(CORE_NUTRIENTS.map((key) => [key, null]));
  const nutrients = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];

  for (const entry of nutrients) {
    const nutrientId = Number(entry?.nutrientId ?? entry?.nutrient?.id ?? entry?.id);
    const amount = finiteNumber(entry?.value ?? entry?.amount);
    const unit = String(entry?.unitName ?? entry?.nutrient?.unitName ?? '').trim().toLowerCase();
    const mapping = NUTRIENT_MAP.get(nutrientId);

    if (!mapping || amount == null) continue;
    const [key, expectedUnit] = mapping;
    if (unit && unit !== expectedUnit) continue;

    if (key === 'calories' && values.calories != null && nutrientId !== 1008) continue;
    values[key] = amount;
  }

  return values;
}

function servingBasis(food, sourceType) {
  const declaredSize = finiteNumber(food?.servingSize);
  const declaredUnit = String(food?.servingSizeUnit ?? '').trim();
  const household = String(food?.householdServingFullText ?? '').trim() || null;

  if (
    sourceType === 'usda_branded' &&
    declaredSize != null &&
    declaredSize > 0 &&
    /^(g|gram|grams)$/i.test(declaredUnit)
  ) {
    return {
      serving_size: declaredSize,
      serving_unit: 'g',
      household_serving_text: household,
      grams: declaredSize,
    };
  }

  return {
    serving_size: 100,
    serving_unit: 'g',
    household_serving_text: household,
    grams: 100,
  };
}

function scaleNutrients(values, grams) {
  if (grams === 100) return values;
  const multiplier = grams / 100;
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      value == null ? null : Number(value) * multiplier,
    ])
  );
}

export function normalizeFdcSearchFood(food) {
  const fdcId = Number(food?.fdcId);
  if (!Number.isSafeInteger(fdcId) || fdcId <= 0) return null;

  const description = String(food?.description ?? '').trim();
  if (!description) return null;

  const sourceType = normalizeFdcSourceType(food?.dataType);
  const serving = servingBasis(food, sourceType);
  const rawNutrients = extractSearchNutrients(food);
  const nutrients = scaleNutrients(rawNutrients, serving.grams);

  return {
    id: `usda:${fdcId}`,
    source_type: sourceType,
    fdc_id: fdcId,
    description,
    brand_name:
      String(food?.brandName ?? '').trim() || String(food?.brandOwner ?? '').trim() || null,
    gtin_upc: normalizeFdcBarcode(food?.gtinUpc),
    food_category:
      String(food?.foodCategory?.description ?? food?.foodCategory ?? '').trim() || null,
    serving_size: serving.serving_size,
    serving_unit: serving.serving_unit,
    household_serving_text: serving.household_serving_text,
    ...nutrients,
  };
}

function scoreFood(food, query) {
  const normalizedQuery = query.trim().toLowerCase();
  const description = String(food?.description ?? '').toLowerCase();
  const brand = `${food?.brandName ?? ''} ${food?.brandOwner ?? ''}`.trim().toLowerCase();
  const source = normalizeFdcSourceType(food?.dataType);

  let score = 0;
  if (description === normalizedQuery) score += 1000;
  else if (description.startsWith(normalizedQuery)) score += 650;
  else if (description.includes(normalizedQuery)) score += 400;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every((token) => description.includes(token))) score += 200;
  if (brand && tokens.length > 0 && tokens.every((token) => `${brand} ${description}`.includes(token))) {
    score += 120;
  }

  switch (source) {
    case 'usda_foundation':
      score += 60;
      break;
    case 'usda_fndds':
      score += 50;
      break;
    case 'usda_sr_legacy':
      score += 40;
      break;
    case 'usda_experimental':
      score += 30;
      break;
    case 'usda_branded':
      score += 20;
      break;
    default:
      score += 10;
  }

  return score;
}

function normalizePageSize(value) {
  const parsed = Number(value);
  return Math.min(Math.max(Number.isFinite(parsed) ? Math.trunc(parsed) : 25, 1), 50);
}

function normalizePageNumber(value) {
  const parsed = Number(value);
  return Math.max(Number.isFinite(parsed) ? Math.trunc(parsed) : 1, 1);
}

export async function searchFoodDataCentral({
  query,
  apiKey,
  pageSize = 25,
  pageNumber = 1,
  fetchImpl = fetch,
}) {
  const trimmed = String(query ?? '').trim();
  if (trimmed.length < 2) return [];
  if (!apiKey) throw new Error('A FoodData Central API key is required.');

  const response = await fetchImpl(`${FDC_API_BASE}/foods/search?api_key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: trimmed,
      pageSize: normalizePageSize(pageSize),
      pageNumber: normalizePageNumber(pageNumber),
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`FoodData Central search failed (${response.status})${message ? `: ${message}` : ''}`);
  }

  const payload = await response.json();
  const foods = Array.isArray(payload?.foods) ? payload.foods : [];

  return foods
    .slice()
    .sort((a, b) => scoreFood(b, trimmed) - scoreFood(a, trimmed))
    .map(normalizeFdcSearchFood)
    .filter(Boolean);
}

export async function searchFoodDataCentralByBarcode({
  barcode,
  apiKey,
  fetchImpl = fetch,
}) {
  const normalized = normalizeFdcBarcode(barcode);
  if (!normalized || normalized.length < 6 || normalized.length > 14) return [];

  const results = await searchFoodDataCentral({
    query: normalized,
    apiKey,
    pageSize: 50,
    pageNumber: 1,
    fetchImpl,
  });

  return results.filter((food) => normalizeFdcBarcode(food.gtin_upc) === normalized).slice(0, 5);
}
