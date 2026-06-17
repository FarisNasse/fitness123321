import * as Crypto from 'expo-crypto';

import { db, getSetsBySession, type LocalWorkoutSession } from '@/src/lib/local-db';
import { LOCAL_DEV_USER_ID, USE_REMOTE_WORKOUT_SYNC } from '@/src/lib/runtime-flags';

export type LocalWorkoutSessionRow = LocalWorkoutSession;

export async function getWorkoutOwnerUserId() {
  if (!USE_REMOTE_WORKOUT_SYNC) {
    return LOCAL_DEV_USER_ID;
  }

  const { supabase } = await import('@/src/lib/supabase');
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.id) {
    throw new Error('Sign in before starting a cloud-synced workout.');
  }

  return data.user.id;
}

export function createLocalWorkoutSession(userId: string, name = 'Workout') {
  const localId = Crypto.randomUUID();
  const now = new Date().toISOString();

  db.runSync(
    `
    insert into workout_sessions_local (
      local_id,
      user_id,
      name,
      started_at,
      sync_status,
      updated_at
    )
    values (?, ?, ?, ?, 'pending', ?)
    `,
    [localId, userId, name, now, now]
  );

  return localId;
}

export function getLocalWorkoutSession(sessionLocalId: string) {
  return (
    db.getAllSync<LocalWorkoutSessionRow>(
      `
      select *
      from workout_sessions_local
      where local_id = ?
      limit 1
      `,
      [sessionLocalId]
    )[0] ?? null
  );
}

export function getRecentLocalWorkoutSessions(limit = 5) {
  return db.getAllSync<LocalWorkoutSessionRow>(
    `
    select *
    from workout_sessions_local
    order by started_at desc
    limit ?
    `,
    [limit]
  );
}

export function getLocalWorkoutSets(sessionLocalId: string) {
  return getSetsBySession(sessionLocalId);
}

export function addLocalWorkoutSet(input: {
  sessionLocalId: string;
  exerciseId: string;
  setNumber: number;
  reps?: number;
  weight?: number;
}) {
  const localId = Crypto.randomUUID();
  const now = new Date().toISOString();

  db.runSync(
    `
    insert into workout_sets_local (
      local_id,
      session_local_id,
      exercise_id,
      set_number,
      reps,
      weight,
      completed,
      sync_status,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, 1, 'pending', ?)
    `,
    [
      localId,
      input.sessionLocalId,
      input.exerciseId,
      input.setNumber,
      input.reps ?? null,
      input.weight ?? null,
      now,
    ]
  );

  return localId;
}

export function completeLocalWorkoutSession(sessionLocalId: string) {
  const now = new Date().toISOString();

  db.runSync(
    `
    update workout_sessions_local
    set completed_at = ?,
        duration_seconds = cast((julianday(?) - julianday(started_at)) * 86400 as integer),
        sync_status = 'pending',
        updated_at = ?
    where local_id = ?
    `,
    [now, now, now, sessionLocalId]
  );
}

function saveWorkoutSessionServerId(sessionLocalId: string, serverId: string) {
  db.runSync(
    `
    update workout_sessions_local
    set server_id = ?,
        sync_status = 'pending'
    where local_id = ?
    `,
    [serverId, sessionLocalId]
  );
}

function clearWorkoutSessionServerId(sessionLocalId: string) {
  db.runSync(
    `
    update workout_sessions_local
    set server_id = null,
        sync_status = 'pending'
    where local_id = ?
    `,
    [sessionLocalId]
  );
}

function markWorkoutSessionSynced(sessionLocalId: string, serverId: string) {
  db.runSync(
    `
    update workout_sessions_local
    set server_id = ?,
        sync_status = 'synced'
    where local_id = ?
    `,
    [serverId, sessionLocalId]
  );
}

function markWorkoutSessionFailed(sessionLocalId: string) {
  db.runSync(
    `
    update workout_sessions_local
    set sync_status = 'failed'
    where local_id = ?
    `,
    [sessionLocalId]
  );
}

function markWorkoutSetSynced(setLocalId: string, serverId: string) {
  db.runSync(
    `
    update workout_sets_local
    set server_id = ?,
        sync_status = 'synced'
    where local_id = ?
    `,
    [serverId, setLocalId]
  );
}

function markWorkoutSetFailed(setLocalId: string) {
  db.runSync(
    `
    update workout_sets_local
    set sync_status = 'failed'
    where local_id = ?
    `,
    [setLocalId]
  );
}

let syncInFlight: Promise<void> | null = null;
let syncRequestedWhileInFlight = false;

async function syncPendingWorkoutSessionsImpl() {
  if (!USE_REMOTE_WORKOUT_SYNC) {
    return;
  }

  const { supabase } = await import('@/src/lib/supabase');

  const pendingSessions = db.getAllSync<any>(
    `
    select *
    from workout_sessions_local
    where sync_status in ('pending', 'failed')
    `
  );

  for (const session of pendingSessions) {
    let serverSessionId = session.server_id as string | null;

    if (serverSessionId) {
      const { data, error } = await supabase
        .from('workout_sessions')
        .update({
          name: session.name,
          started_at: session.started_at,
          completed_at: session.completed_at,
          duration_seconds: session.duration_seconds,
          notes: session.notes,
        })
        .eq('id', serverSessionId)
        .select('id')
        .maybeSingle();

      if (error) {
        markWorkoutSessionFailed(session.local_id);
        continue;
      }

      if (!data?.id) {
        // The remote row was deleted or never existed. Clear the stale server_id so
        // this pass can recreate the session with the local id instead of failing forever.
        clearWorkoutSessionServerId(session.local_id);
        serverSessionId = null;
      }
    }

    if (!serverSessionId) {
      const desiredSessionId = String(session.local_id);
      const { data, error } = await supabase
        .from('workout_sessions')
        .upsert(
          {
            id: desiredSessionId,
            user_id: session.user_id,
            name: session.name,
            started_at: session.started_at,
            completed_at: session.completed_at,
            duration_seconds: session.duration_seconds,
            notes: session.notes,
          },
          { onConflict: 'id' }
        )
        .select('id')
        .maybeSingle();

      if (error || !data?.id) {
        markWorkoutSessionFailed(session.local_id);
        continue;
      }

      serverSessionId = String(data.id);
      saveWorkoutSessionServerId(session.local_id, serverSessionId);
    }

    if (!serverSessionId) {
      markWorkoutSessionFailed(session.local_id);
      continue;
    }

    const setsToSync = getSetsBySession(session.local_id).filter(
      (set) => set.sync_status === 'pending' || set.sync_status === 'failed'
    );

    if (setsToSync.length === 0) {
      markWorkoutSessionSynced(session.local_id, serverSessionId);
      continue;
    }

    const setRows = setsToSync.map((set) => ({
      id: set.local_id,
      session_id: serverSessionId,
      exercise_id: set.exercise_id,
      set_number: set.set_number,
      reps: set.reps,
      weight: set.weight,
      completed: Boolean(set.completed),
    }));

    const { data: syncedSets, error: setsError } = await supabase
      .from('workout_sets')
      .upsert(setRows, { onConflict: 'id' })
      .select('id');

    if (setsError || !Array.isArray(syncedSets)) {
      for (const set of setsToSync) {
        markWorkoutSetFailed(set.local_id);
      }
      markWorkoutSessionFailed(session.local_id);
      continue;
    }

    const syncedSetIds = new Set(
      syncedSets
        .map((set) => (set?.id ? String(set.id) : null))
        .filter((id): id is string => Boolean(id))
    );
    let failedSetCount = 0;

    for (const set of setsToSync) {
      if (syncedSetIds.has(set.local_id)) {
        markWorkoutSetSynced(set.local_id, set.local_id);
      } else {
        markWorkoutSetFailed(set.local_id);
        failedSetCount += 1;
      }
    }

    if (failedSetCount > 0) {
      markWorkoutSessionFailed(session.local_id);
      continue;
    }

    markWorkoutSessionSynced(session.local_id, serverSessionId);
  }
}

async function drainWorkoutSyncQueue() {
  do {
    syncRequestedWhileInFlight = false;
    await syncPendingWorkoutSessionsImpl();
  } while (syncRequestedWhileInFlight);
}

export function syncPendingWorkoutSessions() {
  if (!USE_REMOTE_WORKOUT_SYNC) {
    return Promise.resolve();
  }

  if (syncInFlight) {
    syncRequestedWhileInFlight = true;
    return syncInFlight;
  }

  syncInFlight = drainWorkoutSyncQueue().then(
    () => {
      syncInFlight = null;
    },
    (error) => {
      syncInFlight = null;
      throw error;
    }
  );

  return syncInFlight;
}
