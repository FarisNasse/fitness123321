import * as Crypto from 'expo-crypto';

import {
  db,
  type LocalMealItem,
  type LocalMealLog,
  type LocalWaterLog,
} from '@/src/lib/local-db';
import {
  LOCAL_DEV_USER_ID,
  USE_REMOTE_NUTRITION_SYNC,
  USE_SUPABASE_FOODS,
} from '@/src/lib/runtime-flags';
import type { Food, MealType } from '@/src/types/models';

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

type FoodRow = {
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

const FOOD_SELECT =
  'id, name, brand, barcode, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g';

function mapFood(row: FoodRow): Food {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    barcode: row.barcode ?? undefined,
    servingSize: row.serving_size ?? undefined,
    servingUnit: row.serving_unit ?? undefined,
    calories: Number(row.calories ?? 0),
    proteinG: Number(row.protein_g ?? 0),
    carbsG: Number(row.carbs_g ?? 0),
    fatG: Number(row.fat_g ?? 0),
  };
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }

  return 'Unknown Supabase error';
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

function normalizeUnit(unit: string | null | undefined) {
  return (unit ?? '').trim().toLowerCase();
}

function getFoodMultiplier(food: Food, quantity: number, unit: string) {
  const servingSize = food.servingSize && food.servingSize > 0 ? food.servingSize : 1;
  const servingUnit = normalizeUnit(food.servingUnit);
  const loggedUnit = normalizeUnit(unit);
  const unitsMatch = !servingUnit || !loggedUnit || servingUnit === loggedUnit;

  return unitsMatch ? quantity / servingSize : quantity;
}

export function calculateLoggedFoodMacros(food: Food, quantity: number, unit: string) {
  const multiplier = getFoodMultiplier(food, quantity, unit);

  return {
    calories: roundMacro(food.calories * multiplier),
    proteinG: roundMacro(food.proteinG * multiplier),
    carbsG: roundMacro(food.carbsG * multiplier),
    fatG: roundMacro(food.fatG * multiplier),
  };
}

export async function getNutritionOwnerUserId() {
  if (!USE_REMOTE_NUTRITION_SYNC) {
    return LOCAL_DEV_USER_ID;
  }

  const { supabase } = await import('@/src/lib/supabase');
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.id) {
    throw new Error('Sign in before logging cloud-synced nutrition.');
  }

  return data.user.id;
}

export async function searchFoodsByName(query: string) {
  const trimmed = query.trim();

  if (!trimmed || !USE_SUPABASE_FOODS) {
    return [];
  }

  const { supabase } = await import('@/src/lib/supabase');
  const { data, error } = await supabase
    .from('foods')
    .select(FOOD_SELECT)
    .ilike('name', `%${trimmed}%`)
    .order('name', { ascending: true })
    .limit(12);

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  return ((data ?? []) as FoodRow[]).map(mapFood);
}

export async function createFood(input: {
  name: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}) {
  const foodPayload = {
    name: input.name.trim(),
    serving_size: input.servingSize,
    serving_unit: input.servingUnit.trim() || 'serving',
    calories: input.calories,
    protein_g: input.proteinG,
    carbs_g: input.carbsG,
    fat_g: input.fatG,
  };

  if (!USE_SUPABASE_FOODS) {
    return mapFood({
      id: Crypto.randomUUID(),
      brand: null,
      barcode: null,
      ...foodPayload,
    });
  }

  const { supabase } = await import('@/src/lib/supabase');
  const { data, error } = await supabase
    .from('foods')
    .insert(foodPayload)
    .select(FOOD_SELECT)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error ? getErrorMessage(error) : 'Food was not created.');
  }

  return mapFood(data as FoodRow);
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
  const macros = calculateLoggedFoodMacros(input.food, input.quantity, input.unit);

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
      food_name,
      quantity,
      unit,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      sync_status,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `,
    [
      mealItemLocalId,
      mealLogLocalId,
      input.food.id,
      input.food.name,
      input.quantity,
      input.unit,
      macros.calories,
      macros.proteinG,
      macros.carbsG,
      macros.fatG,
      now,
    ]
  );

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

  return localId;
}

export function getMealItemsByMealLog(mealLogLocalId: string) {
  return db.getAllSync<LocalMealItemRow>(
    `
    select *
    from meal_items_local
    where meal_log_local_id = ?
    order by updated_at asc
    `,
    [mealLogLocalId]
  );
}

export function getDailyNutritionSummary(date = new Date()): DailyNutritionSummary {
  const { startIso, endIso } = getLocalDayRange(date);
  const mealLogs = db.getAllSync<LocalMealLogRow>(
    `
    select *
    from meal_logs_local
    where logged_at >= ?
      and logged_at < ?
    order by logged_at asc
    `,
    [startIso, endIso]
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
    where logged_at >= ?
      and logged_at < ?
    order by logged_at asc
    `,
    [startIso, endIso]
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

async function syncPendingMealLogs(supabase: Awaited<typeof import('@/src/lib/supabase')>['supabase']) {
  const pendingMealLogs = db.getAllSync<LocalMealLogRow>(
    `
    select *
    from meal_logs_local
    where sync_status in ('pending', 'failed')
      and user_id != ?
    `,
    [LOCAL_DEV_USER_ID]
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

    const itemsToSync = getMealItemsByMealLog(mealLog.local_id).filter(
      (item) => item.sync_status === 'pending' || item.sync_status === 'failed'
    );

    if (itemsToSync.length === 0) {
      markMealLogSynced(mealLog.local_id, serverMealLogId);
      continue;
    }

    const itemRows = itemsToSync.map((item) => ({
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
    }));

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

async function syncPendingWaterLogs(supabase: Awaited<typeof import('@/src/lib/supabase')>['supabase']) {
  const pendingWaterLogs = db.getAllSync<LocalWaterLogRow>(
    `
    select *
    from water_logs_local
    where sync_status in ('pending', 'failed')
      and user_id != ?
    `,
    [LOCAL_DEV_USER_ID]
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
  await syncPendingMealLogs(supabase);
  await syncPendingWaterLogs(supabase);
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
