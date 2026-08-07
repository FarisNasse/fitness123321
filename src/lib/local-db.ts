import * as SQLite from 'expo-sqlite';
import type { SQLiteBindValue } from 'expo-sqlite';
import { Platform } from 'react-native';

import { LOCAL_DEV_USER_ID } from '@/src/lib/runtime-flags';

export type DbAdapter = {
  execSync: (sql: string) => void;
  runSync: (sql: string, params?: SQLiteBindValue[]) => void;
  getAllSync: <T = unknown>(sql: string, params?: SQLiteBindValue[]) => T[];
};

export type LocalWorkoutSession = {
  local_id: string;
  server_id: string | null;
  user_id: string;
  name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  is_deleted: number;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  updated_at: string;
};

export type LocalWorkoutSessionExercise = {
  local_id: string;
  session_local_id: string;
  exercise_id: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ExerciseTargetLocal = {
  local_id: string;
  user_id: string;
  exercise_id: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  increment_size: number;
  deload_percentage: number;
  sync_status: 'pending' | 'synced' | 'failed';
  updated_at: string;
};

export type LocalWorkoutSet = {
  local_id: string;
  server_id: string | null;
  session_local_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  completed: number;
  is_deleted: number;
  deleted_at: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  updated_at: string;
};

export type LocalMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type LocalMealLog = {
  local_id: string;
  server_id: string | null;
  user_id: string;
  logged_at: string;
  meal_type: LocalMealType;
  sync_status: 'pending' | 'synced' | 'failed';
  updated_at: string;
};

export type LocalMealItem = {
  local_id: string;
  server_id: string | null;
  meal_log_local_id: string;
  food_id: string | null;
  food_name: string;
  quantity: number;
  unit: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sync_status: 'pending' | 'synced' | 'failed';
  updated_at: string;
};

export type LocalWaterLog = {
  local_id: string;
  server_id: string | null;
  user_id: string;
  logged_at: string;
  amount_ml: number;
  sync_status: 'pending' | 'synced' | 'failed';
  updated_at: string;
};

export type LocalBodyMeasurement = {
  local_id: string;
  server_id: string | null;
  user_id: string;
  measured_at: string;
  weight_kg: number;
  body_fat_percent: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  notes: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  updated_at: string;
};

export type LocalWellnessCheckIn = {
  local_id: string;
  server_id: string | null;
  user_id: string;
  check_in_date: string;
  logged_at: string;
  sleep_start: string;
  sleep_end: string;
  mood_score: number;
  stress_score: number;
  energy_score: number;
  steps: number;
  notes: string | null;
  sync_status: 'pending' | 'synced' | 'failed';
  updated_at: string;
};

type WebStore = {
  workout_sessions_local: Record<string, unknown>[];
  workout_session_exercises_local: Record<string, unknown>[];
  exercise_targets_local: Record<string, unknown>[];
  workout_sets_local: Record<string, unknown>[];
  meal_logs_local: Record<string, unknown>[];
  meal_items_local: Record<string, unknown>[];
  water_logs_local: Record<string, unknown>[];
  mood_logs_local: Record<string, unknown>[];
  body_measurements_local: Record<string, unknown>[];
};

const WEB_DB_STORAGE_KEY = 'fitness-app-web-db-v1';

function createNativeDbAdapter(): DbAdapter {
  const sqliteDb = SQLite.openDatabaseSync('fitness.db');

  return {
    execSync(sql) {
      sqliteDb.execSync(sql);
    },

    runSync(sql, params = []) {
      sqliteDb.runSync(sql, params);
    },

    getAllSync<T = unknown>(sql: string, params: SQLiteBindValue[] = []) {
      return sqliteDb.getAllSync<T>(sql, params);
    },
  };
}

function createEmptyWebStore(): WebStore {
  return {
    workout_sessions_local: [],
    workout_session_exercises_local: [],
    exercise_targets_local: [],
    workout_sets_local: [],
    meal_logs_local: [],
    meal_items_local: [],
    water_logs_local: [],
    mood_logs_local: [],
    body_measurements_local: [],
  };
}

function readWebStore(): WebStore {
  if (typeof localStorage === 'undefined') {
    return createEmptyWebStore();
  }

  const raw = localStorage.getItem(WEB_DB_STORAGE_KEY);

  if (!raw) {
    const empty = createEmptyWebStore();
    localStorage.setItem(WEB_DB_STORAGE_KEY, JSON.stringify(empty));
    return empty;
  }

  try {
    const parsed = {
      ...createEmptyWebStore(),
      ...JSON.parse(raw),
    } as WebStore;

    parsed.exercise_targets_local = parsed.exercise_targets_local.map((target) => ({
      ...target,
      user_id: target.user_id || LOCAL_DEV_USER_ID,
    }));

    return parsed;
  } catch {
    const empty = createEmptyWebStore();
    localStorage.setItem(WEB_DB_STORAGE_KEY, JSON.stringify(empty));
    return empty;
  }
}

function writeWebStore(store: WebStore) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(WEB_DB_STORAGE_KEY, JSON.stringify(store));
}

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isDeletedRecord(record: Record<string, unknown>) {
  return (
    Boolean(record.deleted_at) ||
    record.is_deleted === 1 ||
    record.is_deleted === true ||
    record.is_deleted === '1'
  );
}

function queryExcludesDeleted(normalizedSql: string) {
  return (
    normalizedSql.includes('deleted_at is null') ||
    normalizedSql.includes('is_deleted = 0') ||
    normalizedSql.includes('coalesce(is_deleted, 0) = 0')
  );
}

function createWebDbAdapter(): DbAdapter {
  return {
    execSync() {
      readWebStore();
    },

    runSync(sql, params = []) {
      const normalized = normalizeSql(sql);
      const store = readWebStore();

      if (normalized.startsWith('insert into workout_sessions_local')) {
        const [localId, userId, name, startedAt, updatedAt] = params;

        store.workout_sessions_local.push({
          local_id: localId,
          server_id: null,
          user_id: userId,
          name,
          started_at: startedAt,
          completed_at: null,
          duration_seconds: null,
          notes: null,
          is_deleted: 0,
          deleted_at: null,
          sync_status: 'pending',
          updated_at: updatedAt,
        });

        writeWebStore(store);
        return;
      }

      if (normalized.startsWith('insert or ignore into workout_session_exercises_local')) {
        const [localId, sessionLocalId, exerciseId, sortOrder, createdAt, updatedAt] =
          params;
        const alreadySelected = store.workout_session_exercises_local.some(
          (item) =>
            item.session_local_id === sessionLocalId &&
            item.exercise_id === exerciseId
        );

        if (!alreadySelected) {
          store.workout_session_exercises_local.push({
            local_id: localId,
            session_local_id: sessionLocalId,
            exercise_id: exerciseId,
            sort_order: sortOrder,
            created_at: createdAt,
            updated_at: updatedAt,
          });
        }

        writeWebStore(store);
        return;
      }

      if (normalized.startsWith('insert into exercise_targets_local')) {
        const [
          localId,
          userId,
          exerciseId,
          targetSets,
          repMin,
          repMax,
          incrementSize,
          deloadPercentage,
          updatedAt,
        ] = params;
        const existingTarget = store.exercise_targets_local.find(
          (item) => item.user_id === userId && item.exercise_id === exerciseId
        );
        const targetRow = {
          local_id: existingTarget?.local_id ?? localId,
          user_id: userId,
          exercise_id: exerciseId,
          target_sets: targetSets,
          rep_min: repMin,
          rep_max: repMax,
          increment_size: incrementSize,
          deload_percentage: deloadPercentage,
          sync_status: 'pending',
          updated_at: updatedAt,
        };

        if (existingTarget) {
          Object.assign(existingTarget, targetRow);
        } else {
          store.exercise_targets_local.push(targetRow);
        }

        writeWebStore(store);
        return;
      }

      if (normalized.startsWith('insert into workout_sets_local')) {
        const [
          localId,
          sessionLocalId,
          exerciseId,
          setNumber,
          reps,
          weight,
          updatedAt,
        ] = params;

        store.workout_sets_local.push({
          local_id: localId,
          server_id: null,
          session_local_id: sessionLocalId,
          exercise_id: exerciseId,
          set_number: setNumber,
          reps,
          weight,
          completed: 1,
          is_deleted: 0,
          deleted_at: null,
          sync_status: 'pending',
          updated_at: updatedAt,
        });

        writeWebStore(store);
        return;
      }

      if (normalized.startsWith('insert into meal_logs_local')) {
        const [localId, userId, loggedAt, mealType, updatedAt] = params;

        store.meal_logs_local.push({
          local_id: localId,
          server_id: null,
          user_id: userId,
          logged_at: loggedAt,
          meal_type: mealType,
          sync_status: 'pending',
          updated_at: updatedAt,
        });

        writeWebStore(store);
        return;
      }

      if (normalized.startsWith('insert into meal_items_local')) {
        const [
          localId,
          mealLogLocalId,
          foodId,
          foodName,
          quantity,
          unit,
          calories,
          proteinG,
          carbsG,
          fatG,
          updatedAt,
        ] = params;

        store.meal_items_local.push({
          local_id: localId,
          server_id: null,
          meal_log_local_id: mealLogLocalId,
          food_id: foodId,
          food_name: foodName,
          quantity,
          unit,
          calories,
          protein_g: proteinG,
          carbs_g: carbsG,
          fat_g: fatG,
          sync_status: 'pending',
          updated_at: updatedAt,
        });

        writeWebStore(store);
        return;
      }

      if (normalized.startsWith('insert into water_logs_local')) {
        const [localId, userId, loggedAt, amountMl, updatedAt] = params;

        store.water_logs_local.push({
          local_id: localId,
          server_id: null,
          user_id: userId,
          logged_at: loggedAt,
          amount_ml: amountMl,
          sync_status: 'pending',
          updated_at: updatedAt,
        });

        writeWebStore(store);
        return;
      }

      if (normalized.startsWith('insert into mood_logs_local')) {
        const [
          localId,
          userId,
          checkInDate,
          loggedAt,
          sleepStart,
          sleepEnd,
          moodScore,
          stressScore,
          energyScore,
          steps,
          updatedAt,
        ] = params;

        store.mood_logs_local.push({
          local_id: localId,
          server_id: null,
          user_id: userId,
          check_in_date: checkInDate,
          logged_at: loggedAt,
          sleep_start: sleepStart,
          sleep_end: sleepEnd,
          mood_score: moodScore,
          stress_score: stressScore,
          energy_score: energyScore,
          steps,
          notes: null,
          sync_status: 'pending',
          updated_at: updatedAt,
        });

        writeWebStore(store);
        return;
      }

      if (normalized.startsWith('insert into body_measurements_local')) {
        const hasExplicitServerId = !normalized.includes('values (?, null');
        const values = [...params];
        const localId = values.shift();
        const serverId = hasExplicitServerId ? values.shift() : null;
        const [
          userId,
          measuredAt,
          weightKg,
          bodyFatPercent,
          waistCm,
          hipsCm,
          chestCm,
          armCm,
          thighCm,
          notes,
          updatedAt,
        ] = values;

        store.body_measurements_local.push({
          local_id: localId,
          server_id: serverId,
          user_id: userId,
          measured_at: measuredAt,
          weight_kg: weightKg,
          body_fat_percent: bodyFatPercent,
          waist_cm: waistCm,
          hips_cm: hipsCm,
          chest_cm: chestCm,
          arm_cm: armCm,
          thigh_cm: thighCm,
          notes,
          sync_status: hasExplicitServerId ? 'synced' : 'pending',
          updated_at: updatedAt,
        });

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update body_measurements_local') &&
        normalized.includes('set measured_at = ?')
      ) {
        const [
          measuredAt,
          weightKg,
          bodyFatPercent,
          waistCm,
          hipsCm,
          chestCm,
          armCm,
          thighCm,
          notes,
          serverId,
          updatedAt,
          localId,
        ] = params;
        const measurement = store.body_measurements_local.find(
          (item) => item.local_id === localId
        );

        if (measurement) {
          Object.assign(measurement, {
            measured_at: measuredAt,
            weight_kg: weightKg,
            body_fat_percent: bodyFatPercent,
            waist_cm: waistCm,
            hips_cm: hipsCm,
            chest_cm: chestCm,
            arm_cm: armCm,
            thigh_cm: thighCm,
            notes,
            server_id: serverId,
            sync_status: 'synced',
            updated_at: updatedAt,
          });
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update body_measurements_local') &&
        normalized.includes("set sync_status = 'failed'")
      ) {
        const [localId] = params;
        const measurement = store.body_measurements_local.find(
          (item) => item.local_id === localId
        );

        if (measurement) {
          measurement.sync_status = 'failed';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update body_measurements_local') &&
        normalized.includes('set server_id = ?')
      ) {
        const [serverId, localId] = params;
        const measurement = store.body_measurements_local.find(
          (item) => item.local_id === localId
        );

        if (measurement) {
          measurement.server_id = serverId;
          measurement.sync_status = 'synced';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update workout_sessions_local') &&
        normalized.includes('set completed_at')
      ) {
        const hasOwnerPredicate = normalized.includes('where user_id = ?');
        const [completedAt, durationNow, updatedAt] = params;
        const userId = hasOwnerPredicate ? params[3] : null;
        const sessionLocalId = hasOwnerPredicate ? params[4] : params[3];
        const session = store.workout_sessions_local.find(
          (item) =>
            item.local_id === sessionLocalId &&
            (!hasOwnerPredicate || item.user_id === userId)
        );

        if (session) {
          const startedMs = Date.parse(String(session.started_at));
          const completedMs = Date.parse(String(durationNow));

          session.completed_at = completedAt;
          session.duration_seconds =
            Number.isFinite(startedMs) && Number.isFinite(completedMs)
              ? Math.max(0, Math.round((completedMs - startedMs) / 1000))
              : 0;
          session.sync_status = 'pending';
          session.updated_at = updatedAt;
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update workout_sessions_local') &&
        normalized.includes("set sync_status = 'failed'")
      ) {
        const [sessionLocalId] = params;
        const session = store.workout_sessions_local.find(
          (item) => item.local_id === sessionLocalId
        );

        if (session) {
          session.sync_status = 'failed';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update workout_sessions_local') &&
        normalized.includes("set sync_status = 'pending'") &&
        normalized.includes('updated_at = ?')
      ) {
        const hasOwnerPredicate = normalized.includes('where user_id = ?');
        const [updatedAt] = params;
        const userId = hasOwnerPredicate ? params[1] : null;
        const sessionLocalId = hasOwnerPredicate ? params[2] : params[1];
        const session = store.workout_sessions_local.find(
          (item) =>
            item.local_id === sessionLocalId &&
            (!hasOwnerPredicate || item.user_id === userId)
        );

        if (session) {
          session.sync_status = 'pending';
          session.updated_at = updatedAt;
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update workout_sessions_local') &&
        normalized.includes('is_deleted = 1') &&
        normalized.includes('deleted_at = ?')
      ) {
        const hasOwnerPredicate = normalized.includes('where user_id = ?');
        const [deletedAt, updatedAt] = params;
        const userId = hasOwnerPredicate ? params[2] : null;
        const sessionLocalId = hasOwnerPredicate ? params[3] : params[2];
        const session = store.workout_sessions_local.find(
          (item) =>
            item.local_id === sessionLocalId &&
            (!hasOwnerPredicate || item.user_id === userId)
        );

        if (session) {
          session.is_deleted = 1;
          session.deleted_at = deletedAt;
          session.sync_status = 'pending';
          session.updated_at = updatedAt;
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update workout_sessions_local') &&
        normalized.includes('set server_id = ?')
      ) {
        const [serverId, sessionLocalId] = params;
        const session = store.workout_sessions_local.find(
          (item) => item.local_id === sessionLocalId
        );

        if (session) {
          session.server_id = serverId;
          session.sync_status = normalized.includes("sync_status = 'pending'")
            ? 'pending'
            : 'synced';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update workout_sessions_local') &&
        normalized.includes('set server_id = null')
      ) {
        const [sessionLocalId] = params;
        const session = store.workout_sessions_local.find(
          (item) => item.local_id === sessionLocalId
        );

        if (session) {
          session.server_id = null;
          session.sync_status = 'pending';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update workout_sets_local') &&
        normalized.includes("set sync_status = 'failed'")
      ) {
        const [setLocalId] = params;
        const set = store.workout_sets_local.find(
          (item) => item.local_id === setLocalId
        );

        if (set) {
          set.sync_status = 'failed';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update workout_sets_local') &&
        normalized.includes('where session_local_id = ?') &&
        normalized.includes('deleted_at is null')
      ) {
        const [deletedAt, updatedAt, sessionLocalId] = params;

        for (const set of store.workout_sets_local) {
          if (set.session_local_id === sessionLocalId && !isDeletedRecord(set)) {
            set.is_deleted = 1;
            set.deleted_at = deletedAt;
            set.sync_status = 'pending';
            set.updated_at = updatedAt;
          }
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update workout_sets_local') &&
        normalized.includes('is_deleted = 1') &&
        normalized.includes('deleted_at = ?')
      ) {
        const [deletedAt, updatedAt, setLocalId] = params;
        const set = store.workout_sets_local.find(
          (item) => item.local_id === setLocalId
        );

        if (set) {
          set.is_deleted = 1;
          set.deleted_at = deletedAt;
          set.sync_status = 'pending';
          set.updated_at = updatedAt;
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update workout_sets_local') &&
        normalized.includes('set server_id = ?')
      ) {
        const [serverId, setLocalId] = params;
        const set = store.workout_sets_local.find(
          (item) => item.local_id === setLocalId
        );

        if (set) {
          set.server_id = serverId;
          set.sync_status = 'synced';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update workout_sets_local') &&
        normalized.includes('set reps =')
      ) {
        const [reps, weight, updatedAt, setLocalId] = params;
        const set = store.workout_sets_local.find(
          (item) => item.local_id === setLocalId
        );

        if (set) {
          set.reps = reps;
          set.weight = weight;
          set.sync_status = 'pending';
          set.updated_at = updatedAt;
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update workout_sets_local') &&
        normalized.includes('set set_number =')
      ) {
        const [setNumber, updatedAt, setLocalId] = params;
        const set = store.workout_sets_local.find(
          (item) => item.local_id === setLocalId
        );

        if (set) {
          set.set_number = setNumber;
          set.sync_status = 'pending';
          set.updated_at = updatedAt;
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update meal_logs_local') &&
        normalized.includes("set sync_status = 'failed'")
      ) {
        const [mealLogLocalId] = params;
        const mealLog = store.meal_logs_local.find(
          (item) => item.local_id === mealLogLocalId
        );

        if (mealLog) {
          mealLog.sync_status = 'failed';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update meal_logs_local') &&
        normalized.includes('set server_id = ?')
      ) {
        const [serverId, mealLogLocalId] = params;
        const mealLog = store.meal_logs_local.find(
          (item) => item.local_id === mealLogLocalId
        );

        if (mealLog) {
          mealLog.server_id = serverId;
          mealLog.sync_status = normalized.includes("sync_status = 'pending'")
            ? 'pending'
            : 'synced';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update meal_logs_local') &&
        normalized.includes('set server_id = null')
      ) {
        const [mealLogLocalId] = params;
        const mealLog = store.meal_logs_local.find(
          (item) => item.local_id === mealLogLocalId
        );

        if (mealLog) {
          mealLog.server_id = null;
          mealLog.sync_status = 'pending';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update meal_items_local') &&
        normalized.includes("set sync_status = 'failed'")
      ) {
        const [mealItemLocalId] = params;
        const mealItem = store.meal_items_local.find(
          (item) => item.local_id === mealItemLocalId
        );

        if (mealItem) {
          mealItem.sync_status = 'failed';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update meal_items_local') &&
        normalized.includes('set server_id = ?')
      ) {
        const [serverId, mealItemLocalId] = params;
        const mealItem = store.meal_items_local.find(
          (item) => item.local_id === mealItemLocalId
        );

        if (mealItem) {
          mealItem.server_id = serverId;
          mealItem.sync_status = 'synced';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update water_logs_local') &&
        normalized.includes("set sync_status = 'failed'")
      ) {
        const [waterLogLocalId] = params;
        const waterLog = store.water_logs_local.find(
          (item) => item.local_id === waterLogLocalId
        );

        if (waterLog) {
          waterLog.sync_status = 'failed';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update water_logs_local') &&
        normalized.includes('set server_id = ?')
      ) {
        const [serverId, waterLogLocalId] = params;
        const waterLog = store.water_logs_local.find(
          (item) => item.local_id === waterLogLocalId
        );

        if (waterLog) {
          waterLog.server_id = serverId;
          waterLog.sync_status = 'synced';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update mood_logs_local') &&
        normalized.includes('set logged_at = ?')
      ) {
        const [
          loggedAt,
          sleepStart,
          sleepEnd,
          moodScore,
          stressScore,
          energyScore,
          steps,
          updatedAt,
          localId,
        ] = params;
        const checkIn = store.mood_logs_local.find(
          (item) => item.local_id === localId
        );

        if (checkIn) {
          checkIn.logged_at = loggedAt;
          checkIn.sleep_start = sleepStart;
          checkIn.sleep_end = sleepEnd;
          checkIn.mood_score = moodScore;
          checkIn.stress_score = stressScore;
          checkIn.energy_score = energyScore;
          checkIn.steps = steps;
          checkIn.sync_status = 'pending';
          checkIn.updated_at = updatedAt;
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update mood_logs_local') &&
        normalized.includes("set sync_status = 'failed'")
      ) {
        const [localId] = params;
        const checkIn = store.mood_logs_local.find(
          (item) => item.local_id === localId
        );

        if (checkIn) {
          checkIn.sync_status = 'failed';
        }

        writeWebStore(store);
        return;
      }

      if (
        normalized.startsWith('update mood_logs_local') &&
        normalized.includes('set server_id = ?')
      ) {
        const [serverId, localId] = params;
        const checkIn = store.mood_logs_local.find(
          (item) => item.local_id === localId
        );

        if (checkIn) {
          checkIn.server_id = serverId;
          checkIn.sync_status = 'synced';
        }

        writeWebStore(store);
        return;
      }
    },

    getAllSync<T = unknown>(sql: string, params: SQLiteBindValue[] = []) {
      const normalized = normalizeSql(sql);
      const store = readWebStore();

      if (
        normalized.includes('from workout_session_exercises_local') &&
        normalized.includes('session_local_id = ?')
      ) {
        const hasOwnerJoin = normalized.includes('join workout_sessions_local');
        const userId = hasOwnerJoin ? params[0] : null;
        const sessionLocalId = hasOwnerJoin ? params[1] : params[0];
        const session = store.workout_sessions_local.find(
          (item) => item.local_id === sessionLocalId
        );

        if (
          hasOwnerJoin &&
          (!session || String(session.user_id) !== String(userId) || isDeletedRecord(session))
        ) {
          return [] as T[];
        }

        return store.workout_session_exercises_local
          .filter((item) => item.session_local_id === sessionLocalId)
          .sort(
            (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
          ) as T[];
      }

      if (
        normalized.includes('from exercise_targets_local') &&
        normalized.includes('exercise_id = ?')
      ) {
        const hasOwnerFilter = normalized.includes('user_id = ?');
        const userId = hasOwnerFilter ? params[0] : null;
        const exerciseId = hasOwnerFilter ? params[1] : params[0];

        return store.exercise_targets_local.filter(
          (target) =>
            target.exercise_id === exerciseId &&
            (!hasOwnerFilter || target.user_id === userId)
        ) as T[];
      }

      if (
        normalized.includes('from workout_sets_local ws') &&
        normalized.includes('join workout_sessions_local s') &&
        normalized.includes('ws.exercise_id = ?')
      ) {
        const hasOwnerFilter = normalized.includes('s.user_id = ?');
        const userId = hasOwnerFilter ? params[0] : null;
        const exerciseId = hasOwnerFilter ? params[1] : params[0];
        const latestSession = store.workout_sessions_local
          .filter(
            (session) =>
              Boolean(session.completed_at) &&
              !isDeletedRecord(session) &&
              (!hasOwnerFilter || String(session.user_id) === String(userId))
          )
          .filter((session) =>
            store.workout_sets_local.some(
              (set) =>
                set.session_local_id === session.local_id &&
                set.exercise_id === exerciseId &&
                !isDeletedRecord(set)
            )
          )
          .sort(
            (a, b) =>
              Date.parse(String(b.completed_at ?? b.started_at)) -
              Date.parse(String(a.completed_at ?? a.started_at))
          )[0];

        if (!latestSession) {
          return [] as T[];
        }

        return store.workout_sets_local
          .filter(
            (set) =>
              set.session_local_id === latestSession.local_id &&
              set.exercise_id === exerciseId &&
              !isDeletedRecord(set)
          )
          .sort(
            (a, b) => Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
          ) as T[];
      }

      if (
        normalized.includes('from workout_sets_local') &&
        normalized.includes('group by exercise_id')
      ) {
        const hasOwnerJoin = normalized.includes('join workout_sessions_local');
        const userId = hasOwnerJoin ? params[0] : null;
        const sessionLocalId = hasOwnerJoin ? params[1] : params[0];
        const session = store.workout_sessions_local.find(
          (item) => item.local_id === sessionLocalId
        );
        const seenExerciseIds = new Set<string>();

        if (
          hasOwnerJoin &&
          (!session || String(session.user_id) !== String(userId) || isDeletedRecord(session))
        ) {
          return [] as T[];
        }
        const rows: Record<string, unknown>[] = [];

        for (const set of store.workout_sets_local) {
          const exerciseId = String(set.exercise_id ?? '');

          if (
            set.session_local_id === sessionLocalId &&
            exerciseId &&
            !isDeletedRecord(set) &&
            !seenExerciseIds.has(exerciseId)
          ) {
            seenExerciseIds.add(exerciseId);
            rows.push({ exercise_id: exerciseId });
          }
        }

        return rows as T[];
      }

      if (
        normalized.includes('from workout_sessions_local') &&
        normalized.includes('where local_id = ?')
      ) {
        const hasOwnerFilter = normalized.includes('user_id = ?');
        const userId = hasOwnerFilter ? params[0] : null;
        const sessionLocalId = hasOwnerFilter ? params[1] : params[0];
        const excludeDeleted = queryExcludesDeleted(normalized);

        return store.workout_sessions_local.filter(
          (session) =>
            session.local_id === sessionLocalId &&
            (!hasOwnerFilter || String(session.user_id) === String(userId)) &&
            (!excludeDeleted || !isDeletedRecord(session))
        ) as T[];
      }

      if (
        normalized.includes('from workout_sessions_local') &&
        normalized.includes('sync_status')
      ) {
        const excludedUserId = normalized.includes('user_id != ?')
          ? String(params[0] ?? '')
          : null;
        const includedUserId = normalized.includes('user_id = ?')
          ? String(params[params.length - 1] ?? '')
          : null;

        return store.workout_sessions_local.filter((session) => {
          const hasSyncStatus = ['pending', 'failed'].includes(
            String(session.sync_status)
          );
          const hasPendingChildSet = store.workout_sets_local.some(
            (set) =>
              set.session_local_id === session.local_id &&
              ['pending', 'failed'].includes(String(set.sync_status))
          );
          const hasSyncableOwner =
            (!excludedUserId || String(session.user_id) !== excludedUserId) &&
            (!includedUserId || String(session.user_id) === includedUserId);

          return (hasSyncStatus || hasPendingChildSet) && hasSyncableOwner;
        }) as T[];
      }

      if (
        normalized.includes('from workout_sessions_local') &&
        normalized.includes('order by started_at desc')
      ) {
        const hasUserFilter = normalized.includes('user_id = ?');
        const userId = hasUserFilter ? String(params[0] ?? '') : null;
        const limit = hasUserFilter ? params[1] ?? 5 : params[0] ?? 5;
        const completedOnly = normalized.includes('completed_at is not null');
        const excludeDeleted = queryExcludesDeleted(normalized);

        return [...store.workout_sessions_local]
          .filter((session) => !userId || String(session.user_id) === userId)
          .filter((session) => !completedOnly || Boolean(session.completed_at))
          .filter((session) => !excludeDeleted || !isDeletedRecord(session))
          .sort(
            (a, b) =>
              Date.parse(String(b.started_at)) - Date.parse(String(a.started_at))
          )
          .slice(0, Number(limit)) as T[];
      }

      if (
        normalized.includes('from workout_sets_local ws') &&
        normalized.includes('join workout_sessions_local s') &&
        normalized.includes('ws.session_local_id = ?') &&
        !normalized.includes('ws.exercise_id = ?')
      ) {
        const [userId, sessionLocalId] = params;
        const session = store.workout_sessions_local.find(
          (item) => item.local_id === sessionLocalId && String(item.user_id) === String(userId)
        );

        if (!session || (queryExcludesDeleted(normalized) && isDeletedRecord(session))) {
          return [] as T[];
        }

        const excludeDeleted = queryExcludesDeleted(normalized);
        const syncOnly = normalized.includes("sync_status in ('pending', 'failed')");

        return store.workout_sets_local
          .filter(
            (set) =>
              set.session_local_id === sessionLocalId &&
              (!excludeDeleted || !isDeletedRecord(set)) &&
              (!syncOnly || ['pending', 'failed'].includes(String(set.sync_status)))
          )
          .sort(
            (a, b) => Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
          ) as T[];
      }

      if (
        normalized.includes('from workout_sets_local ws') &&
        normalized.includes('join workout_sessions_local s') &&
        normalized.includes('ws.local_id = ?')
      ) {
        const [userId, setLocalId] = params;
        const set = store.workout_sets_local.find(
          (item) => item.local_id === setLocalId
        );
        const session = set
          ? store.workout_sessions_local.find(
              (item) =>
                item.local_id === set.session_local_id &&
                String(item.user_id) === String(userId)
            )
          : null;

        return set && session ? ([set] as T[]) : ([] as T[]);
      }

      if (
        normalized.includes('from workout_sets_local') &&
        normalized.includes('where local_id = ?')
      ) {
        const [setLocalId] = params;

        return store.workout_sets_local.filter(
          (set) => set.local_id === setLocalId
        ) as T[];
      }

      if (
        normalized.includes('from workout_sets_local') &&
        normalized.includes('session_local_id = ?') &&
        normalized.includes('exercise_id = ?') &&
        normalized.includes('set_number >')
      ) {
        const [sessionLocalId, exerciseId, setNumber] = params;

        return store.workout_sets_local
          .filter(
            (set) =>
              set.session_local_id === sessionLocalId &&
              set.exercise_id === exerciseId &&
              !isDeletedRecord(set) &&
              Number(set.set_number ?? 0) > Number(setNumber ?? 0)
          )
          .sort(
            (a, b) => Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
          ) as T[];
      }

      if (
        normalized.includes('from workout_sets_local') &&
        normalized.includes('session_local_id = ?')
      ) {
        const [sessionLocalId] = params;

        const excludeDeleted = queryExcludesDeleted(normalized);

        return store.workout_sets_local
          .filter(
            (set) =>
              set.session_local_id === sessionLocalId &&
              (!excludeDeleted || !isDeletedRecord(set))
          )
          .sort(
            (a, b) =>
              Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
          ) as T[];
      }

      if (
        normalized.includes('from meal_logs_local') &&
        normalized.includes('sync_status')
      ) {
        const excludedUserId = normalized.includes('user_id != ?')
          ? String(params[0] ?? '')
          : null;
        const includedUserId = normalized.includes('user_id = ?')
          ? String(params[params.length - 1] ?? '')
          : null;

        return store.meal_logs_local.filter((mealLog) => {
          const hasSyncStatus = ['pending', 'failed'].includes(
            String(mealLog.sync_status)
          );
          const hasSyncableOwner =
            (!excludedUserId || String(mealLog.user_id) !== excludedUserId) &&
            (!includedUserId || String(mealLog.user_id) === includedUserId);

          return hasSyncStatus && hasSyncableOwner;
        }) as T[];
      }

      if (
        normalized.includes('from meal_logs_local') &&
        normalized.includes('logged_at >= ?') &&
        normalized.includes('logged_at < ?')
      ) {
        const hasOwnerFilter = normalized.includes('user_id = ?');
        const userId = hasOwnerFilter ? params[0] : null;
        const startIso = hasOwnerFilter ? params[1] : params[0];
        const endIso = hasOwnerFilter ? params[2] : params[1];

        return store.meal_logs_local
          .filter(
            (mealLog) =>
              (!hasOwnerFilter || String(mealLog.user_id) === String(userId)) &&
              String(mealLog.logged_at) >= String(startIso) &&
              String(mealLog.logged_at) < String(endIso)
          )
          .sort(
            (a, b) =>
              Date.parse(String(a.logged_at)) - Date.parse(String(b.logged_at))
          ) as T[];
      }

      if (
        normalized.includes('from meal_items_local') &&
        normalized.includes('meal_log_local_id in')
      ) {
        const mealLogIds = new Set(params.map((param) => String(param)));

        return store.meal_items_local
          .filter((item) => mealLogIds.has(String(item.meal_log_local_id)))
          .sort(
            (a, b) =>
              Date.parse(String(a.updated_at)) - Date.parse(String(b.updated_at))
          ) as T[];
      }

      if (
        normalized.includes('from meal_items_local') &&
        normalized.includes('meal_log_local_id = ?')
      ) {
        const hasOwnerJoin = normalized.includes('join meal_logs_local');
        const userId = hasOwnerJoin ? params[0] : null;
        const mealLogLocalId = hasOwnerJoin ? params[1] : params[0];
        const mealLog = store.meal_logs_local.find(
          (item) => item.local_id === mealLogLocalId
        );

        if (hasOwnerJoin && (!mealLog || String(mealLog.user_id) !== String(userId))) {
          return [] as T[];
        }

        return store.meal_items_local
          .filter((item) => item.meal_log_local_id === mealLogLocalId)
          .sort(
            (a, b) =>
              Date.parse(String(a.updated_at)) - Date.parse(String(b.updated_at))
          ) as T[];
      }

      if (
        normalized.includes('from water_logs_local') &&
        normalized.includes('sync_status')
      ) {
        const excludedUserId = normalized.includes('user_id != ?')
          ? String(params[0] ?? '')
          : null;
        const includedUserId = normalized.includes('user_id = ?')
          ? String(params[params.length - 1] ?? '')
          : null;

        return store.water_logs_local.filter((waterLog) => {
          const hasSyncStatus = ['pending', 'failed'].includes(
            String(waterLog.sync_status)
          );
          const hasSyncableOwner =
            (!excludedUserId || String(waterLog.user_id) !== excludedUserId) &&
            (!includedUserId || String(waterLog.user_id) === includedUserId);

          return hasSyncStatus && hasSyncableOwner;
        }) as T[];
      }

      if (
        normalized.includes('from water_logs_local') &&
        normalized.includes('logged_at >= ?') &&
        normalized.includes('logged_at < ?')
      ) {
        const hasOwnerFilter = normalized.includes('user_id = ?');
        const userId = hasOwnerFilter ? params[0] : null;
        const startIso = hasOwnerFilter ? params[1] : params[0];
        const endIso = hasOwnerFilter ? params[2] : params[1];

        return store.water_logs_local
          .filter(
            (waterLog) =>
              (!hasOwnerFilter || String(waterLog.user_id) === String(userId)) &&
              String(waterLog.logged_at) >= String(startIso) &&
              String(waterLog.logged_at) < String(endIso)
          )
          .sort(
            (a, b) =>
              Date.parse(String(a.logged_at)) - Date.parse(String(b.logged_at))
          ) as T[];
      }

      if (
        normalized.includes('from body_measurements_local') &&
        normalized.includes('where local_id = ?')
      ) {
        const [localId] = params;

        return store.body_measurements_local
          .filter((measurement) => measurement.local_id === localId)
          .slice(0, 1) as T[];
      }

      if (
        normalized.includes('from body_measurements_local') &&
        normalized.includes('sync_status')
      ) {
        const excludedUserId = normalized.includes('user_id != ?')
          ? String(params[0] ?? '')
          : null;
        const includedUserId = normalized.includes('user_id = ?')
          ? String(params[params.length - 1] ?? '')
          : null;

        return store.body_measurements_local
          .filter((measurement) =>
            ['pending', 'failed'].includes(String(measurement.sync_status))
          )
          .filter(
            (measurement) =>
              !excludedUserId || String(measurement.user_id) !== excludedUserId
          )
          .filter(
            (measurement) =>
              !includedUserId || String(measurement.user_id) === includedUserId
          )
          .sort(
            (a, b) =>
              Date.parse(String(a.updated_at)) - Date.parse(String(b.updated_at))
          ) as T[];
      }

      if (
        normalized.includes('from body_measurements_local') &&
        normalized.includes('user_id = ?') &&
        normalized.includes('order by measured_at desc')
      ) {
        const [userId] = params;

        return store.body_measurements_local
          .filter((measurement) => String(measurement.user_id) === String(userId))
          .sort((a, b) => {
            const measuredDifference =
              Date.parse(String(b.measured_at)) - Date.parse(String(a.measured_at));

            if (measuredDifference !== 0) {
              return measuredDifference;
            }

            return Date.parse(String(b.updated_at)) - Date.parse(String(a.updated_at));
          })
          .slice(0, 1) as T[];
      }

      if (
        normalized.includes('from body_measurements_local') &&
        normalized.includes('user_id = ?') &&
        normalized.includes('order by measured_at asc')
      ) {
        const [userId] = params;

        return store.body_measurements_local
          .filter((measurement) => String(measurement.user_id) === String(userId))
          .sort((a, b) => {
            const measuredDifference =
              Date.parse(String(a.measured_at)) - Date.parse(String(b.measured_at));

            if (measuredDifference !== 0) {
              return measuredDifference;
            }

            return Date.parse(String(a.updated_at)) - Date.parse(String(b.updated_at));
          }) as T[];
      }

      if (
        normalized.includes('from mood_logs_local') &&
        normalized.includes('sync_status')
      ) {
        const excludedUserId = normalized.includes('user_id != ?')
          ? String(params[0] ?? '')
          : null;
        const includedUserId = normalized.includes('user_id = ?')
          ? String(params[params.length - 1] ?? '')
          : null;

        return store.mood_logs_local.filter((checkIn) => {
          const hasSyncStatus = ['pending', 'failed'].includes(
            String(checkIn.sync_status)
          );
          const hasSyncableOwner =
            (!excludedUserId || String(checkIn.user_id) !== excludedUserId) &&
            (!includedUserId || String(checkIn.user_id) === includedUserId);

          return hasSyncStatus && hasSyncableOwner;
        }) as T[];
      }

      if (
        normalized.includes('from mood_logs_local') &&
        normalized.includes('user_id = ?') &&
        normalized.includes('check_in_date = ?')
      ) {
        const [userId, checkInDate] = params;

        return store.mood_logs_local
          .filter(
            (checkIn) =>
              String(checkIn.user_id) === String(userId) &&
              String(checkIn.check_in_date) === String(checkInDate)
          )
          .sort(
            (a, b) =>
              Date.parse(String(b.updated_at)) - Date.parse(String(a.updated_at))
          )
          .slice(0, 1) as T[];
      }

      if (
        normalized.includes('from mood_logs_local') &&
        normalized.includes('user_id = ?') &&
        normalized.includes('order by check_in_date desc')
      ) {
        const [userId] = params;

        return store.mood_logs_local
          .filter((checkIn) => String(checkIn.user_id) === String(userId))
          .sort((a, b) => {
            const dateDifference = String(b.check_in_date).localeCompare(
              String(a.check_in_date)
            );

            if (dateDifference !== 0) {
              return dateDifference;
            }

            return Date.parse(String(b.updated_at)) - Date.parse(String(a.updated_at));
          })
          .slice(0, 1) as T[];
      }

      return [] as T[];
    },
  };
}

export const db: DbAdapter =
  Platform.OS === 'web' ? createWebDbAdapter() : createNativeDbAdapter();

export type OwnerSyncBacklog = Record<
  'workouts' | 'nutrition' | 'wellness' | 'progress',
  { pending: number; failed: number }
>;

export function getOwnerSyncBacklog(userId: string): OwnerSyncBacklog {
  if (Platform.OS === 'web') {
    const store = readWebStore();
    const ownedSessionIds = new Set(
      store.workout_sessions_local
        .filter((session) => String(session.user_id) === String(userId))
        .map((session) => String(session.local_id))
    );
    const ownedMealLogIds = new Set(
      store.meal_logs_local
        .filter((mealLog) => String(mealLog.user_id) === String(userId))
        .map((mealLog) => String(mealLog.local_id))
    );

    const countStatuses = (rows: Array<{ sync_status?: unknown }>) => ({
      pending: rows.filter((row) => row.sync_status === 'pending').length,
      failed: rows.filter((row) => row.sync_status === 'failed').length,
    });

    return {
      workouts: countStatuses([
        ...store.workout_sessions_local.filter(
          (session) => String(session.user_id) === String(userId)
        ),
        ...store.workout_sets_local.filter((set) =>
          ownedSessionIds.has(String(set.session_local_id))
        ),
      ]),
      nutrition: countStatuses([
        ...store.meal_logs_local.filter(
          (mealLog) => String(mealLog.user_id) === String(userId)
        ),
        ...store.meal_items_local.filter((item) =>
          ownedMealLogIds.has(String(item.meal_log_local_id))
        ),
        ...store.water_logs_local.filter(
          (waterLog) => String(waterLog.user_id) === String(userId)
        ),
      ]),
      wellness: countStatuses(
        store.mood_logs_local.filter(
          (checkIn) => String(checkIn.user_id) === String(userId)
        )
      ),
      progress: countStatuses(
        store.body_measurements_local.filter(
          (measurement) => String(measurement.user_id) === String(userId)
        )
      ),
    };
  }

  const count = (sql: string, params: SQLiteBindValue[]) =>
    Number(db.getAllSync<{ count: number }>(sql, params)[0]?.count ?? 0);
  const countForStatus = (domainSql: string, status: 'pending' | 'failed') =>
    count(domainSql, [userId, status]);

  const workoutSql = `
    select count(*) as count
    from (
      select ws.sync_status
      from workout_sessions_local ws
      where ws.user_id = ?
      union all
      select sets.sync_status
      from workout_sets_local sets
      join workout_sessions_local sessions
        on sessions.local_id = sets.session_local_id
      where sessions.user_id = ?
    ) owned_rows
    where sync_status = ?
  `;
  const nutritionSql = `
    select count(*) as count
    from (
      select ml.sync_status
      from meal_logs_local ml
      where ml.user_id = ?
      union all
      select mi.sync_status
      from meal_items_local mi
      join meal_logs_local ml on ml.local_id = mi.meal_log_local_id
      where ml.user_id = ?
      union all
      select wl.sync_status
      from water_logs_local wl
      where wl.user_id = ?
    ) owned_rows
    where sync_status = ?
  `;
  const simpleSql = (table: string) => `
    select count(*) as count
    from ${table}
    where user_id = ? and sync_status = ?
  `;

  const countWorkout = (status: 'pending' | 'failed') =>
    count(workoutSql, [userId, userId, status]);
  const countNutrition = (status: 'pending' | 'failed') =>
    count(nutritionSql, [userId, userId, userId, status]);

  return {
    workouts: {
      pending: countWorkout('pending'),
      failed: countWorkout('failed'),
    },
    nutrition: {
      pending: countNutrition('pending'),
      failed: countNutrition('failed'),
    },
    wellness: {
      pending: countForStatus(simpleSql('mood_logs_local'), 'pending'),
      failed: countForStatus(simpleSql('mood_logs_local'), 'failed'),
    },
    progress: {
      pending: countForStatus(simpleSql('body_measurements_local'), 'pending'),
      failed: countForStatus(simpleSql('body_measurements_local'), 'failed'),
    },
  };
}

export function getSetsBySession(userId: string, sessionLocalId: string) {
  return db.getAllSync<LocalWorkoutSet>(
    `
    select ws.*
    from workout_sets_local ws
    join workout_sessions_local s
      on s.local_id = ws.session_local_id
    where s.user_id = ?
      and ws.session_local_id = ?
      and coalesce(s.is_deleted, 0) = 0
      and s.deleted_at is null
      and coalesce(ws.is_deleted, 0) = 0
      and ws.deleted_at is null
    order by ws.set_number asc
    `,
    [userId, sessionLocalId]
  );
}

export function getSetsBySessionForSync(userId: string, sessionLocalId: string) {
  return db.getAllSync<LocalWorkoutSet>(
    `
    select ws.*
    from workout_sets_local ws
    join workout_sessions_local s
      on s.local_id = ws.session_local_id
    where s.user_id = ?
      and ws.session_local_id = ?
      and ws.sync_status in ('pending', 'failed')
    order by ws.set_number asc
    `,
    [userId, sessionLocalId]
  );
}

export function getExercisesBySession(userId: string, sessionLocalId: string) {
  return db.getAllSync<LocalWorkoutSessionExercise>(
    `
    select se.*
    from workout_session_exercises_local se
    join workout_sessions_local s
      on s.local_id = se.session_local_id
    where s.user_id = ?
      and se.session_local_id = ?
      and coalesce(s.is_deleted, 0) = 0
      and s.deleted_at is null
    order by se.sort_order asc
    `,
    [userId, sessionLocalId]
  );
}

export function getExerciseIdsBySessionFromSets(userId: string, sessionLocalId: string) {
  return db.getAllSync<{ exercise_id: string }>(
    `
    select ws.exercise_id
    from workout_sets_local ws
    join workout_sessions_local s
      on s.local_id = ws.session_local_id
    where s.user_id = ?
      and ws.session_local_id = ?
      and coalesce(s.is_deleted, 0) = 0
      and s.deleted_at is null
      and coalesce(ws.is_deleted, 0) = 0
      and ws.deleted_at is null
    group by ws.exercise_id
    order by min(ws.rowid) asc
    `,
    [userId, sessionLocalId]
  );
}

function addMissingLocalColumn(tableName: string, columnSql: string) {
  try {
    db.execSync(`alter table ${tableName} add column ${columnSql};`);
  } catch {
    // SQLite does not support ADD COLUMN IF NOT EXISTS on all targets.
    // Existing installs can safely ignore duplicate-column errors.
  }
}

function migrateExerciseTargetsToOwnerScope() {
  if (Platform.OS === 'web') {
    const store = readWebStore();
    store.exercise_targets_local = store.exercise_targets_local.map((target) => ({
      ...target,
      user_id: target.user_id || LOCAL_DEV_USER_ID,
    }));
    writeWebStore(store);
    return;
  }

  const columns = db.getAllSync<{ name: string }>('pragma table_info(exercise_targets_local);');

  if (columns.some((column) => column.name === 'user_id')) {
    return;
  }

  const legacyOwner = LOCAL_DEV_USER_ID.replace(/'/g, "''");

  db.execSync(`
    alter table exercise_targets_local rename to exercise_targets_local_legacy;

    create table exercise_targets_local (
      local_id text primary key,
      user_id text not null,
      exercise_id text not null,
      target_sets integer not null default 3,
      rep_min integer not null default 8,
      rep_max integer not null default 12,
      increment_size real not null default 5,
      deload_percentage real not null default 10,
      sync_status text not null default 'pending',
      updated_at text not null,
      unique(user_id, exercise_id)
    );

    insert into exercise_targets_local (
      local_id,
      user_id,
      exercise_id,
      target_sets,
      rep_min,
      rep_max,
      increment_size,
      deload_percentage,
      sync_status,
      updated_at
    )
    select
      local_id,
      '${legacyOwner}',
      exercise_id,
      target_sets,
      rep_min,
      rep_max,
      increment_size,
      deload_percentage,
      sync_status,
      updated_at
    from exercise_targets_local_legacy;

    drop table exercise_targets_local_legacy;
  `);
}

export function initializeLocalDb() {
  db.execSync(`
    create table if not exists workout_sessions_local (
      local_id text primary key,
      server_id text,
      user_id text not null,
      name text not null,
      started_at text not null,
      completed_at text,
      duration_seconds integer,
      notes text,
      is_deleted integer not null default 0,
      deleted_at text,
      sync_status text not null default 'pending',
      updated_at text not null
    );

    create table if not exists workout_session_exercises_local (
      local_id text primary key,
      session_local_id text not null,
      exercise_id text not null,
      sort_order integer not null,
      created_at text not null,
      updated_at text not null,
      unique(session_local_id, exercise_id)
    );

    create table if not exists exercise_targets_local (
      local_id text primary key,
      user_id text not null,
      exercise_id text not null,
      target_sets integer not null default 3,
      rep_min integer not null default 8,
      rep_max integer not null default 12,
      increment_size real not null default 5,
      deload_percentage real not null default 10,
      sync_status text not null default 'pending',
      updated_at text not null,
      unique(user_id, exercise_id)
    );

    create table if not exists workout_sets_local (
      local_id text primary key,
      server_id text,
      session_local_id text not null,
      exercise_id text not null,
      set_number integer not null,
      reps integer,
      weight real,
      completed integer default 0,
      is_deleted integer not null default 0,
      deleted_at text,
      sync_status text not null default 'pending',
      updated_at text not null
    );

    create table if not exists meal_logs_local (
      local_id text primary key,
      server_id text,
      user_id text not null,
      logged_at text not null,
      meal_type text not null,
      sync_status text not null default 'pending',
      updated_at text not null
    );

    create table if not exists meal_items_local (
      local_id text primary key,
      server_id text,
      meal_log_local_id text not null,
      food_id text,
      food_name text not null,
      quantity real not null,
      unit text,
      calories real not null default 0,
      protein_g real not null default 0,
      carbs_g real not null default 0,
      fat_g real not null default 0,
      sync_status text not null default 'pending',
      updated_at text not null
    );

    create table if not exists water_logs_local (
      local_id text primary key,
      server_id text,
      user_id text not null,
      logged_at text not null,
      amount_ml integer not null,
      sync_status text not null default 'pending',
      updated_at text not null
    );

    create table if not exists body_measurements_local (
      local_id text primary key,
      server_id text,
      user_id text not null,
      measured_at text not null,
      weight_kg real not null,
      body_fat_percent real,
      waist_cm real,
      hips_cm real,
      chest_cm real,
      arm_cm real,
      thigh_cm real,
      notes text,
      sync_status text not null default 'pending',
      updated_at text not null
    );

    create table if not exists mood_logs_local (
      local_id text primary key,
      server_id text,
      user_id text not null,
      check_in_date text not null,
      logged_at text not null,
      sleep_start text not null,
      sleep_end text not null,
      mood_score integer,
      stress_score integer,
      energy_score integer,
      steps integer not null default 0,
      notes text,
      sync_status text not null default 'pending',
      updated_at text not null
    );

    create index if not exists idx_workout_session_exercises_session
    on workout_session_exercises_local(session_local_id, sort_order);

    create index if not exists idx_workout_sets_session
    on workout_sets_local(session_local_id);

    create index if not exists idx_workout_sessions_active_started
    on workout_sessions_local(is_deleted, started_at desc);

    create index if not exists idx_workout_sets_active_session
    on workout_sets_local(session_local_id, is_deleted, set_number);

    create index if not exists idx_meal_items_meal
    on meal_items_local(meal_log_local_id);

    create index if not exists idx_meal_logs_logged
    on meal_logs_local(logged_at);

    create index if not exists idx_water_logs_logged
    on water_logs_local(logged_at);

    create index if not exists idx_body_measurements_user_measured
    on body_measurements_local(user_id, measured_at);

  `);

  migrateExerciseTargetsToOwnerScope();

  db.execSync(`
    create index if not exists idx_exercise_targets_owner_exercise
    on exercise_targets_local(user_id, exercise_id);
  `);

  addMissingLocalColumn('workout_sessions_local', 'is_deleted integer not null default 0');
  addMissingLocalColumn('workout_sessions_local', 'deleted_at text');
  addMissingLocalColumn('workout_sets_local', 'is_deleted integer not null default 0');
  addMissingLocalColumn('workout_sets_local', 'deleted_at text');
  addMissingLocalColumn('mood_logs_local', 'check_in_date text');
  addMissingLocalColumn('mood_logs_local', 'sleep_start text');
  addMissingLocalColumn('mood_logs_local', 'sleep_end text');
  addMissingLocalColumn('mood_logs_local', 'steps integer not null default 0');

  db.execSync(`
    create unique index if not exists idx_mood_logs_user_date
    on mood_logs_local(user_id, check_in_date);
  `);

  db.execSync(`
    update workout_sessions_local
    set is_deleted = 1
    where deleted_at is not null
      and coalesce(is_deleted, 0) = 0;

    update workout_sets_local
    set is_deleted = 1
    where deleted_at is not null
      and coalesce(is_deleted, 0) = 0;
  `);
}
