import fs from 'node:fs';
import readline from 'node:readline';

export const VALID_SOURCES = new Set([
  'usda_foundation',
  'usda_fndds',
  'usda_branded',
]);

export const NUTRIENT_MAP = new Map([
  [1003, { key: 'protein_g', expectedUnits: ['g'] }],
  [1004, { key: 'fat_g', expectedUnits: ['g'] }],
  [1005, { key: 'carbohydrates_g', expectedUnits: ['g'] }],
  [1008, { key: 'calories', expectedUnits: ['kcal'] }],
  [2047, { key: 'calories', expectedUnits: ['kcal'] }],
  [2048, { key: 'calories', expectedUnits: ['kcal'] }],
  [1079, { key: 'fiber_g', expectedUnits: ['g'] }],
  [2000, { key: 'sugar_g', expectedUnits: ['g'] }],
  [1258, { key: 'saturated_fat_g', expectedUnits: ['g'] }],
  [1093, { key: 'sodium_mg', expectedUnits: ['mg'] }],
]);

const CORE_KEYS = [
  'calories',
  'protein_g',
  'carbohydrates_g',
  'fat_g',
  'fiber_g',
  'sugar_g',
  'saturated_fat_g',
  'sodium_mg',
];

export function normalizeBarcode(value) {
  if (value == null) return null;
  const normalized = String(value).trim().replace(/[^0-9]/g, '');
  return normalized || null;
}

export function normalizeSourceType(dataType) {
  const value = String(dataType ?? '').trim().toLowerCase();
  if (value.includes('foundation')) return 'usda_foundation';
  if (value.includes('fndds') || value.includes('survey')) return 'usda_fndds';
  if (value.includes('branded')) return 'usda_branded';
  return null;
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(value) {
  if (!value) return null;
  const text = String(value).trim();
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function nutrientParts(entry) {
  const nutrient = entry?.nutrient ?? entry ?? {};
  const id = Number(nutrient.id ?? entry?.nutrientId ?? entry?.nutrient_id);
  const amount = numberOrNull(entry?.amount ?? entry?.value);
  const unit = String(
    nutrient.unitName ?? nutrient.unit_name ?? entry?.unitName ?? entry?.unit_name ?? ''
  ).trim();
  const name = String(nutrient.name ?? entry?.nutrientName ?? entry?.name ?? '').trim();
  return { id, amount, unit, name };
}

export function extractNutrients(food) {
  const values = Object.fromEntries(CORE_KEYS.map((key) => [key, null]));
  const nutrientData = {};
  const unitErrors = [];
  const nutrients = Array.isArray(food?.foodNutrients)
    ? food.foodNutrients
    : Array.isArray(food?.food_nutrients)
      ? food.food_nutrients
      : [];

  for (const entry of nutrients) {
    const { id, amount, unit, name } = nutrientParts(entry);
    if (!Number.isFinite(id) || amount == null) continue;

    nutrientData[String(id)] = {
      amount,
      unit: unit || null,
      name: name || null,
    };

    const mapping = NUTRIENT_MAP.get(id);
    if (!mapping) continue;

    const normalizedUnit = unit.toLowerCase();
    if (unit && !mapping.expectedUnits.includes(normalizedUnit)) {
      unitErrors.push({ nutrientId: id, unit, expected: mapping.expectedUnits });
      continue;
    }

    // Multiple USDA energy fields can exist. Prefer nutrient 1008 when present,
    // otherwise keep the first valid kcal value rather than summing energy fields.
    if (mapping.key === 'calories' && values.calories != null && id !== 1008) continue;
    values[mapping.key] = amount;
  }

  return { ...values, nutrient_data: nutrientData, unitErrors };
}

function sourcePortion(food) {
  const portions = Array.isArray(food?.foodPortions)
    ? food.foodPortions
    : Array.isArray(food?.food_portions)
      ? food.food_portions
      : [];

  for (const portion of portions) {
    const grams = numberOrNull(portion?.gramWeight ?? portion?.gram_weight);
    if (grams == null || grams <= 0) continue;

    const amount = numberOrNull(portion?.amount);
    const explicitDescription = portion?.portionDescription ?? portion?.portion_description ?? null;
    const measure =
      portion?.modifier ?? portion?.measureUnit?.name ?? portion?.measure_unit?.name ?? null;
    const household = explicitDescription
      ? String(explicitDescription).trim()
      : measure
        ? [amount, String(measure).trim()]
            .filter((value) => value != null && value !== '')
            .join(' ')
        : null;

    return {
      serving_size: grams,
      serving_unit: 'g',
      household_serving_text: household || null,
      gram_basis: grams,
    };
  }
  return null;
}

function servingInfo(food, sourceType) {
  const declaredSize = numberOrNull(food?.servingSize ?? food?.serving_size);
  const declaredUnit = String(
    food?.servingSizeUnit ?? food?.servingUnit ?? food?.serving_unit ?? ''
  ).trim();
  const household =
    food?.householdServingFullText ??
    food?.householdServingText ??
    food?.household_serving_text ??
    null;

  // Branded nutrient values in FoodData Central are standardized per 100 g.
  // Only scale them to the label serving when USDA supplies that serving in grams.
  if (
    sourceType === 'usda_branded' &&
    declaredSize != null &&
    declaredSize > 0 &&
    /^(g|gram|grams)$/i.test(declaredUnit)
  ) {
    return {
      serving_size: declaredSize,
      serving_unit: 'g',
      household_serving_text: household ? String(household).trim() : null,
      gram_basis: declaredSize,
    };
  }

  // Foundation/FNDDS portions include an explicit gram weight. That relationship
  // is safe to use; otherwise retain the USDA-native 100 g nutrient basis.
  const portion = sourcePortion(food);
  if (portion) return portion;

  return {
    serving_size: 100,
    serving_unit: 'g',
    household_serving_text: null,
    gram_basis: 100,
  };
}

function scaleCoreNutrients(nutrients, grams) {
  const multiplier = grams / 100;
  const scaled = { ...nutrients };
  for (const key of CORE_KEYS) {
    if (scaled[key] != null) scaled[key] = Number(scaled[key]) * multiplier;
  }
  return scaled;
}

export function normalizeFoodRecord(food, forcedSource = null) {
  const sourceType = forcedSource ?? normalizeSourceType(food?.dataType ?? food?.data_type);
  const fdcId = Number(food?.fdcId ?? food?.fdc_id);
  const description = String(food?.description ?? '').trim();
  const nutrientResult = extractNutrients(food);
  const { unitErrors, nutrient_data: rawNutrientData, ...rawNutrients } = nutrientResult;
  const serving = servingInfo(food, sourceType);
  const nutrients = scaleCoreNutrients(rawNutrients, serving.gram_basis);

  return {
    record: {
      fdc_id: Number.isSafeInteger(fdcId) && fdcId > 0 ? fdcId : null,
      source_type: sourceType,
      description,
      brand_owner: food?.brandOwner ? String(food.brandOwner).trim() : null,
      brand_name: food?.brandName ? String(food.brandName).trim() : null,
      gtin_upc: normalizeBarcode(food?.gtinUpc ?? food?.gtin_upc),
      food_category:
        food?.foodCategory?.description ??
        food?.foodCategory ??
        food?.food_category ??
        null,
      serving_size: serving.serving_size,
      serving_unit: serving.serving_unit,
      household_serving_text: serving.household_serving_text,
      ...nutrients,
      nutrient_data: {
        basis: 'per_100_g',
        nutrients: rawNutrientData,
      },
      publication_date: dateOrNull(food?.publicationDate ?? food?.publication_date),
      available_date: dateOrNull(food?.availableDate ?? food?.available_date),
      modified_date: dateOrNull(food?.modifiedDate ?? food?.modified_date),
    },
    unitErrors,
  };
}

export function validateNormalizedRecord(record, { expectedSource = null } = {}) {
  const errors = [];
  if (!Number.isSafeInteger(Number(record?.fdc_id)) || Number(record.fdc_id) <= 0) {
    errors.push('fdc_id must be a positive integer');
  }
  if (!VALID_SOURCES.has(record?.source_type)) errors.push('source_type is invalid');
  if (expectedSource && record?.source_type !== expectedSource) {
    errors.push(`source_type must equal ${expectedSource}`);
  }
  if (!String(record?.description ?? '').trim()) errors.push('description is required');

  for (const key of CORE_KEYS) {
    const value = record?.[key];
    if (value != null && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      errors.push(`${key} must be non-negative when present`);
    }
  }

  if (
    record?.serving_size != null &&
    (!Number.isFinite(Number(record.serving_size)) || Number(record.serving_size) <= 0)
  ) {
    errors.push('serving_size must be greater than zero when present');
  }

  if (record?.gtin_upc != null && !/^\d{6,14}$/.test(String(record.gtin_upc))) {
    errors.push('gtin_upc must contain 6-14 digits when present');
  }
  return errors;
}

export async function* readNdjson(filePath) {
  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
  const reader = readline.createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of reader) {
    lineNumber += 1;
    if (!line.trim()) continue;
    try {
      yield { lineNumber, value: JSON.parse(line) };
    } catch (error) {
      throw new Error(`Invalid JSON on line ${lineNumber}: ${error.message}`);
    }
  }
}

export async function readUsdaJsonRecords(filePath) {
  const raw = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
  if (Array.isArray(raw)) return raw;
  for (const key of ['FoundationFoods', 'FNDDS', 'BrandedFoods', 'foods', 'data']) {
    if (Array.isArray(raw?.[key])) return raw[key];
  }
  throw new Error('Unsupported USDA JSON shape: expected an array or a recognized food array key.');
}

/**
 * Stream USDA bulk JSON without loading multi-gigabyte Branded releases into RAM.
 * Supports a root array and the root array keys used by FDC bulk JSON exports.
 */
export async function* streamUsdaJsonRecords(filePath) {
  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
  const keys = ['FoundationFoods', 'SurveyFoods', 'FNDDS', 'BrandedFoods', 'foods', 'data'];
  let started = false;
  let prefix = '';
  let inString = false;
  let escaped = false;
  let depth = 0;
  let current = '';
  let finished = false;

  for await (const chunk of input) {
    let text = chunk;
    if (!started) {
      prefix += text;
      const trimmed = prefix.trimStart();
      let startIndex = -1;

      if (trimmed.startsWith('[')) {
        startIndex = prefix.indexOf('[');
      } else {
        for (const key of keys) {
          const match = new RegExp(`"${key}"\\s*:\\s*\\[`).exec(prefix);
          if (match) {
            startIndex = match.index + match[0].lastIndexOf('[');
            break;
          }
        }
      }

      if (startIndex < 0) {
        if (prefix.length > 1024 * 1024) {
          throw new Error('Could not locate a recognized USDA food array near the start of the JSON file.');
        }
        continue;
      }

      started = true;
      text = prefix.slice(startIndex + 1);
      prefix = '';
    }

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (depth === 0) {
        if (char === '{') {
          depth = 1;
          current = '{';
          inString = false;
          escaped = false;
        } else if (char === ']') {
          finished = true;
          break;
        }
        continue;
      }

      current += char;
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          yield JSON.parse(current);
          current = '';
        }
      }
    }

    if (finished) break;
  }

  if (!started) throw new Error('USDA JSON array was not found.');
  if (depth !== 0 || current) throw new Error('USDA JSON ended in the middle of a food record.');
}
