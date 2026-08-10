import * as Crypto from 'expo-crypto';

import { reportError } from '@/src/lib/error-reporting';
import { db, type LocalWellnessCheckIn } from '@/src/lib/local-db';
import { markSyncPending } from '@/src/lib/sync-events';
import {
  LOCAL_DEV_USER_ID,
  USE_REMOTE_WELLNESS_SYNC,
} from '@/src/lib/runtime-flags';

export type WellnessCheckIn = LocalWellnessCheckIn;

export type SaveWellnessCheckInInput = {
  userId: string;
  date?: Date;
  sleepStart: string;
  sleepEnd: string;
  mood: number;
  stress: number;
  energy: number;
  steps: number;
};

type RemoteMoodRow = {
  id: string;
  user_id: string;
  check_in_date: string;
  logged_at: string;
  mood_score: number;
  stress_score: number;
  energy_score: number;
  steps: number | null;
  notes: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  updated_at: string | null;
};

type RemoteSleepRow = {
  id: string;
  user_id: string;
  check_in_date: string;
  sleep_start: string;
  sleep_end: string;
  notes: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  updated_at: string | null;
};

const REMOTE_WELLNESS_HISTORY_LIMIT = 400;

type WellnessListener = {
  userId: string;
  listener: (checkIn: WellnessCheckIn) => void;
};

const wellnessListeners = new Set<WellnessListener>();

export function subscribeToWellnessChanges(
  userId: string,
  listener: (checkIn: WellnessCheckIn) => void
) {
  const registration = { userId, listener };
  wellnessListeners.add(registration);

  return () => {
    wellnessListeners.delete(registration);
  };
}

function notifyWellnessChanged(checkIn: WellnessCheckIn, markPending = true) {
  if (markPending) markSyncPending('wellness');

  for (const registration of wellnessListeners) {
    if (registration.userId === checkIn.user_id) {
      registration.listener(checkIn);
    }
  }
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function buildSleepWindow(date: Date, bedtime: string, wakeTime: string) {
  const parseTime = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

    if (!match) {
      throw new Error('Use 24-hour time in HH:MM format.');
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error('Use a valid 24-hour time in HH:MM format.');
    }

    return { hours, minutes };
  };

  const startTime = parseTime(bedtime);
  const endTime = parseTime(wakeTime);
  const sleepStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    startTime.hours,
    startTime.minutes,
    0,
    0
  );
  const sleepEnd = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    endTime.hours,
    endTime.minutes,
    0,
    0
  );

  if (sleepEnd <= sleepStart) {
    sleepEnd.setDate(sleepEnd.getDate() + 1);
  }

  return {
    sleepStart: sleepStart.toISOString(),
    sleepEnd: sleepEnd.toISOString(),
  };
}

export function formatTimeInput(iso: string) {
  const date = new Date(iso);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
}

export function getSleepDurationMinutes(sleepStart: string, sleepEnd: string) {
  const startMs = Date.parse(sleepStart);
  const endMs = Date.parse(sleepEnd);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  return Math.round((endMs - startMs) / 60_000);
}

function validateScore(label: string, value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${label} must be between 1 and 5.`);
  }
}

function validateCheckIn(input: SaveWellnessCheckInInput) {
  validateScore('Mood', input.mood);
  validateScore('Stress', input.stress);
  validateScore('Energy', input.energy);

  if (!Number.isInteger(input.steps) || input.steps < 0) {
    throw new Error('Steps must be a whole number of 0 or greater.');
  }

  if (getSleepDurationMinutes(input.sleepStart, input.sleepEnd) <= 0) {
    throw new Error('Sleep end must be after sleep start.');
  }
}

export async function getWellnessOwnerUserId() {
  if (!USE_REMOTE_WELLNESS_SYNC) {
    return LOCAL_DEV_USER_ID;
  }

  const { supabase } = await import('@/src/lib/supabase');
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.id) {
    if (error) {
      reportError(error, {
        source: 'wellness-service',
        operation: 'resolve-owner',
        domain: 'wellness',
      });
    }
    throw new Error('Sign in before logging cloud-synced wellness data.');
  }

  return data.user.id;
}

export function getDailyWellnessCheckIn(
  userId: string,
  date = new Date()
): WellnessCheckIn | null {
  const rows = db.getAllSync<WellnessCheckIn>(
    `
    select *
    from mood_logs_local
    where user_id = ?
      and check_in_date = ?
      and coalesce(is_deleted, 0) = 0
      and deleted_at is null
    order by updated_at desc
    limit 1
    `,
    [userId, getLocalDateKey(date)]
  );

  return rows[0] ?? null;
}

export function getLatestWellnessCheckIn(userId: string): WellnessCheckIn | null {
  const rows = db.getAllSync<WellnessCheckIn>(
    `
    select *
    from mood_logs_local
    where user_id = ?
      and coalesce(is_deleted, 0) = 0
      and deleted_at is null
    order by check_in_date desc, updated_at desc
    limit 1
    `,
    [userId]
  );

  return rows[0] ?? null;
}

export function saveDailyWellnessCheckIn(
  input: SaveWellnessCheckInInput
): WellnessCheckIn {
  validateCheckIn(input);

  const date = input.date ?? new Date();
  const checkInDate = getLocalDateKey(date);
  const existing = findLocalWellnessByDate(input.userId, checkInDate);
  const now = new Date().toISOString();
  const localId = existing?.local_id ?? Crypto.randomUUID();

  if (existing) {
    db.runSync(
      `
      update mood_logs_local
      set logged_at = ?,
          sleep_start = ?,
          sleep_end = ?,
          mood_score = ?,
          stress_score = ?,
          energy_score = ?,
          steps = ?,
          is_deleted = 0,
          deleted_at = null,
          sync_status = 'pending',
          updated_at = ?
      where local_id = ?
      `,
      [
        now,
        input.sleepStart,
        input.sleepEnd,
        input.mood,
        input.stress,
        input.energy,
        input.steps,
        now,
        localId,
      ]
    );
  } else {
    db.runSync(
      `
      insert into mood_logs_local (
        local_id,
        server_id,
        user_id,
        check_in_date,
        logged_at,
        sleep_start,
        sleep_end,
        mood_score,
        stress_score,
        energy_score,
        steps,
        notes,
        is_deleted,
        deleted_at,
        sync_status,
        updated_at
      )
      values (?, null, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, 0, null, 'pending', ?)
      `,
      [
        localId,
        input.userId,
        checkInDate,
        now,
        input.sleepStart,
        input.sleepEnd,
        input.mood,
        input.stress,
        input.energy,
        input.steps,
        now,
      ]
    );
  }

  const saved = getDailyWellnessCheckIn(input.userId, date);

  if (!saved) {
    throw new Error('The wellness check-in could not be read after saving.');
  }

  notifyWellnessChanged(saved);
  return saved;
}

export function deleteDailyWellnessCheckIn(userId: string, date = new Date()) {
  const checkInDate = getLocalDateKey(date);
  const existing = findLocalWellnessByDate(userId, checkInDate);
  if (!existing || existing.is_deleted) return false;

  const now = new Date().toISOString();
  db.runSync(
    `
    update mood_logs_local
    set is_deleted = 1,
        deleted_at = ?,
        sync_status = 'pending',
        updated_at = ?
    where local_id = ? and user_id = ?
    `,
    [now, now, existing.local_id, userId]
  );

  const deleted = findLocalWellnessByDate(userId, checkInDate);
  if (deleted) notifyWellnessChanged(deleted);
  return true;
}

function wellnessTimestamp(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value)) ?? new Date(0).toISOString();
}

function laterTimestamp(...values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? new Date(0).toISOString();
}

function isPendingWellnessRow(row: WellnessCheckIn | null | undefined) {
  return row?.sync_status === 'pending' || row?.sync_status === 'failed';
}

function findLocalWellnessByDate(userId: string, checkInDate: string) {
  return db.getAllSync<WellnessCheckIn>(
    `select * from mood_logs_local where user_id = ? and check_in_date = ? order by updated_at desc limit 1`,
    [userId, checkInDate]
  )[0] ?? null;
}

function importRemoteWellnessPair(
  userId: string,
  checkInDate: string,
  mood: RemoteMoodRow | undefined,
  sleep: RemoteSleepRow | undefined
) {
  const existing = findLocalWellnessByDate(userId, checkInDate);
  if (isPendingWellnessRow(existing)) return;
  if ((!mood || !sleep) && !existing) return;

  const updatedAt = laterTimestamp(
    mood?.updated_at,
    mood?.deleted_at,
    sleep?.updated_at,
    sleep?.deleted_at,
    mood?.logged_at,
    sleep?.sleep_end
  );
  if (existing && Date.parse(updatedAt) < Date.parse(existing.updated_at)) return;

  const deleted = Boolean(mood?.is_deleted || mood?.deleted_at || sleep?.is_deleted || sleep?.deleted_at);
  const localId = existing?.local_id ?? String(mood?.id ?? sleep?.id);
  const fallbackSleepStart = existing?.sleep_start ?? `${checkInDate}T00:00:00.000Z`;
  const fallbackSleepEnd = existing?.sleep_end ?? `${checkInDate}T00:01:00.000Z`;
  db.runSync(
    `
    replace into mood_logs_local (
      local_id, server_id, sleep_server_id, user_id, check_in_date, logged_at,
      sleep_start, sleep_end, mood_score, stress_score, energy_score, steps, notes,
      is_deleted, deleted_at, sync_status, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
    `,
    [
      localId,
      mood?.id ?? existing?.server_id ?? null,
      sleep?.id ?? existing?.sleep_server_id ?? null,
      userId,
      checkInDate,
      mood?.logged_at ?? existing?.logged_at ?? updatedAt,
      sleep?.sleep_start ?? fallbackSleepStart,
      sleep?.sleep_end ?? fallbackSleepEnd,
      mood?.mood_score ?? existing?.mood_score ?? 3,
      mood?.stress_score ?? existing?.stress_score ?? 3,
      mood?.energy_score ?? existing?.energy_score ?? 3,
      mood?.steps ?? existing?.steps ?? 0,
      mood?.notes ?? sleep?.notes ?? existing?.notes ?? null,
      deleted ? 1 : 0,
      deleted ? wellnessTimestamp(mood?.deleted_at, sleep?.deleted_at, updatedAt) : null,
      updatedAt,
    ]
  );
  const saved = findLocalWellnessByDate(userId, checkInDate);
  if (saved && !saved.is_deleted) notifyWellnessChanged(saved, false);
}

async function refreshWellnessCheckInsFromRemoteWithClient(
  userId: string,
  supabase: Awaited<typeof import('@/src/lib/supabase')>['supabase']
) {
  const [{ data: moodData, error: moodError }, { data: sleepData, error: sleepError }] =
    await Promise.all([
      supabase
        .from('mood_logs')
        .select('id, user_id, check_in_date, logged_at, mood_score, stress_score, energy_score, steps, notes, is_deleted, deleted_at, updated_at')
        .eq('user_id', userId)
        .order('check_in_date', { ascending: false })
        .range(0, REMOTE_WELLNESS_HISTORY_LIMIT - 1),
      supabase
        .from('sleep_logs')
        .select('id, user_id, check_in_date, sleep_start, sleep_end, notes, is_deleted, deleted_at, updated_at')
        .eq('user_id', userId)
        .order('check_in_date', { ascending: false })
        .range(0, REMOTE_WELLNESS_HISTORY_LIMIT - 1),
    ]);
  if (moodError) throw moodError;
  if (sleepError) throw sleepError;

  const moods = new Map(
    ((moodData ?? []) as RemoteMoodRow[]).map((row) => [String(row.check_in_date), row])
  );
  const sleeps = new Map(
    ((sleepData ?? []) as RemoteSleepRow[]).map((row) => [String(row.check_in_date), row])
  );
  const dates = new Set([...moods.keys(), ...sleeps.keys()]);
  for (const date of dates) importRemoteWellnessPair(userId, date, moods.get(date), sleeps.get(date));
}

export async function refreshWellnessCheckInsFromRemote(userId: string) {
  if (!USE_REMOTE_WELLNESS_SYNC) return;
  const { supabase } = await import('@/src/lib/supabase');
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId) {
    if (error) reportError(error, { source: 'wellness-service', operation: 'resolve-refresh-owner', domain: 'wellness' });
    throw new Error('Wellness data can only be loaded for the signed-in user.');
  }
  await refreshWellnessCheckInsFromRemoteWithClient(userId, supabase);
}

function markWellnessCheckInSynced(localId: string, serverId: string, sleepServerId: string) {
  db.runSync(
    `
    update mood_logs_local
    set server_id = ?,
        sleep_server_id = ?,
        sync_status = 'synced'
    where local_id = ?
    `,
    [serverId, sleepServerId, localId]
  );
}

function markWellnessCheckInFailed(localId: string) {
  db.runSync(
    `
    update mood_logs_local
    set sync_status = 'failed'
    where local_id = ?
    `,
    [localId]
  );
}

let wellnessSyncInFlight: Promise<void> | null = null;
let wellnessSyncRequestedWhileInFlight = false;

async function syncPendingWellnessCheckInsImpl() {
  if (!USE_REMOTE_WELLNESS_SYNC) {
    return;
  }

  const { supabase } = await import('@/src/lib/supabase');
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.id) {
    if (error) {
      reportError(error, {
        source: 'wellness-service',
        operation: 'resolve-sync-owner',
        domain: 'wellness',
      });
    }
    throw new Error('Sign in before syncing wellness check-ins.');
  }

  const pendingCheckIns = db.getAllSync<WellnessCheckIn>(
    `
    select *
    from mood_logs_local
    where sync_status in ('pending', 'failed')
      and user_id != ?
      and user_id = ?
    order by updated_at asc
    `,
    [LOCAL_DEV_USER_ID, data.user.id]
  );

  for (const checkIn of pendingCheckIns) {
    const { data: moodData, error: moodError } = await supabase
      .from('mood_logs')
      .upsert(
        {
          id: checkIn.server_id ?? checkIn.local_id,
          user_id: checkIn.user_id,
          check_in_date: checkIn.check_in_date,
          logged_at: checkIn.logged_at,
          mood_score: checkIn.mood_score,
          stress_score: checkIn.stress_score,
          energy_score: checkIn.energy_score,
          steps: checkIn.steps,
          notes: checkIn.notes,
          is_deleted: Boolean(checkIn.is_deleted),
          deleted_at: checkIn.deleted_at,
        },
        { onConflict: 'id' }
      )
      .select('id')
      .maybeSingle();

    if (moodError || !moodData?.id) {
      reportError(moodError ?? new Error('Mood provider returned no row.'), {
        source: 'wellness-service',
        operation: 'sync-mood-check-in',
        domain: 'wellness',
      });
      markWellnessCheckInFailed(checkIn.local_id);
      continue;
    }

    const { data: sleepData, error: sleepError } = await supabase
      .from('sleep_logs')
      .upsert(
        {
          id: checkIn.sleep_server_id ?? checkIn.local_id,
          user_id: checkIn.user_id,
          check_in_date: checkIn.check_in_date,
          sleep_start: checkIn.sleep_start,
          sleep_end: checkIn.sleep_end,
          notes: checkIn.notes,
          is_deleted: Boolean(checkIn.is_deleted),
          deleted_at: checkIn.deleted_at,
        },
        { onConflict: 'id' }
      )
      .select('id')
      .maybeSingle();

    if (sleepError || !sleepData?.id) {
      reportError(sleepError ?? new Error('Sleep provider returned no row.'), {
        source: 'wellness-service',
        operation: 'sync-sleep-check-in',
        domain: 'wellness',
      });
      markWellnessCheckInFailed(checkIn.local_id);
      continue;
    }

    markWellnessCheckInSynced(checkIn.local_id, String(moodData.id), String(sleepData.id));
  }

  await refreshWellnessCheckInsFromRemoteWithClient(data.user.id, supabase);
}

async function drainWellnessSyncQueue() {
  do {
    wellnessSyncRequestedWhileInFlight = false;
    await syncPendingWellnessCheckInsImpl();
  } while (wellnessSyncRequestedWhileInFlight);
}

export function syncPendingWellnessCheckIns() {
  if (!USE_REMOTE_WELLNESS_SYNC) {
    return Promise.resolve();
  }

  if (wellnessSyncInFlight) {
    wellnessSyncRequestedWhileInFlight = true;
    return wellnessSyncInFlight;
  }

  wellnessSyncInFlight = drainWellnessSyncQueue().then(
    () => {
      wellnessSyncInFlight = null;
    },
    (error) => {
      wellnessSyncInFlight = null;
      throw error;
    }
  );

  return wellnessSyncInFlight;
}
