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

function notifyWellnessChanged(checkIn: WellnessCheckIn) {
  markSyncPending('wellness');

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
  const existing = getDailyWellnessCheckIn(input.userId, date);
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
        sync_status,
        updated_at
      )
      values (?, null, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, 'pending', ?)
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

function markWellnessCheckInSynced(localId: string, serverId: string) {
  db.runSync(
    `
    update mood_logs_local
    set server_id = ?,
        sync_status = 'synced'
    where local_id = ?
    `,
    [serverId, localId]
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

  if (pendingCheckIns.length === 0) {
    return;
  }

  for (const checkIn of pendingCheckIns) {
    const { data: moodData, error: moodError } = await supabase
      .from('mood_logs')
      .upsert(
        {
          id: checkIn.local_id,
          user_id: checkIn.user_id,
          check_in_date: checkIn.check_in_date,
          logged_at: checkIn.logged_at,
          mood_score: checkIn.mood_score,
          stress_score: checkIn.stress_score,
          energy_score: checkIn.energy_score,
          steps: checkIn.steps,
          notes: checkIn.notes,
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
          id: checkIn.local_id,
          user_id: checkIn.user_id,
          check_in_date: checkIn.check_in_date,
          sleep_start: checkIn.sleep_start,
          sleep_end: checkIn.sleep_end,
          notes: checkIn.notes,
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

    markWellnessCheckInSynced(checkIn.local_id, String(moodData.id));
  }
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
