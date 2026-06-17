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
          set.updated_at = updatedAt;
        }

        writeWebStore(store);
        return;
      }

      if (normalized.startsWith('delete from workout_sets_local')) {
        const [setLocalId] = params;
        store.workout_sets_local = store.workout_sets_local.filter(
          (item) => item.local_id !== setLocalId
        );

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

        return store.workout_sessions_local.filter(
          (session) => session.local_id === sessionLocalId
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
          const hasSyncableOwner =
            !excludedUserId || String(session.user_id) !== excludedUserId;

          return hasSyncStatus && hasSyncableOwner;
        }) as T[];
      }

      if (
        normalized.includes('from workout_sessions_local') &&
        normalized.includes('order by started_at desc')
      ) {
        const [limit = 5] = params;
        const completedOnly = normalized.includes('completed_at is not null');

        return [...store.workout_sessions_local]
          .filter((session) => !completedOnly || Boolean(session.completed_at))
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

        return store.workout_sets_local
          .filter((set) => set.session_local_id === sessionLocalId)
          .sort(
            (a, b) =>
              Number(a.set_number ?? 0) - Number(b.set_number ?? 0)
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
    order by set_number asc
    `,
    [sessionLocalId]
  );
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

    create index if not exists idx_meal_items_meal
    on meal_items_local(meal_log_local_id);
  `);
}
