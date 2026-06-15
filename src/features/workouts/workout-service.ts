import * as Crypto from 'expo-crypto';

import { db } from '@/src/lib/local-db';
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

export async function syncPendingWorkoutSessions() {
  const pendingSessions = db.getAllSync<any>(
    `
    select *
    from workout_sessions_local
    where sync_status in ('pending', 'failed')
    `
  );

  for (const session of pendingSessions) {
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

    if (error || !data) {
      db.runSync(
        `
        update workout_sessions_local
        set sync_status = 'failed'
        where local_id = ?
        `,
        [session.local_id]
      );
      continue;
    }

    db.runSync(
      `
      update workout_sessions_local
      set server_id = ?,
          sync_status = 'synced'
      where local_id = ?
      `,
      [data.id, session.local_id]
    );
  }
}
