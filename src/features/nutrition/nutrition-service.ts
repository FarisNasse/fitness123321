import * as Crypto from 'expo-crypto';

import { reportError } from '@/src/lib/error-reporting';
import {
  db,
  type LocalFoodCache,
  type LocalMealItem,
  type LocalMealLog,
  type LocalWaterLog,
} from '@/src/lib/local-db';
import { markSyncPending } from '@/src/lib/sync-events';
import {
  ALLOW_USDA_DEMO_FALLBACK,
  HAS_REMOTE_SUPABASE_CONFIG,
  LOCAL_DEV_USER_ID,
  USE_REMOTE_NUTRITION_SYNC,
  USE_SUPABASE_FOODS,
  USE_USDA_FOOD_CATALOG,
} from '@/src/lib/runtime-flags';
import type { Food, FoodSource, MealType } from '@/src/types/models';
import {
  MASS_TO_GRAMS,
  VOLUME_TO_ML,
  calculateFoodMultiplier,
  normalizeNutritionUnit as normalizeUnit,
} from './nutrition-unit-math.mjs';
import {
  canonicalizeFdcGtin,
  getFoodDataCentralDetails,
  isValidFdcGtin,
  normalizeFdcBarcode,
  searchFoodDataCentral,
  searchFoodDataCentralByBarcode,
} from '@/supabase/functions/_shared/usda-fdc.mjs';

export type LocalMealLogRow = LocalMealLog;
export type LocalMealItemRow = LocalMealItem;
export type LocalWaterLogRow = LocalWaterLog;

export type DailyMealEntry = LocalMealItemRow & {
  meal_type: MealType;
  logged_at: string;
};

export type DailyNutritionTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
};

export type DailyNutritionSummary = {
  entries: DailyMealEntry[];
  waterLogs: LocalWaterLogRow[];
  totals: DailyNutritionTotals;
};

export type DailyTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  steps: number;
};

export type DailyTargetsState = {
  targets: DailyTargets;
  hasRemoteTargets: boolean;
};

export const DEFAULT_DAILY_TARGETS: DailyTargets = {
  calories: 2000,
  proteinG: 135,
  carbsG: 225,
  fatG: 65,
  waterMl: 2000,
  steps: 8000,
};

type LegacyFoodRow = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_size: number | null;
  serving_unit: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

type CatalogFoodRow = {
  id: string;
  source_type: string;
  fdc_id: number | string | null;
  description: string;
  brand_name: string | null;
  gtin_upc: string | null;
  food_category: string | null;
  serving_size: number | null;
  serving_unit: string | null;
  household_serving_text: string | null;
  nutrition_basis_size?: number | null;
  nutrition_basis_unit?: string | null;
  serving_options?: Array<{
    label: string;
    amount: number;
    unit: string;
    gram_weight?: number | null;
  }> | null;
  publication_date?: string | null;
  available_date?: string | null;
  modified_date?: string | null;
  details_complete?: boolean | null;
  calories: number | null;
  protein_g: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  saturated_fat_g: number | null;
  sodium_mg: number | null;
};

type UserFoodRow = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  category: string | null;
  serving_size: number | null;
  serving_unit: string | null;
  household_serving_text: string | null;
  calories: number | null;
  protein_g: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  saturated_fat_g: number | null;
  sodium_mg: number | null;
};

type DailyTargetsRow = {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  water_ml: number | null;
  steps: number | null;
};

const LEGACY_FOOD_SELECT =
  'id, name, brand, barcode, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g';

const USER_FOOD_SELECT =
  'id, name, brand, barcode, category, serving_size, serving_unit, household_serving_text, calories, protein_g, carbohydrates_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg';

const USDA_SOURCES = new Set<FoodSource>([
  'usda_foundation',
  'usda_fndds',
  'usda_branded',
  'usda_sr_legacy',
  'usda_experimental',
  'usda_other',
]);

function optionalNumber(value: number | string | null | undefined) {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function nullableNumber(value: number | string | null | undefined) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFoodSource(value: string | null | undefined): FoodSource {
  if (value && USDA_SOURCES.has(value as FoodSource)) {
    return value as FoodSource;
  }

  return value === 'restaurant' || value === 'custom' || value === 'legacy'
    ? value
    : 'legacy';
}

function mapLegacyFood(row: LegacyFoodRow): Food {
  return {
    id: row.id,
    source: 'legacy',
    sourceId: row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    barcode: row.barcode ?? undefined,
    servingSize: optionalNumber(row.serving_size),
    servingUnit: row.serving_unit ?? undefined,
    nutritionBasisSize: optionalNumber(row.serving_size) ?? 1,
    nutritionBasisUnit: row.serving_unit ?? 'serving',
    detailsComplete: true,
    calories: nullableNumber(row.calories),
    proteinG: nullableNumber(row.protein_g),
    carbsG: nullableNumber(row.carbs_g),
    fatG: nullableNumber(row.fat_g),
  };
}

function mapCatalogFood(row: CatalogFoodRow, detailsComplete = true): Food {
  return {
    id: row.id,
    source: normalizeFoodSource(row.source_type),
    sourceId: row.id,
    fdcId: optionalNumber(row.fdc_id),
    name: row.description,
    brand: row.brand_name ?? undefined,
    barcode: row.gtin_upc ?? undefined,
    category: row.food_category ?? undefined,
    servingSize: optionalNumber(row.serving_size),
    servingUnit: row.serving_unit ?? undefined,
    householdServingText: row.household_serving_text ?? undefined,
    nutritionBasisSize: optionalNumber(row.nutrition_basis_size) ?? optionalNumber(row.serving_size) ?? 1,
    nutritionBasisUnit: row.nutrition_basis_unit ?? row.serving_unit ?? 'serving',
    servingOptions: Array.isArray(row.serving_options)
      ? row.serving_options.map((option) => ({
          label: option.label,
          amount: Number(option.amount),
          unit: option.unit,
          gramWeight: optionalNumber(option.gram_weight),
        }))
      : undefined,
    detailsComplete: row.details_complete ?? detailsComplete,
    publicationDate: row.publication_date ?? undefined,
    availableDate: row.available_date ?? undefined,
    modifiedDate: row.modified_date ?? undefined,
    calories: nullableNumber(row.calories),
    proteinG: nullableNumber(row.protein_g),
    carbsG: nullableNumber(row.carbohydrates_g),
    fatG: nullableNumber(row.fat_g),
    fiberG: optionalNumber(row.fiber_g),
    sugarG: optionalNumber(row.sugar_g),
    saturatedFatG: optionalNumber(row.saturated_fat_g),
    sodiumMg: optionalNumber(row.sodium_mg),
  };
}

function mapUserFood(row: UserFoodRow): Food {
  return {
    id: row.id,
    source: 'custom',
    sourceId: row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    barcode: row.barcode ?? undefined,
    category: row.category ?? undefined,
    servingSize: optionalNumber(row.serving_size),
    servingUnit: row.serving_unit ?? undefined,
    householdServingText: row.household_serving_text ?? undefined,
    nutritionBasisSize: optionalNumber(row.serving_size) ?? 1,
    nutritionBasisUnit: row.serving_unit ?? 'serving',
    detailsComplete: true,
    calories: nullableNumber(row.calories),
    proteinG: nullableNumber(row.protein_g),
    carbsG: nullableNumber(row.carbohydrates_g),
    fatG: nullableNumber(row.fat_g),
    fiberG: optionalNumber(row.fiber_g),
    sugarG: optionalNumber(row.sugar_g),
    saturatedFatG: optionalNumber(row.saturated_fat_g),
    sodiumMg: optionalNumber(row.sodium_mg),
  };
}

function mapCachedFood(row: LocalFoodCache): Food {
  return {
    id: row.food_id,
    source: normalizeFoodSource(row.source),
    sourceId: row.source_id ?? undefined,
    fdcId: optionalNumber(row.fdc_id),
    name: row.name,
    brand: row.brand ?? undefined,
    barcode: row.barcode ?? undefined,
    category: row.category ?? undefined,
    servingSize: optionalNumber(row.serving_size),
    servingUnit: row.serving_unit ?? undefined,
    householdServingText: row.household_serving_text ?? undefined,
    nutritionBasisSize: optionalNumber(row.nutrition_basis_size) ?? optionalNumber(row.serving_size) ?? 1,
    nutritionBasisUnit: row.nutrition_basis_unit ?? row.serving_unit ?? 'serving',
    detailsComplete: Boolean(row.details_complete),
    publicationDate: row.publication_date ?? undefined,
    calories: nullableNumber(row.calories),
    proteinG: nullableNumber(row.protein_g),
    carbsG: nullableNumber(row.carbs_g),
    fatG: nullableNumber(row.fat_g),
    fiberG: optionalNumber(row.fiber_g),
    sugarG: optionalNumber(row.sugar_g),
    saturatedFatG: optionalNumber(row.saturated_fat_g),
    sodiumMg: optionalNumber(row.sodium_mg),
  };
}

export function getFoodSourceLabel(food: Food) {
  switch (food.source) {
    case 'usda_foundation':
      return 'USDA Foundation';
    case 'usda_fndds':
      return 'USDA FNDDS';
    case 'usda_branded':
      return 'USDA Branded';
    case 'usda_sr_legacy':
      return 'USDA SR Legacy';
    case 'usda_experimental':
      return 'USDA Experimental';
    case 'usda_other':
      return 'USDA FoodData Central';
    case 'custom':
      return 'Custom';
    case 'restaurant':
      return 'Restaurant';
    default:
      return 'Legacy catalog';
  }
}

export function normalizeFoodBarcode(value: string) {
  return normalizeFdcBarcode(value) ?? '';
}

export function canonicalFoodBarcode(value: string) {
  return canonicalizeFdcGtin(value) ?? '';
}

export function isValidFoodBarcode(value: string) {
  return isValidFdcGtin(value);
}

function cacheFoodLocally(food: Food, userId: string, lastUsedAt: string | null = null) {
  // The existing SQLite cache columns are NOT NULL for core macros. More importantly,
  // an incomplete/unknown nutrient must never be persisted as an apparent zero.
  if (
    food.detailsComplete === false ||
    food.calories == null ||
    food.proteinG == null ||
    food.carbsG == null ||
    food.fatG == null
  ) {
    return;
  }

  const cachedAt = new Date().toISOString();
  db.runSync(
    `
    insert into food_cache_local (
      food_id, user_id, source, source_id, fdc_id, name, brand, barcode, category,
      serving_size, serving_unit, household_serving_text, nutrition_basis_size,
      nutrition_basis_unit, details_complete, publication_date, calories, protein_g,
      carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg,
      last_used_at, cached_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(food_id) do update set
      user_id = excluded.user_id,
      source = excluded.source,
      source_id = excluded.source_id,
      fdc_id = excluded.fdc_id,
      name = excluded.name,
      brand = excluded.brand,
      barcode = excluded.barcode,
      category = excluded.category,
      serving_size = excluded.serving_size,
      serving_unit = excluded.serving_unit,
      household_serving_text = excluded.household_serving_text,
      nutrition_basis_size = excluded.nutrition_basis_size,
      nutrition_basis_unit = excluded.nutrition_basis_unit,
      details_complete = excluded.details_complete,
      publication_date = excluded.publication_date,
      calories = excluded.calories,
      protein_g = excluded.protein_g,
      carbs_g = excluded.carbs_g,
      fat_g = excluded.fat_g,
      fiber_g = excluded.fiber_g,
      sugar_g = excluded.sugar_g,
      saturated_fat_g = excluded.saturated_fat_g,
      sodium_mg = excluded.sodium_mg,
      last_used_at = coalesce(excluded.last_used_at, food_cache_local.last_used_at),
      cached_at = excluded.cached_at
    `,
    [
      food.id,
      userId,
      food.source,
      food.sourceId ?? food.id,
      food.fdcId ?? null,
      food.name,
      food.brand ?? null,
      food.barcode ? canonicalFoodBarcode(food.barcode) || null : null,
      food.category ?? null,
      food.servingSize ?? null,
      food.servingUnit ?? null,
      food.householdServingText ?? null,
      food.nutritionBasisSize ?? food.servingSize ?? 1,
      food.nutritionBasisUnit ?? food.servingUnit ?? 'serving',
      1,
      food.publicationDate ?? null,
      food.calories,
      food.proteinG,
      food.carbsG,
      food.fatG,
      food.fiberG ?? null,
      food.sugarG ?? null,
      food.saturatedFatG ?? null,
      food.sodiumMg ?? null,
      lastUsedAt,
      cachedAt,
    ]
  );
}

function searchCachedFoodsByName(userId: string, query: string, limit = 25, offset = 0) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  return db
    .getAllSync<LocalFoodCache>(
      `
      select *
      from food_cache_local
      where user_id = ?
        and (lower(name) like ? or lower(coalesce(brand, '')) like ?)
      order by
        case when lower(name) like ? then 0 else 1 end,
        last_used_at desc,
        cached_at desc
      limit ? offset ?
      `,
      [userId, `%${normalized}%`, `%${normalized}%`, `${normalized}%`, limit, offset]
    )
    .map(mapCachedFood);
}

export function getRecentFoods(userId = LOCAL_DEV_USER_ID, limit = 8) {
  return db
    .getAllSync<LocalFoodCache>(
      `
      select *
      from food_cache_local
      where user_id = ? and last_used_at is not null
      order by last_used_at desc
      limit ?
      `,
      [userId, limit]
    )
    .map(mapCachedFood);
}

function getCachedFoodByBarcode(userId: string, barcode: string) {
  const canonical = canonicalFoodBarcode(barcode);
  if (!canonical) return [];
  return db
    .getAllSync<LocalFoodCache>(
      `select * from food_cache_local where user_id = ? and barcode = ? limit 5`,
      [userId, canonical]
    )
    .map(mapCachedFood);
}

function roundMacro(value: number) {
  return Math.round(value * 10) / 10;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getLocalDayRange(date = new Date()) {
  const start = startOfLocalDay(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function getFoodMultiplier(food: Food, quantity: number, unit: string) {
  return calculateFoodMultiplier(food, quantity, unit);
}

function hasMassUnit(unit: string) {
  return Object.prototype.hasOwnProperty.call(MASS_TO_GRAMS, unit);
}

function hasVolumeUnit(unit: string) {
  return Object.prototype.hasOwnProperty.call(VOLUME_TO_ML, unit);
}

export function getDefaultFoodLogAmount(food: Food) {
  const servingUnit = normalizeUnit(food.servingUnit);
  const basisUnit = normalizeUnit(food.nutritionBasisUnit ?? food.servingUnit);
  const servingSize = food.servingSize && food.servingSize > 0 ? food.servingSize : null;

  if (servingSize && (servingUnit === basisUnit ||
      (hasMassUnit(servingUnit) && hasMassUnit(basisUnit)) ||
      (hasVolumeUnit(servingUnit) && hasVolumeUnit(basisUnit)))) {
    return { quantity: servingSize, unit: food.servingUnit ?? food.nutritionBasisUnit ?? 'serving' };
  }

  if (servingSize && hasMassUnit(basisUnit)) {
    const portion = food.servingOptions?.find((option) =>
      normalizeUnit(option.unit) === servingUnit && Number(option.gramWeight) > 0
    );
    if (portion) {
      return { quantity: servingSize, unit: food.servingUnit ?? portion.unit };
    }
  }

  return {
    quantity: food.nutritionBasisSize && food.nutritionBasisSize > 0 ? food.nutritionBasisSize : 1,
    unit: food.nutritionBasisUnit ?? food.servingUnit ?? 'serving',
  };
}

export function getAllowedFoodLogUnits(food: Food) {
  const basisUnit = normalizeUnit(food.nutritionBasisUnit ?? food.servingUnit ?? 'serving');
  const units = new Set<string>();

  if (hasMassUnit(basisUnit)) {
    ['g', 'oz', 'lb', 'kg'].forEach((unit) => units.add(unit));
    for (const option of food.servingOptions ?? []) {
      if (Number(option.gramWeight) > 0 && option.unit?.trim()) units.add(option.unit.trim());
    }
    if (food.servingUnit && food.servingOptions?.some((option) =>
      normalizeUnit(option.unit) === normalizeUnit(food.servingUnit) && Number(option.gramWeight) > 0
    )) {
      units.add(food.servingUnit);
    }
    return [...units];
  }

  if (hasVolumeUnit(basisUnit)) {
    ['mL', 'cup', 'tbsp', 'tsp', 'L'].forEach((unit) => units.add(unit));
    return [...units];
  }

  if (food.nutritionBasisUnit) units.add(food.nutritionBasisUnit);
  if (food.servingUnit && normalizeUnit(food.servingUnit) === basisUnit) units.add(food.servingUnit);
  return [...units].filter(Boolean).length > 0 ? [...units] : ['serving'];
}

type NutritionLogListener = {
  userId: string;
  listener: () => void;
};

const nutritionLogListeners = new Set<NutritionLogListener>();

export function subscribeToNutritionLogChanges(userId: string, listener: () => void) {
  const registration = { userId, listener };
  nutritionLogListeners.add(registration);

  return () => {
    nutritionLogListeners.delete(registration);
  };
}

function notifyNutritionLogChanged(userId: string) {
  markSyncPending('nutrition');

  for (const registration of nutritionLogListeners) {
    if (registration.userId === userId) {
      registration.listener();
    }
  }
}

function mapDailyTargets(row: DailyTargetsRow | null | undefined): DailyTargetsState {
  if (!row) {
    return { targets: DEFAULT_DAILY_TARGETS, hasRemoteTargets: false };
  }

  return {
    hasRemoteTargets: true,
    targets: {
      calories: Number(row.calories ?? DEFAULT_DAILY_TARGETS.calories),
      proteinG: Number(row.protein_g ?? DEFAULT_DAILY_TARGETS.proteinG),
      carbsG: Number(row.carbs_g ?? DEFAULT_DAILY_TARGETS.carbsG),
      fatG: Number(row.fat_g ?? DEFAULT_DAILY_TARGETS.fatG),
      waterMl: Number(row.water_ml ?? DEFAULT_DAILY_TARGETS.waterMl),
      steps: Number(row.steps ?? DEFAULT_DAILY_TARGETS.steps),
    },
  };
}

export function calculateLoggedFoodMacros(food: Food, quantity: number, unit: string) {
  if (food.detailsComplete === false) {
    throw new Error('USDA food details must be loaded before logging.');
  }

  const required = [food.calories, food.proteinG, food.carbsG, food.fatG];
  if (required.some((value) => value == null || !Number.isFinite(value))) {
    throw new Error('This food is missing one or more required macronutrients.');
  }

  const multiplier = getFoodMultiplier(food, quantity, unit);
  return {
    calories: roundMacro(Number(food.calories) * multiplier),
    proteinG: roundMacro(Number(food.proteinG) * multiplier),
    carbsG: roundMacro(Number(food.carbsG) * multiplier),
    fatG: roundMacro(Number(food.fatG) * multiplier),
  };
}

export async function getNutritionOwnerUserId() {
  if (!USE_REMOTE_NUTRITION_SYNC) {
    return LOCAL_DEV_USER_ID;
  }

  const { supabase } = await import('@/src/lib/supabase');
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.id) {
    if (error) {
      reportError(error, {
        source: 'nutrition-service',
        operation: 'resolve-owner',
        domain: 'nutrition',
      });
    }
    throw new Error('Sign in before logging cloud-synced nutrition.');
  }

  return data.user.id;
}

export async function getDailyTargets(): Promise<DailyTargetsState> {
  if (!USE_REMOTE_NUTRITION_SYNC) {
    return { targets: DEFAULT_DAILY_TARGETS, hasRemoteTargets: false };
  }

  const { supabase } = await import('@/src/lib/supabase');
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user?.id) {
    if (authError) {
      reportError(authError, {
        source: 'nutrition-service',
        operation: 'load-daily-target-owner',
        domain: 'nutrition',
      });
    }

    return { targets: DEFAULT_DAILY_TARGETS, hasRemoteTargets: false };
  }

  const { data, error } = await supabase
    .from('daily_targets')
    .select('calories, protein_g, carbs_g, fat_g, water_ml, steps')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (error) {
    reportError(error, {
      source: 'nutrition-service',
      operation: 'load-daily-targets',
      domain: 'nutrition',
      tags: { fallback: 'local-default-targets' },
    });
    return { targets: DEFAULT_DAILY_TARGETS, hasRemoteTargets: false };
  }

  return mapDailyTargets(data as DailyTargetsRow | null);
}

function foodIdentityKey(food: Food) {
  return food.fdcId ? `fdc:${food.fdcId}` : `${food.source}:${food.id}`;
}

function mergeFoodResults(...groups: Food[][]) {
  const seen = new Set<string>();
  const merged: Food[] = [];
  for (const group of groups) {
    for (const food of group) {
      const key = foodIdentityKey(food);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(food);
    }
  }
  return merged;
}

async function importSupabaseClient() {
  const module = await import('@/src/lib/supabase');
  return module.supabase;
}

async function resolveFoodCacheOwnerId(
  supabase?: Awaited<ReturnType<typeof importSupabaseClient>>
) {
  if (!USE_REMOTE_NUTRITION_SYNC) return LOCAL_DEV_USER_ID;
  try {
    const client = supabase ?? await importSupabaseClient();
    const { data } = await client.auth.getUser();
    return data.user?.id ?? LOCAL_DEV_USER_ID;
  } catch {
    return LOCAL_DEV_USER_ID;
  }
}

async function invokeUsdaSearchProxy(
  supabase: Awaited<ReturnType<typeof importSupabaseClient>>,
  query: string,
  limit: number,
  offset: number,
  signal?: AbortSignal
) {
  const pageNumber = Math.floor(offset / limit) + 1;
  const { data, error } = await supabase.functions.invoke('search-usda-foods', {
    body: { action: 'search', query, pageSize: limit, pageNumber },
    signal,
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return ((data?.foods ?? []) as CatalogFoodRow[]).map((row) => mapCatalogFood(row, false));
}

async function invokeUsdaDetailsProxy(
  supabase: Awaited<ReturnType<typeof importSupabaseClient>>,
  fdcId: number,
  signal?: AbortSignal
) {
  const { data, error } = await supabase.functions.invoke('search-usda-foods', {
    body: { action: 'details', fdcId },
    signal,
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (!data?.food) throw new Error('USDA details response did not include a food.');
  return mapCatalogFood(data.food as CatalogFoodRow, true);
}

async function invokeUsdaBarcodeProxy(
  supabase: Awaited<ReturnType<typeof importSupabaseClient>>,
  barcode: string,
  signal?: AbortSignal
) {
  const { data, error } = await supabase.functions.invoke('search-usda-foods', {
    body: { action: 'barcode', barcode },
    signal,
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return ((data?.foods ?? []) as CatalogFoodRow[]).map((row) => mapCatalogFood(row, true));
}

async function searchUsdaDemo(
  query: string,
  limit: number,
  offset: number,
  signal?: AbortSignal
) {
  if (!ALLOW_USDA_DEMO_FALLBACK) return [];
  const pageNumber = Math.floor(offset / limit) + 1;
  const rows = await searchFoodDataCentral({
    query,
    apiKey: 'DEMO_KEY',
    pageSize: limit,
    pageNumber,
    signal,
  });
  return (rows as CatalogFoodRow[]).map((row) => mapCatalogFood(row, false));
}

async function hydrateUsdaDemo(food: Food, signal?: AbortSignal) {
  if (!ALLOW_USDA_DEMO_FALLBACK || !food.fdcId) return food;
  const row = await getFoodDataCentralDetails({
    fdcId: food.fdcId,
    apiKey: 'DEMO_KEY',
    signal,
  });
  return mapCatalogFood(row as CatalogFoodRow, true);
}

async function searchUsdaBarcodeDemo(barcode: string, signal?: AbortSignal) {
  if (!ALLOW_USDA_DEMO_FALLBACK) return [];
  const rows = await searchFoodDataCentralByBarcode({ barcode, apiKey: 'DEMO_KEY', signal });
  return (rows as CatalogFoodRow[]).map((row) => mapCatalogFood(row, true));
}

function usesUsdaSearchOperators(query: string) {
  return /\b(?:AND|OR|NOT)\b|\w+\s*:|[()]/i.test(query);
}

export async function hydrateFoodDetails(food: Food, options: { signal?: AbortSignal } = {}) {
  if (!USDA_SOURCES.has(food.source) || food.detailsComplete !== false) return food;
  if (!food.fdcId) throw new Error('This USDA search result has no FDC ID.');

  let hydrated: Food;
  if (HAS_REMOTE_SUPABASE_CONFIG) {
    const supabase = await importSupabaseClient();
    hydrated = await invokeUsdaDetailsProxy(supabase, food.fdcId, options.signal);
    const ownerId = await resolveFoodCacheOwnerId(supabase);
    cacheFoodLocally(hydrated, ownerId);
  } else if (ALLOW_USDA_DEMO_FALLBACK) {
    hydrated = await hydrateUsdaDemo(food, options.signal);
    const ownerId = await resolveFoodCacheOwnerId();
    cacheFoodLocally(hydrated, ownerId);
  } else {
    throw new Error('USDA food details are unavailable while offline.');
  }
  return hydrated;
}

export async function searchFoodsByName(
  query: string,
  options: { limit?: number; offset?: number; signal?: AbortSignal } = {}
) {
  const trimmed = query.trim();
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 50);
  const offset = Math.max(options.offset ?? 0, 0);
  if (trimmed.length < 2) return [];

  const advancedQuery = usesUsdaSearchOperators(trimmed);

  if (!USE_SUPABASE_FOODS) {
    if (advancedQuery) {
      throw new Error('Advanced USDA search requires an online FoodData Central connection.');
    }
    return searchCachedFoodsByName(LOCAL_DEV_USER_ID, trimmed, limit, offset);
  }

  if (USE_USDA_FOOD_CATALOG && !HAS_REMOTE_SUPABASE_CONFIG) {
    const ownerId = await resolveFoodCacheOwnerId();
    if (ALLOW_USDA_DEMO_FALLBACK) {
      try {
        const demoFoods = await searchUsdaDemo(trimmed, limit, offset, options.signal);
        const customFoods = offset === 0
          ? searchCachedFoodsByName(ownerId, trimmed, 10, 0).filter((food) => food.source === 'custom')
          : [];
        if (demoFoods.length > 0 || customFoods.length > 0) {
          return mergeFoodResults(customFoods, demoFoods);
        }
      } catch (error) {
        reportError(error, {
          source: 'nutrition-service', operation: 'search-fooddata-central-demo', domain: 'nutrition',
          tags: { fallback: advancedQuery ? 'none' : 'local-food-cache' },
        });
        if (advancedQuery) {
          throw new Error('Advanced USDA search requires an online FoodData Central connection.', { cause: error });
        }
      }
    }
    if (advancedQuery) {
      throw new Error('Advanced USDA search requires an online FoodData Central connection.');
    }
    return searchCachedFoodsByName(ownerId, trimmed, limit, offset);
  }

  const supabase = await importSupabaseClient();
  const ownerId = await resolveFoodCacheOwnerId(supabase);

  if (USE_USDA_FOOD_CATALOG) {
    let customFoods: Food[] = [];
    if (offset === 0) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user?.id) {
          const { data, error } = await supabase
            .from('user_foods')
            .select(USER_FOOD_SELECT)
            .eq('user_id', authData.user.id)
            .ilike('name', `%${trimmed}%`)
            .order('updated_at', { ascending: false })
            .limit(10);
          if (!error) customFoods = ((data ?? []) as UserFoodRow[]).map(mapUserFood);
        }
      } catch (error) {
        reportError(error, {
          source: 'nutrition-service', operation: 'search-custom-foods', domain: 'nutrition',
        });
      }
    }

    try {
      const liveFoods = await invokeUsdaSearchProxy(supabase, trimmed, limit, offset, options.signal);
      return mergeFoodResults(customFoods, liveFoods);
    } catch (liveError) {
      reportError(liveError, {
        source: 'nutrition-service', operation: 'search-fooddata-central-proxy', domain: 'nutrition',
        tags: { fallback: advancedQuery ? 'none' : 'local-usda-catalog' },
      });

      if (advancedQuery) {
        if (customFoods.length > 0) return customFoods;
        throw new Error('Advanced USDA search is temporarily unavailable.', { cause: liveError });
      }

      try {
        const { data, error } = await supabase.rpc('search_food_catalog', {
          search_query: trimmed,
          result_limit: limit,
          result_offset: offset,
        });
        if (error) throw error;
        const catalogFoods = ((data ?? []) as CatalogFoodRow[]).map((row) => mapCatalogFood(row, true));
        for (const food of catalogFoods) cacheFoodLocally(food, ownerId);
        if (catalogFoods.length > 0 || customFoods.length > 0) {
          return mergeFoodResults(customFoods, catalogFoods);
        }
      } catch (catalogError) {
        reportError(catalogError, {
          source: 'nutrition-service', operation: 'search-local-usda-catalog', domain: 'nutrition',
          tags: { fallback: 'local-food-cache' },
        });
      }

      const cached = searchCachedFoodsByName(ownerId, trimmed, limit, offset);
      if (cached.length > 0 || customFoods.length > 0) return mergeFoodResults(customFoods, cached);
      throw new Error('Food search is temporarily unavailable.', { cause: liveError });
    }
  }

  const { data, error } = await supabase
    .from('foods')
    .select(LEGACY_FOOD_SELECT)
    .ilike('name', `%${trimmed}%`)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    reportError(error, { source: 'nutrition-service', operation: 'search-foods', domain: 'nutrition' });
    const cached = searchCachedFoodsByName(ownerId, trimmed, limit, offset);
    if (cached.length > 0) return cached;
    throw new Error('Food search is temporarily unavailable.');
  }

  const results = ((data ?? []) as LegacyFoodRow[]).map(mapLegacyFood);
  for (const food of results) cacheFoodLocally(food, ownerId);
  return results;
}

export async function searchFoodByBarcode(
  input: string,
  options: { signal?: AbortSignal } = {}
) {
  const barcode = normalizeFoodBarcode(input);
  const canonical = canonicalFoodBarcode(input);
  if (!barcode || !canonical || !isValidFoodBarcode(barcode)) return [];

  const ownerId = await resolveFoodCacheOwnerId();
  if (!USE_SUPABASE_FOODS) return getCachedFoodByBarcode(ownerId, canonical);

  if (USE_USDA_FOOD_CATALOG && !HAS_REMOTE_SUPABASE_CONFIG) {
    if (ALLOW_USDA_DEMO_FALLBACK) {
      try {
        const demoFoods = await searchUsdaBarcodeDemo(barcode, options.signal);
        for (const food of demoFoods) cacheFoodLocally(food, ownerId);
        if (demoFoods.length > 0) return demoFoods;
      } catch (error) {
        reportError(error, {
          source: 'nutrition-service', operation: 'search-fooddata-central-barcode-demo', domain: 'nutrition',
          tags: { fallback: 'local-food-cache' },
        });
      }
    }
    return getCachedFoodByBarcode(ownerId, canonical);
  }

  const supabase = await importSupabaseClient();
  const resolvedOwnerId = await resolveFoodCacheOwnerId(supabase);

  if (USE_USDA_FOOD_CATALOG) {
    let customFoods: Food[] = [];
    let liveFoods: Food[] = [];
    let catalogFoods: Food[] = [];
    const barcodeVariants = [...new Set([barcode, canonical, canonical.replace(/^0+/, '')].filter(Boolean))];

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user?.id) {
        const { data, error } = await supabase
          .from('user_foods')
          .select(USER_FOOD_SELECT)
          .eq('user_id', authData.user.id)
          .in('barcode', barcodeVariants)
          .limit(5);
        if (!error) customFoods = ((data ?? []) as UserFoodRow[]).map(mapUserFood);
      }
    } catch (error) {
      reportError(error, {
        source: 'nutrition-service', operation: 'search-custom-food-barcode', domain: 'nutrition',
      });
    }

    try {
      liveFoods = await invokeUsdaBarcodeProxy(supabase, barcode, options.signal);
    } catch (error) {
      reportError(error, {
        source: 'nutrition-service', operation: 'search-fooddata-central-barcode-proxy', domain: 'nutrition',
        tags: { fallback: 'local-usda-catalog' },
      });
    }

    try {
      const { data, error } = await supabase.rpc('search_food_by_barcode', {
        input_barcode: canonical,
      });
      if (error) throw error;
      catalogFoods = ((data ?? []) as CatalogFoodRow[]).map((row) => mapCatalogFood(row, true));
    } catch (error) {
      reportError(error, {
        source: 'nutrition-service', operation: 'search-catalog-barcode', domain: 'nutrition',
      });
    }

    const results = mergeFoodResults(customFoods, liveFoods, catalogFoods).slice(0, 5);
    for (const food of results) cacheFoodLocally(food, resolvedOwnerId);
    if (results.length > 0) return results;
    return getCachedFoodByBarcode(resolvedOwnerId, canonical);
  }

  const { data, error } = await supabase
    .from('foods')
    .select(LEGACY_FOOD_SELECT)
    .in('barcode', [barcode, canonical])
    .limit(5);
  if (error) return getCachedFoodByBarcode(resolvedOwnerId, canonical);
  const results = ((data ?? []) as LegacyFoodRow[]).map(mapLegacyFood);
  for (const food of results) cacheFoodLocally(food, resolvedOwnerId);
  return results;
}

export async function createFood(input: {
  name: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
  barcode?: string;
}) {
  if (input.barcode && !isValidFoodBarcode(input.barcode)) {
    throw new Error('Barcode must be a valid GTIN-8, UPC-A/GTIN-12, EAN-13, or GTIN-14 with a valid check digit.');
  }

  const storedBarcode = input.barcode ? canonicalFoodBarcode(input.barcode) : undefined;
  const localFood = (): Food => ({
    id: Crypto.randomUUID(),
    source: 'custom',
    name: input.name.trim(),
    barcode: storedBarcode,
    servingSize: input.servingSize,
    servingUnit: input.servingUnit.trim() || 'serving',
    nutritionBasisSize: input.servingSize,
    nutritionBasisUnit: input.servingUnit.trim() || 'serving',
    detailsComplete: true,
    calories: input.calories,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
    fiberG: input.fiberG,
    sugarG: input.sugarG,
    saturatedFatG: input.saturatedFatG,
    sodiumMg: input.sodiumMg,
  });

  if (!USE_SUPABASE_FOODS) {
    const food = localFood();
    cacheFoodLocally(food, LOCAL_DEV_USER_ID);
    return food;
  }

  const { supabase } = await import('@/src/lib/supabase');

  if (USE_USDA_FOOD_CATALOG) {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user?.id) {
      if (authError) {
        reportError(authError, {
          source: 'nutrition-service',
          operation: 'resolve-custom-food-owner',
          domain: 'nutrition',
          tags: { fallback: 'local-custom-food' },
        });
      }
      const food = localFood();
      cacheFoodLocally(food, LOCAL_DEV_USER_ID);
      return food;
    }

    const foodPayload = {
      user_id: authData.user.id,
      name: input.name.trim(),
      barcode: storedBarcode ?? null,
      serving_size: input.servingSize,
      serving_unit: input.servingUnit.trim() || 'serving',
      calories: input.calories,
      protein_g: input.proteinG,
      carbohydrates_g: input.carbsG,
      fat_g: input.fatG,
      fiber_g: input.fiberG ?? null,
      sugar_g: input.sugarG ?? null,
      saturated_fat_g: input.saturatedFatG ?? null,
      sodium_mg: input.sodiumMg ?? null,
    };

    const { data, error } = await supabase
      .from('user_foods')
      .insert(foodPayload)
      .select(USER_FOOD_SELECT)
      .maybeSingle();

    if (error || !data) {
      reportError(error ?? new Error('Food provider returned no created row.'), {
        source: 'nutrition-service',
        operation: 'create-custom-food',
        domain: 'nutrition',
      });
      throw new Error('Food could not be created right now.');
    }

    const food = mapUserFood(data as UserFoodRow);
    cacheFoodLocally(food, authData.user.id);
    return food;
  }

  const foodPayload = {
    name: input.name.trim(),
    serving_size: input.servingSize,
    serving_unit: input.servingUnit.trim() || 'serving',
    calories: input.calories,
    protein_g: input.proteinG,
    carbs_g: input.carbsG,
    fat_g: input.fatG,
  };

  const { data, error } = await supabase
    .from('foods')
    .insert(foodPayload)
    .select(LEGACY_FOOD_SELECT)
    .maybeSingle();

  if (error || !data) {
    reportError(error ?? new Error('Food provider returned no created row.'), {
      source: 'nutrition-service',
      operation: 'create-food',
      domain: 'nutrition',
    });
    throw new Error('Food could not be created right now.');
  }

  const food = mapLegacyFood(data as LegacyFoodRow);
  cacheFoodLocally(food, await resolveFoodCacheOwnerId(supabase));
  return food;
}

async function recordFoodCatalogUse(food: Food) {
  const catalogId = food.sourceId ?? food.id;
  if (
    !USE_USDA_FOOD_CATALOG ||
    !USDA_SOURCES.has(food.source) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(catalogId)
  ) return;

  try {
    const { supabase } = await import('@/src/lib/supabase');
    const { error } = await supabase.rpc('record_food_catalog_use', {
      input_food_id: catalogId,
    });
    if (error) throw error;
  } catch (error) {
    reportError(error, {
      source: 'nutrition-service',
      operation: 'record-food-use',
      domain: 'nutrition',
    });
  }
}

export function addLocalMealItem(input: {
  userId: string;
  mealType: MealType;
  food: Food;
  quantity: number;
  unit: string;
  loggedAt?: string;
}) {
  const mealLogLocalId = Crypto.randomUUID();
  const mealItemLocalId = Crypto.randomUUID();
  const now = new Date().toISOString();
  const loggedAt = input.loggedAt ?? now;
  const multiplier = getFoodMultiplier(input.food, input.quantity, input.unit);
  const macros = calculateLoggedFoodMacros(input.food, input.quantity, input.unit);
  const scaleOptional = (value: number | undefined) =>
    value == null ? null : roundMacro(value * multiplier);
  const legacyFoodId = input.food.source === 'legacy' ? input.food.id : null;

  db.runSync(
    `
    insert into meal_logs_local (
      local_id,
      user_id,
      logged_at,
      meal_type,
      sync_status,
      updated_at
    )
    values (?, ?, ?, ?, 'pending', ?)
    `,
    [mealLogLocalId, input.userId, loggedAt, input.mealType, now]
  );

  db.runSync(
    `
    insert into meal_items_local (
      local_id,
      meal_log_local_id,
      food_id,
      food_source,
      source_food_id,
      fdc_id,
      food_name,
      quantity,
      unit,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
      sugar_g,
      saturated_fat_g,
      sodium_mg,
      sync_status,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `,
    [
      mealItemLocalId,
      mealLogLocalId,
      legacyFoodId,
      input.food.source,
      input.food.sourceId ?? input.food.id,
      input.food.fdcId ?? null,
      input.food.name,
      input.quantity,
      input.unit,
      macros.calories,
      macros.proteinG,
      macros.carbsG,
      macros.fatG,
      scaleOptional(input.food.fiberG),
      scaleOptional(input.food.sugarG),
      scaleOptional(input.food.saturatedFatG),
      scaleOptional(input.food.sodiumMg),
      now,
    ]
  );

  cacheFoodLocally(input.food, input.userId, now);
  void recordFoodCatalogUse(input.food);
  notifyNutritionLogChanged(input.userId);

  return { mealLogLocalId, mealItemLocalId };
}

export function addLocalWaterLog(input: {
  userId: string;
  amountMl: number;
  loggedAt?: string;
}) {
  const localId = Crypto.randomUUID();
  const now = new Date().toISOString();
  const loggedAt = input.loggedAt ?? now;

  db.runSync(
    `
    insert into water_logs_local (
      local_id,
      user_id,
      logged_at,
      amount_ml,
      sync_status,
      updated_at
    )
    values (?, ?, ?, ?, 'pending', ?)
    `,
    [localId, input.userId, loggedAt, input.amountMl, now]
  );

  notifyNutritionLogChanged(input.userId);

  return localId;
}

export function getMealItemsByMealLog(userId: string, mealLogLocalId: string) {
  return db.getAllSync<LocalMealItemRow>(
    `
    select mi.*
    from meal_items_local mi
    join meal_logs_local ml on ml.local_id = mi.meal_log_local_id
    where ml.user_id = ?
      and mi.meal_log_local_id = ?
    order by mi.updated_at asc
    `,
    [userId, mealLogLocalId]
  );
}

export function getDailyNutritionSummary(
  userId: string,
  date = new Date()
): DailyNutritionSummary {
  const { startIso, endIso } = getLocalDayRange(date);
  const mealLogs = db.getAllSync<LocalMealLogRow>(
    `
    select *
    from meal_logs_local
    where user_id = ?
      and logged_at >= ?
      and logged_at < ?
    order by logged_at asc
    `,
    [userId, startIso, endIso]
  );

  const mealLogIds = mealLogs.map((meal) => meal.local_id);
  const mealLookup = new Map(mealLogs.map((meal) => [meal.local_id, meal]));
  const placeholders = mealLogIds.map(() => '?').join(', ');
  const items = mealLogIds.length > 0
    ? db.getAllSync<LocalMealItemRow>(
        `
        select *
        from meal_items_local
        where meal_log_local_id in (${placeholders})
        order by updated_at asc
        `,
        mealLogIds
      )
    : [];

  const entries = items
    .map((item) => {
      const meal = mealLookup.get(item.meal_log_local_id);

      if (!meal) return null;

      return {
        ...item,
        meal_type: meal.meal_type,
        logged_at: meal.logged_at,
      };
    })
    .filter((entry): entry is DailyMealEntry => Boolean(entry));

  const waterLogs = db.getAllSync<LocalWaterLogRow>(
    `
    select *
    from water_logs_local
    where user_id = ?
      and logged_at >= ?
      and logged_at < ?
    order by logged_at asc
    `,
    [userId, startIso, endIso]
  );

  const totals = entries.reduce<DailyNutritionTotals>(
    (current, entry) => ({
      calories: current.calories + Number(entry.calories ?? 0),
      proteinG: current.proteinG + Number(entry.protein_g ?? 0),
      carbsG: current.carbsG + Number(entry.carbs_g ?? 0),
      fatG: current.fatG + Number(entry.fat_g ?? 0),
      waterMl: current.waterMl,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, waterMl: 0 }
  );

  totals.waterMl = waterLogs.reduce(
    (sum, waterLog) => sum + Number(waterLog.amount_ml ?? 0),
    0
  );

  return {
    entries,
    waterLogs,
    totals: {
      calories: Math.round(totals.calories),
      proteinG: roundMacro(totals.proteinG),
      carbsG: roundMacro(totals.carbsG),
      fatG: roundMacro(totals.fatG),
      waterMl: totals.waterMl,
    },
  };
}

function saveMealLogServerId(mealLogLocalId: string, serverId: string) {
  db.runSync(
    `
    update meal_logs_local
    set server_id = ?,
        sync_status = 'pending'
    where local_id = ?
    `,
    [serverId, mealLogLocalId]
  );
}

function clearMealLogServerId(mealLogLocalId: string) {
  db.runSync(
    `
    update meal_logs_local
    set server_id = null,
        sync_status = 'pending'
    where local_id = ?
    `,
    [mealLogLocalId]
  );
}

function markMealLogSynced(mealLogLocalId: string, serverId: string) {
  db.runSync(
    `
    update meal_logs_local
    set server_id = ?,
        sync_status = 'synced'
    where local_id = ?
    `,
    [serverId, mealLogLocalId]
  );
}

function markMealLogFailed(mealLogLocalId: string) {
  db.runSync(
    `
    update meal_logs_local
    set sync_status = 'failed'
    where local_id = ?
    `,
    [mealLogLocalId]
  );
}

function markMealItemSynced(mealItemLocalId: string, serverId: string) {
  db.runSync(
    `
    update meal_items_local
    set server_id = ?,
        sync_status = 'synced'
    where local_id = ?
    `,
    [serverId, mealItemLocalId]
  );
}

function markMealItemFailed(mealItemLocalId: string) {
  db.runSync(
    `
    update meal_items_local
    set sync_status = 'failed'
    where local_id = ?
    `,
    [mealItemLocalId]
  );
}

function markWaterLogSynced(waterLogLocalId: string, serverId: string) {
  db.runSync(
    `
    update water_logs_local
    set server_id = ?,
        sync_status = 'synced'
    where local_id = ?
    `,
    [serverId, waterLogLocalId]
  );
}

function markWaterLogFailed(waterLogLocalId: string) {
  db.runSync(
    `
    update water_logs_local
    set sync_status = 'failed'
    where local_id = ?
    `,
    [waterLogLocalId]
  );
}

let nutritionSyncInFlight: Promise<void> | null = null;
let nutritionSyncRequestedWhileInFlight = false;

async function syncPendingMealLogs(
  supabase: Awaited<typeof import('@/src/lib/supabase')>['supabase'],
  userId: string
) {
  const pendingMealLogs = db.getAllSync<LocalMealLogRow>(
    `
    select *
    from meal_logs_local
    where sync_status in ('pending', 'failed')
      and user_id != ?
      and user_id = ?
    `,
    [LOCAL_DEV_USER_ID, userId]
  );

  for (const mealLog of pendingMealLogs) {
    let serverMealLogId = mealLog.server_id as string | null;

    if (serverMealLogId) {
      const { data, error } = await supabase
        .from('meal_logs')
        .update({
          logged_at: mealLog.logged_at,
          meal_type: mealLog.meal_type,
        })
        .eq('id', serverMealLogId)
        .select('id')
        .maybeSingle();

      if (error) {
        markMealLogFailed(mealLog.local_id);
        continue;
      }

      if (!data?.id) {
        clearMealLogServerId(mealLog.local_id);
        serverMealLogId = null;
      }
    }

    if (!serverMealLogId) {
      const { data, error } = await supabase
        .from('meal_logs')
        .upsert(
          {
            id: mealLog.local_id,
            user_id: mealLog.user_id,
            logged_at: mealLog.logged_at,
            meal_type: mealLog.meal_type,
          },
          { onConflict: 'id' }
        )
        .select('id')
        .maybeSingle();

      if (error || !data?.id) {
        markMealLogFailed(mealLog.local_id);
        continue;
      }

      serverMealLogId = String(data.id);
      saveMealLogServerId(mealLog.local_id, serverMealLogId);
    }

    const itemsToSync = getMealItemsByMealLog(mealLog.user_id, mealLog.local_id).filter(
      (item) => item.sync_status === 'pending' || item.sync_status === 'failed'
    );

    if (itemsToSync.length === 0) {
      markMealLogSynced(mealLog.local_id, serverMealLogId);
      continue;
    }

    const itemRows = itemsToSync.map((item) => {
      const baseRow = {
        id: item.local_id,
        meal_log_id: serverMealLogId,
        food_id: item.food_id,
        food_name: item.food_name,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
      };

      if (!USE_USDA_FOOD_CATALOG) return baseRow;

      return {
        ...baseRow,
        food_source: item.food_source,
        source_food_id: item.source_food_id,
        fdc_id: item.fdc_id,
        fiber_g: item.fiber_g,
        sugar_g: item.sugar_g,
        saturated_fat_g: item.saturated_fat_g,
        sodium_mg: item.sodium_mg,
      };
    });

    const { data: syncedItems, error: itemsError } = await supabase
      .from('meal_items')
      .upsert(itemRows, { onConflict: 'id' })
      .select('id');

    if (itemsError || !Array.isArray(syncedItems)) {
      for (const item of itemsToSync) {
        markMealItemFailed(item.local_id);
      }
      markMealLogFailed(mealLog.local_id);
      continue;
    }

    const syncedItemIds = new Set(
      syncedItems
        .map((item) => (item?.id ? String(item.id) : null))
        .filter((id): id is string => Boolean(id))
    );
    let failedItemCount = 0;

    for (const item of itemsToSync) {
      if (syncedItemIds.has(item.local_id)) {
        markMealItemSynced(item.local_id, item.local_id);
      } else {
        markMealItemFailed(item.local_id);
        failedItemCount += 1;
      }
    }

    if (failedItemCount > 0) {
      markMealLogFailed(mealLog.local_id);
      continue;
    }

    markMealLogSynced(mealLog.local_id, serverMealLogId);
  }
}

async function syncPendingWaterLogs(
  supabase: Awaited<typeof import('@/src/lib/supabase')>['supabase'],
  userId: string
) {
  const pendingWaterLogs = db.getAllSync<LocalWaterLogRow>(
    `
    select *
    from water_logs_local
    where sync_status in ('pending', 'failed')
      and user_id != ?
      and user_id = ?
    `,
    [LOCAL_DEV_USER_ID, userId]
  );

  for (const waterLog of pendingWaterLogs) {
    const { data, error } = await supabase
      .from('water_logs')
      .upsert(
        {
          id: waterLog.local_id,
          user_id: waterLog.user_id,
          logged_at: waterLog.logged_at,
          amount_ml: waterLog.amount_ml,
        },
        { onConflict: 'id' }
      )
      .select('id')
      .maybeSingle();

    if (error || !data?.id) {
      reportError(error ?? new Error('Water log provider returned no row.'), {
        source: 'nutrition-service',
        operation: 'sync-water-log',
        domain: 'nutrition',
      });
      markWaterLogFailed(waterLog.local_id);
      continue;
    }

    markWaterLogSynced(waterLog.local_id, String(data.id));
  }
}

async function syncPendingNutritionLogsImpl() {
  if (!USE_REMOTE_NUTRITION_SYNC) {
    return;
  }

  const { supabase } = await import('@/src/lib/supabase');
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.id) {
    if (error) {
      reportError(error, {
        source: 'nutrition-service',
        operation: 'resolve-sync-owner',
        domain: 'nutrition',
      });
    }
    throw new Error('Sign in before syncing nutrition logs.');
  }

  await syncPendingMealLogs(supabase, data.user.id);
  await syncPendingWaterLogs(supabase, data.user.id);
}

async function drainNutritionSyncQueue() {
  do {
    nutritionSyncRequestedWhileInFlight = false;
    await syncPendingNutritionLogsImpl();
  } while (nutritionSyncRequestedWhileInFlight);
}

export function syncPendingNutritionLogs() {
  if (!USE_REMOTE_NUTRITION_SYNC) {
    return Promise.resolve();
  }

  if (nutritionSyncInFlight) {
    nutritionSyncRequestedWhileInFlight = true;
    return nutritionSyncInFlight;
  }

  nutritionSyncInFlight = drainNutritionSyncQueue().then(
    () => {
      nutritionSyncInFlight = null;
    },
    (error) => {
      nutritionSyncInFlight = null;
      throw error;
    }
  );

  return nutritionSyncInFlight;
}
