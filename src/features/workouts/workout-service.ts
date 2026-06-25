import * as Crypto from 'expo-crypto';

import {
  db,
  getSetsBySession,
  getSetsBySessionForSync,
  type LocalWorkoutSession,
  type LocalWorkoutSet,
} from '@/src/lib/local-db';
import { LOCAL_DEV_USER_ID, USE_REMOTE_WORKOUT_SYNC } from '@/src/lib/runtime-flags';

export type LocalWorkoutSessionRow = LocalWorkoutSession;
export type WorkoutSyncUiStatus = 'pending' | 'syncing' | 'synced' | 'failed';

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
        and deleted_at is null
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
    where deleted_at is null
    order by started_at desc
    limit ?
    `,
    [limit]
  );
}

export function getCompletedWorkoutSessions(limit = 5) {
  return db.getAllSync<LocalWorkoutSessionRow>(
    `
    select *
    from workout_sessions_local
    where completed_at is not null
      and deleted_at is null
    order by started_at desc
    limit ?
    `,
    [limit]
  );
}

export function getLocalWorkoutSets(sessionLocalId: string) {
  return getSetsBySession(sessionLocalId);
}

export function getWorkoutSyncUiStatus(
  session: LocalWorkoutSessionRow,
  isSyncing = false
): WorkoutSyncUiStatus {
  if (isSyncing) {
    return 'syncing';
  }

  const syncableSets = getSetsBySessionForSync(session.local_id);

  if (
    session.sync_status === 'failed' ||
    syncableSets.some((set) => set.sync_status === 'failed')
  ) {
    return 'failed';
  }

  if (
    session.sync_status === 'pending' ||
    syncableSets.some((set) => set.sync_status === 'pending')
  ) {
    return 'pending';
  }

  return 'synced';
}

export function getWorkoutSyncStatusLabel(status: WorkoutSyncUiStatus) {
  switch (status) {
    case 'pending':
      return 'Saved on device';
    case 'syncing':
      return 'Syncing';
    case 'synced':
      return 'Synced';
    case 'failed':
      return 'Sync failed';
  }
}

function markWorkoutSessionPending(sessionLocalId: string) {
  const now = new Date().toISOString();

  db.runSync(
    `
    update workout_sessions_local
    set sync_status = 'pending',
        updated_at = ?
    where local_id = ?
    `,
    [now, sessionLocalId]
  );
}

export function updateLocalWorkoutSet(
  setLocalId: string,
  reps: number,
  weight: number
) {
  const existing = db.getAllSync<LocalWorkoutSet>(
    `
    select *
    from workout_sets_local
    where local_id = ?
    limit 1
    `,
    [setLocalId]
  )[0];

  if (!existing || existing.deleted_at) return;

  const now = new Date().toISOString();

  db.runSync(
    `
    update workout_sets_local
    set reps = ?,
        weight = ?,
        sync_status = 'pending',
        updated_at = ?
    where local_id = ?
    `,
    [reps, weight, now, setLocalId]
  );
  markWorkoutSessionPending(existing.session_local_id);
}

export function deleteLocalWorkoutSet(setLocalId: string) {
  const deleted = db.getAllSync<LocalWorkoutSet>(
    `
    select *
    from workout_sets_local
    where local_id = ?
    limit 1
    `,
    [setLocalId]
  )[0];

  if (!deleted || deleted.deleted_at) return;

  const now = new Date().toISOString();

  db.runSync(
    `
    update workout_sets_local
    set deleted_at = ?,
        sync_status = 'pending',
        updated_at = ?
    where local_id = ?
    `,
    [now, now, setLocalId]
  );

  const toRenumber = db.getAllSync<LocalWorkoutSet>(
    `
    select *
    from workout_sets_local
    where session_local_id = ?
      and exercise_id = ?
      and deleted_at is null
      and set_number > ?
    order by set_number asc
    `,
    [deleted.session_local_id, deleted.exercise_id, deleted.set_number]
  );

  for (const s of toRenumber) {
    db.runSync(
      `
      update workout_sets_local
      set set_number = ?,
          sync_status = 'pending',
          updated_at = ?
      where local_id = ?
      `,
      [s.set_number - 1, now, s.local_id]
    );
  }

  markWorkoutSessionPending(deleted.session_local_id);
}

export function deleteLocalWorkoutSession(sessionLocalId: string) {
  const now = new Date().toISOString();

  db.runSync(
    `
    update workout_sets_local
    set deleted_at = ?,
        sync_status = 'pending',
        updated_at = ?
    where session_local_id = ?
      and deleted_at is null
    `,
    [now, now, sessionLocalId]
  );

  db.runSync(
    `
    update workout_sessions_local
    set deleted_at = ?,
        sync_status = 'pending',
        updated_at = ?
    where local_id = ?
    `,
    [now, now, sessionLocalId]
  );
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

  markWorkoutSessionPending(input.sessionLocalId);
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

async function syncDeletedWorkoutSet(
  supabase: Awaited<typeof import('@/src/lib/supabase')>['supabase'],
  set: LocalWorkoutSet
) {
  const remoteSetId = set.server_id ?? set.local_id;
  const { error } = await supabase
    .from('workout_sets')
    .delete()
    .eq('id', remoteSetId);

  if (error) {
    markWorkoutSetFailed(set.local_id);
    return false;
  }

  // A missing remote row is already the desired state, so it is a successful retry.
  markWorkoutSetSynced(set.local_id, remoteSetId);
  return true;
}

async function syncDeletedWorkoutSession(
  supabase: Awaited<typeof import('@/src/lib/supabase')>['supabase'],
  session: LocalWorkoutSessionRow
) {
  const remoteSessionId = session.server_id ?? session.local_id;
  const setsToFinalize = getSetsBySessionForSync(session.local_id);

  const { error: setsError } = await supabase
    .from('workout_sets')
    .delete()
    .eq('session_id', remoteSessionId);

  if (setsError) {
    for (const set of setsToFinalize) {
      markWorkoutSetFailed(set.local_id);
    }
    markWorkoutSessionFailed(session.local_id);
    return;
  }

  const { error: sessionError } = await supabase
    .from('workout_sessions')
    .delete()
    .eq('id', remoteSessionId);

  if (sessionError) {
    markWorkoutSessionFailed(session.local_id);
    return;
  }

  for (const set of setsToFinalize) {
    markWorkoutSetSynced(set.local_id, set.server_id ?? set.local_id);
  }
  markWorkoutSessionSynced(session.local_id, remoteSessionId);
}

let syncInFlight: Promise<void> | null = null;
let syncRequestedWhileInFlight = false;

async function syncPendingWorkoutSessionsImpl() {
  if (!USE_REMOTE_WORKOUT_SYNC) {
    return;
  }

  const { supabase } = await import('@/src/lib/supabase');

  const pendingSessions = db.getAllSync<LocalWorkoutSessionRow>(
    `
    select *
    from workout_sessions_local
    where (
        sync_status in ('pending', 'failed')
        or local_id in (
          select session_local_id
          from workout_sets_local
          where sync_status in ('pending', 'failed')
        )
      )
      and user_id != ?
    `,
    [LOCAL_DEV_USER_ID]
  );

  for (const session of pendingSessions) {
    try {
      if (session.deleted_at) {
        await syncDeletedWorkoutSession(supabase, session);
        continue;
      }

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

      const setsToSync = getSetsBySessionForSync(session.local_id).filter(
        (set) => set.sync_status === 'pending' || set.sync_status === 'failed'
      );
      const deletedSets = setsToSync.filter((set) => Boolean(set.deleted_at));
      const activeSets = setsToSync.filter((set) => !set.deleted_at);
      let failedSetCount = 0;

      for (const set of deletedSets) {
        const didDelete = await syncDeletedWorkoutSet(supabase, set);
        if (!didDelete) failedSetCount += 1;
      }

      if (activeSets.length > 0) {
        const setRows = activeSets.map((set) => ({
          id: set.server_id ?? set.local_id,
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
          for (const set of activeSets) {
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

        for (const set of activeSets) {
          const expectedRemoteId = set.server_id ?? set.local_id;

          if (syncedSetIds.has(expectedRemoteId)) {
            markWorkoutSetSynced(set.local_id, expectedRemoteId);
          } else {
            markWorkoutSetFailed(set.local_id);
            failedSetCount += 1;
          }
        }
      }

      if (failedSetCount > 0) {
        markWorkoutSessionFailed(session.local_id);
        continue;
      }

      markWorkoutSessionSynced(session.local_id, serverSessionId);
    } catch (error) {
      console.warn('Unexpected workout sync error.', error);
      markWorkoutSessionFailed(session.local_id);
    }
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
