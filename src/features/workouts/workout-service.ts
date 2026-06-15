import * as Crypto from 'expo-crypto';

import { db, getSetsBySession } from '@/src/lib/local-db';
import { supabase } from '@/src/lib/supabase';

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
      const { error } = await supabase
        .from('workout_sessions')
        .update({
          name: session.name,
          started_at: session.started_at,
          completed_at: session.completed_at,
          duration_seconds: session.duration_seconds,
          notes: session.notes,
        })
        .eq('id', serverSessionId);

      if (error) {
        markWorkoutSessionFailed(session.local_id);
        continue;
      }
    } else {
      const { data, error } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: session.user_id,
          name: session.name,
          started_at: session.started_at,
          completed_at: session.completed_at,
          duration_seconds: session.duration_seconds,
          notes: session.notes,
        })
        .select('id')
        .single();

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
      session_id: serverSessionId,
      exercise_id: set.exercise_id,
      set_number: set.set_number,
      reps: set.reps,
      weight: set.weight,
      completed: Boolean(set.completed),
    }));

    const { data: insertedSets, error: setsError } = await supabase
      .from('workout_sets')
      .insert(setRows)
      .select('id');

    if (setsError || !Array.isArray(insertedSets)) {
      for (const set of setsToSync) {
        markWorkoutSetFailed(set.local_id);
      }
      markWorkoutSessionFailed(session.local_id);
      continue;
    }

    let failedSetCount = 0;

    setsToSync.forEach((set, index) => {
      const insertedSet = insertedSets[index];

      if (insertedSet?.id) {
        markWorkoutSetSynced(set.local_id, insertedSet.id);
      } else {
        markWorkoutSetFailed(set.local_id);
        failedSetCount += 1;
      }
    });

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
