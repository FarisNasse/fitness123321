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

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : null;
}

async function fetchWithPolicy(url, options, {
  fetchImpl = fetch,
  timeoutMs = 12000,
  retries = 2,
  signal,
} = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('FoodData Central request timed out.')), timeoutMs);
    const abortFromCaller = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      if (response.ok || !RETRYABLE_STATUS.has(response.status) || attempt === retries) {
        return response;
      }

      const retryAfter = parseRetryAfter(response.headers?.get?.('retry-after'));
      await sleep(retryAfter ?? 250 * (2 ** attempt));
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      if (attempt === retries) throw error;
      await sleep(250 * (2 ** attempt));
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  throw lastError ?? new Error('FoodData Central request failed.');
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

function gtinCheckDigitIsValid(value) {
  if (!/^\d+$/.test(value) || !GTIN_LENGTHS.has(value.length)) return false;
  const body = value.slice(0, -1);
  const expected = Number(value.at(-1));
  let sum = 0;
  let weight = 3;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10 === expected;
}

function expandUpce(value) {
  if (!/^\d{8}$/.test(value)) return null;
  const numberSystem = value[0];
  const checkDigit = value[7];
  if (numberSystem !== '0' && numberSystem !== '1') return null;

  const d1 = value[1];
  const d2 = value[2];
  const d3 = value[3];
  const d4 = value[4];
  const d5 = value[5];
  const d6 = value[6];
  let body;

  if (d6 === '0' || d6 === '1' || d6 === '2') {
    body = `${numberSystem}${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  } else if (d6 === '3') {
    body = `${numberSystem}${d1}${d2}${d3}00000${d4}${d5}`;
  } else if (d6 === '4') {
    body = `${numberSystem}${d1}${d2}${d3}${d4}00000${d5}`;
  } else {
    body = `${numberSystem}${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  }

  const expanded = `${body}${checkDigit}`;
  return gtinCheckDigitIsValid(expanded) ? expanded : null;
}

export function extractFdcBarcode(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) return raw;

  const digitalLink = raw.match(/(?:\/01\/|\(01\)|\b01)(\d{14})(?:\D|$)/);
  if (digitalLink) return digitalLink[1];

  return null;
}

export function normalizeFdcBarcode(value, { requireValidCheckDigit = false } = {}) {
  const extracted = extractFdcBarcode(value);
  if (!extracted) return null;

  const digits = extracted;
  if (!GTIN_LENGTHS.has(digits.length)) return null;
  if (requireValidCheckDigit && !gtinCheckDigitIsValid(digits)) return null;
  return digits;
}

export function canonicalizeFdcGtin(value, { requireValidCheckDigit = false } = {}) {
  const normalized = normalizeFdcBarcode(value, { requireValidCheckDigit });
  if (!normalized) return null;

  const upce = normalized.length === 8 ? expandUpce(normalized) : null;
  const identity = upce ?? normalized;
  return identity.padStart(14, '0');
}

export function isValidFdcGtin(value) {
  const normalized = normalizeFdcBarcode(value);
  if (!normalized) return false;
  if (normalized.length === 8 && expandUpce(normalized)) return true;
  return gtinCheckDigitIsValid(normalized);
}

export function getFdcGtinAliases(value, { requireValidCheckDigit = false } = {}) {
  const normalized = normalizeFdcBarcode(value, { requireValidCheckDigit });
  if (!normalized) return [];

  const aliases = new Set([normalized, normalized.padStart(14, '0')]);
  const expanded = normalized.length === 8 ? expandUpce(normalized) : null;
  if (expanded) {
    aliases.add(expanded);
    aliases.add(expanded.padStart(14, '0'));
  }

  for (const alias of [...aliases]) {
    const unpadded = alias.replace(/^0+(?=\d)/, '');
    if (unpadded) aliases.add(unpadded);
  }
  return [...aliases];
}

function extractNutrients(food) {
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

function normalizeServingUnit(value) {
  const unit = String(value ?? '').trim().toLowerCase();
  if (/^(g|gram|grams)$/.test(unit)) return 'g';
  if (/^(ml|milliliter|milliliters|millilitre|millilitres)$/.test(unit)) return 'mL';
  if (/^(oz|ounce|ounces)$/.test(unit)) return 'oz';
  return String(value ?? '').trim() || null;
}

function servingOptions(food) {
  const result = [];
  const seen = new Set();
  const portions = Array.isArray(food?.foodPortions) ? food.foodPortions : [];

  for (const portion of portions) {
    const gramWeight = finiteNumber(portion?.gramWeight);
    if (gramWeight == null || gramWeight <= 0) continue;
    const amount = finiteNumber(portion?.amount) ?? 1;
    const description = String(
      portion?.portionDescription ?? portion?.modifier ?? portion?.measureUnit?.name ?? 'portion'
    ).trim();
    const key = `${amount}:${description.toLowerCase()}:${gramWeight}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      label: String(portion?.portionDescription ?? '').trim() || `${amount} ${description}`,
      amount,
      unit: description,
      gram_weight: gramWeight,
    });
  }

  return result;
}

function preferredServing(food, options) {
  const declaredSize = finiteNumber(food?.servingSize);
  const declaredUnit = normalizeServingUnit(food?.servingSizeUnit);
  const household = String(food?.householdServingFullText ?? '').trim() || null;

  if (declaredSize != null && declaredSize > 0 && declaredUnit) {
    return {
      serving_size: declaredSize,
      serving_unit: declaredUnit,
      household_serving_text: household,
    };
  }

  const first = options[0];
  if (first) {
    return {
      serving_size: first.amount,
      serving_unit: first.unit,
      household_serving_text: first.label,
    };
  }

  return {
    serving_size: 100,
    serving_unit: 'g',
    household_serving_text: household,
  };
}

function normalizeBaseFood(food, { detailsComplete }) {
  const fdcId = Number(food?.fdcId);
  if (!Number.isSafeInteger(fdcId) || fdcId <= 0) return null;

  const description = String(food?.description ?? '').trim();
  if (!description) return null;

  const options = servingOptions(food);
  const preferred = preferredServing(food, options);

  return {
    id: `usda:${fdcId}`,
    source_type: normalizeFdcSourceType(food?.dataType),
    fdc_id: fdcId,
    description,
    brand_name: String(food?.brandName ?? '').trim() || String(food?.brandOwner ?? '').trim() || null,
    gtin_upc: normalizeFdcBarcode(food?.gtinUpc),
    food_category: String(
      food?.brandedFoodCategory ?? food?.foodCategory?.description ?? food?.foodCategory ?? ''
    ).trim() || null,
    serving_size: preferred.serving_size,
    serving_unit: preferred.serving_unit,
    household_serving_text: preferred.household_serving_text,
    nutrition_basis_size: 100,
    nutrition_basis_unit: 'g',
    serving_options: options,
    publication_date: isoDateOrNull(food?.publicationDate),
    available_date: isoDateOrNull(food?.availableDate),
    modified_date: isoDateOrNull(food?.modifiedDate),
    details_complete: detailsComplete,
    ...extractNutrients(food),
  };
}

export function normalizeFdcSearchFood(food) {
  return normalizeBaseFood(food, { detailsComplete: false });
}

export function normalizeFdcFoodDetails(food) {
  return normalizeBaseFood(food, { detailsComplete: true });
}

function normalizePageSize(value) {
  const parsed = Number(value);
  return Math.min(Math.max(Number.isFinite(parsed) ? Math.trunc(parsed) : 25, 1), 200);
}

function normalizePageNumber(value) {
  const parsed = Number(value);
  return Math.max(Number.isFinite(parsed) ? Math.trunc(parsed) : 1, 1);
}

async function parseFdcResponse(response, operation) {
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    const suffix = message ? `: ${message}` : '';
    throw new Error(`FoodData Central ${operation} failed (${response.status})${suffix}`);
  }
  return response.json();
}

export async function searchFoodDataCentral({
  query,
  apiKey,
  pageSize = 25,
  pageNumber = 1,
  fetchImpl = fetch,
  signal,
}) {
  const trimmed = String(query ?? '').trim();
  if (trimmed.length < 2) return [];
  if (!apiKey) throw new Error('A FoodData Central API key is required.');

  const response = await fetchWithPolicy(
    `${FDC_API_BASE}/foods/search?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: trimmed,
        pageSize: normalizePageSize(pageSize),
        pageNumber: normalizePageNumber(pageNumber),
      }),
    },
    { fetchImpl, signal }
  );

  const payload = await parseFdcResponse(response, 'search');
  const foods = Array.isArray(payload?.foods) ? payload.foods : [];
  return foods.map(normalizeFdcSearchFood).filter(Boolean);
}

export async function getFoodDataCentralDetails({
  fdcId,
  apiKey,
  fetchImpl = fetch,
  signal,
}) {
  const id = Number(fdcId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('A valid FDC ID is required.');
  if (!apiKey) throw new Error('A FoodData Central API key is required.');

  const response = await fetchWithPolicy(
    `${FDC_API_BASE}/food/${id}?api_key=${encodeURIComponent(apiKey)}`,
    { method: 'GET' },
    { fetchImpl, signal }
  );
  const payload = await parseFdcResponse(response, 'details');
  const normalized = normalizeFdcFoodDetails(payload);
  if (!normalized) throw new Error(`FoodData Central returned invalid details for FDC ${id}.`);
  return normalized;
}

function comparePublicationDateDesc(a, b) {
  const aDate = Date.parse(a?.publication_date ?? a?.modified_date ?? a?.available_date ?? 0);
  const bDate = Date.parse(b?.publication_date ?? b?.modified_date ?? b?.available_date ?? 0);
  if (Number.isFinite(aDate) || Number.isFinite(bDate)) {
    return (Number.isFinite(bDate) ? bDate : 0) - (Number.isFinite(aDate) ? aDate : 0);
  }
  return Number(b?.fdc_id ?? 0) - Number(a?.fdc_id ?? 0);
}

export async function searchFoodDataCentralByBarcode({
  barcode,
  apiKey,
  fetchImpl = fetch,
  signal,
}) {
  const normalized = normalizeFdcBarcode(barcode, { requireValidCheckDigit: true });
  const aliases = getFdcGtinAliases(normalized, { requireValidCheckDigit: true });
  if (!normalized || aliases.length === 0) return [];
  if (!apiKey) throw new Error('A FoodData Central API key is required.');

  const aliasSet = new Set(aliases.map((alias) => alias.padStart(14, '0')));
  const queries = new Set(aliases);
  const candidateIds = new Set();

  for (const query of queries) {
    const response = await fetchWithPolicy(
      `${FDC_API_BASE}/foods/search?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `gtinUpc:${query}`,
          dataType: ['Branded'],
          pageSize: 200,
          pageNumber: 1,
        }),
      },
      { fetchImpl, signal }
    );
    const payload = await parseFdcResponse(response, 'barcode search');
    for (const food of Array.isArray(payload?.foods) ? payload.foods : []) {
      const candidateAliases = getFdcGtinAliases(food?.gtinUpc).map((alias) => alias.padStart(14, '0'));
      if (candidateAliases.some((alias) => aliasSet.has(alias)) && Number.isSafeInteger(Number(food?.fdcId))) {
        candidateIds.add(Number(food.fdcId));
      }
    }
  }

  const details = await Promise.all(
    [...candidateIds].slice(0, 20).map((fdcId) =>
      getFoodDataCentralDetails({ fdcId, apiKey, fetchImpl, signal })
    )
  );

  return details
    .filter((food) => getFdcGtinAliases(food.gtin_upc).some((alias) => aliasSet.has(alias.padStart(14, '0'))))
    .sort(comparePublicationDateDesc)
    .slice(0, 5);
}
