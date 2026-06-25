import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export type DbAdapter = {
  execSync: (sql: string) => void;
  runSync: (sql: string, params?: unknown[]) => void;
  getAllSync: <T = unknown>(sql: string, params?: unknown[]) => T[];
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

type WebStore = {
  workout_sessions_local: Record<string, unknown>[];
  workout_sets_local: Record<string, unknown>[];
  meal_logs_local: Record<string, unknown>[];
  meal_items_local: Record<string, unknown>[];
  water_logs_local: Record<string, unknown>[];
  mood_logs_local: Record<string, unknown>[];
};

const WEB_DB_STORAGE_KEY = 'fitness-app-web-db-v1';

function createNativeDbAdapter(): DbAdapter {
  const sqliteDb = SQLite.openDatabaseSync('fitness.db');

  return {
    execSync(sql) {
      sqliteDb.execSync(sql);
    },

    runSync(sql, params = []) {
      (sqliteDb as any).runSync(sql, params);
    },

    getAllSync<T = unknown>(sql: string, params: unknown[] = []) {
      return (sqliteDb as any).getAllSync(sql, params) as T[];
    },
  };
}

function createEmptyWebStore(): WebStore {
  return {
    workout_sessions_local: [],
    workout_sets_local: [],
    meal_logs_local: [],
    meal_items_local: [],
    water_logs_local: [],
    mood_logs_local: [],
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
    return {
      ...createEmptyWebStore(),
      ...JSON.parse(raw),
    };
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

      if (
        normalized.startsWith('update workout_sessions_local') &&
        normalized.includes('set completed_at')
      ) {
        const [completedAt, durationNow, updatedAt, sessionLocalId] = params;
        const session = store.workout_sessions_local.find(
          (item) => item.local_id === sessionLocalId
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
        const [updatedAt, sessionLocalId] = params;
        const session = store.workout_sessions_local.find(
          (item) => item.local_id === sessionLocalId
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
        const [deletedAt, updatedAt, sessionLocalId] = params;
        const session = store.workout_sessions_local.find(
          (item) => item.local_id === sessionLocalId
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
    },

    getAllSync<T = unknown>(sql: string, params: unknown[] = []) {
      const normalized = normalizeSql(sql);
      const store = readWebStore();

      if (
        normalized.includes('from workout_sessions_local') &&
        normalized.includes('where local_id = ?')
      ) {
        const [sessionLocalId] = params;

        const excludeDeleted = queryExcludesDeleted(normalized);

        return store.workout_sessions_local.filter(
          (session) =>
            session.local_id === sessionLocalId &&
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
            !excludedUserId || String(session.user_id) !== excludedUserId;

          return (hasSyncStatus || hasPendingChildSet) && hasSyncableOwner;
        }) as T[];
      }

      if (
        normalized.includes('from workout_sessions_local') &&
        normalized.includes('order by started_at desc')
      ) {
        const [limit = 5] = params;
        const completedOnly = normalized.includes('completed_at is not null');
        const excludeDeleted = queryExcludesDeleted(normalized);

        return [...store.workout_sessions_local]
          .filter((session) => !completedOnly || Boolean(session.completed_at))
          .filter((session) => !excludeDeleted || !isDeletedRecord(session))
          .sort(
            (a, b) =>
              Date.parse(String(b.started_at)) - Date.parse(String(a.started_at))
          )
          .slice(0, Number(limit)) as T[];
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

        return store.meal_logs_local.filter((mealLog) => {
          const hasSyncStatus = ['pending', 'failed'].includes(
            String(mealLog.sync_status)
          );
          const hasSyncableOwner =
            !excludedUserId || String(mealLog.user_id) !== excludedUserId;

          return hasSyncStatus && hasSyncableOwner;
        }) as T[];
      }

      if (
        normalized.includes('from meal_logs_local') &&
        normalized.includes('logged_at >= ?') &&
        normalized.includes('logged_at < ?')
      ) {
        const [startIso, endIso] = params;

        return store.meal_logs_local
          .filter(
            (mealLog) =>
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
        const [mealLogLocalId] = params;

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

        return store.water_logs_local.filter((waterLog) => {
          const hasSyncStatus = ['pending', 'failed'].includes(
            String(waterLog.sync_status)
          );
          const hasSyncableOwner =
            !excludedUserId || String(waterLog.user_id) !== excludedUserId;

          return hasSyncStatus && hasSyncableOwner;
        }) as T[];
      }

      if (
        normalized.includes('from water_logs_local') &&
        normalized.includes('logged_at >= ?') &&
        normalized.includes('logged_at < ?')
      ) {
        const [startIso, endIso] = params;

        return store.water_logs_local
          .filter(
            (waterLog) =>
              String(waterLog.logged_at) >= String(startIso) &&
              String(waterLog.logged_at) < String(endIso)
          )
          .sort(
            (a, b) =>
              Date.parse(String(a.logged_at)) - Date.parse(String(b.logged_at))
          ) as T[];
      }

      return [] as T[];
    },
  };
}

export const db: DbAdapter =
  Platform.OS === 'web' ? createWebDbAdapter() : createNativeDbAdapter();

export function getSetsBySession(sessionLocalId: string) {
  return db.getAllSync<LocalWorkoutSet>(
    `
    select *
    from workout_sets_local
    where session_local_id = ?
      and coalesce(is_deleted, 0) = 0
      and deleted_at is null
    order by set_number asc
    `,
    [sessionLocalId]
  );
}

export function getSetsBySessionForSync(sessionLocalId: string) {
  return db.getAllSync<LocalWorkoutSet>(
    `
    select *
    from workout_sets_local
    where session_local_id = ?
      and sync_status in ('pending', 'failed')
    order by set_number asc
    `,
    [sessionLocalId]
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

    create table if not exists mood_logs_local (
      local_id text primary key,
      server_id text,
      user_id text not null,
      logged_at text not null,
      mood_score integer,
      stress_score integer,
      energy_score integer,
      notes text,
      sync_status text not null default 'pending',
      updated_at text not null
    );

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
  `);

  addMissingLocalColumn('workout_sessions_local', 'is_deleted integer not null default 0');
  addMissingLocalColumn('workout_sessions_local', 'deleted_at text');
  addMissingLocalColumn('workout_sets_local', 'is_deleted integer not null default 0');
  addMissingLocalColumn('workout_sets_local', 'deleted_at text');

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
