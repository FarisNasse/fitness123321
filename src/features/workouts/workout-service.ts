import * as Crypto from 'expo-crypto';

import {
  db,
  getExerciseIdsBySessionFromSets,
  getExercisesBySession,
  getSetsBySession,
  getSetsBySessionForSync,
  type ExerciseTargetLocal,
  type LocalWorkoutSession,
  type LocalWorkoutSessionExercise,
  type LocalWorkoutSet,
} from '@/src/lib/local-db';
import { LOCAL_DEV_USER_ID, USE_REMOTE_WORKOUT_SYNC } from '@/src/lib/runtime-flags';
import {
  buildProgressionRecommendation,
  buildProgressionSummaryLines,
  type ProgressionEffortFeedback,
  type ProgressionRecommendation,
} from '@/src/features/workouts/progression-service';

export type LocalWorkoutSessionRow = LocalWorkoutSession;
export type LocalWorkoutSessionExerciseRow = LocalWorkoutSessionExercise;
export type ExerciseTargetLocalRow = ExerciseTargetLocal;
export type WorkoutSyncUiStatus = 'pending' | 'syncing' | 'synced' | 'failed';
export type SmartDefaultSource = 'history' | 'target' | 'fallback';

export type SmartExerciseSetDefault = {
  setNumber: number;
  reps: number;
  weight: number;
};

export type SmartExerciseDefaults = {
  exerciseId: string;
  source: SmartDefaultSource;
  targetSets: number;
  repMin: number;
  repMax: number;
  incrementSize: number;
  deloadPercentage: number;
  suggestedSets: SmartExerciseSetDefault[];
};

const STANDARD_EXERCISE_DEFAULTS = {
  targetSets: 3,
  repMin: 8,
  repMax: 12,
  incrementSize: 5,
  deloadPercentage: 10,
};

function toPositiveInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number.parseFloat(String(value ?? ''));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toNonNegativeNumber(value: unknown, fallback: number) {
  const parsed = Number.parseFloat(String(value ?? ''));

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeExerciseTarget(target: ExerciseTargetLocal | null) {
  const repMin = toPositiveInteger(target?.rep_min, STANDARD_EXERCISE_DEFAULTS.repMin);
  const repMax = Math.max(
    repMin,
    toPositiveInteger(target?.rep_max, STANDARD_EXERCISE_DEFAULTS.repMax)
  );

  return {
    targetSets: toPositiveInteger(
      target?.target_sets,
      STANDARD_EXERCISE_DEFAULTS.targetSets
    ),
    repMin,
    repMax,
    incrementSize: toPositiveNumber(
      target?.increment_size,
      STANDARD_EXERCISE_DEFAULTS.incrementSize
    ),
    deloadPercentage: toPositiveNumber(
      target?.deload_percentage,
      STANDARD_EXERCISE_DEFAULTS.deloadPercentage
    ),
  };
}

function buildFallbackSuggestedSets(
  count: number,
  reps: number,
  weight: number
): SmartExerciseSetDefault[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    setNumber: index + 1,
    reps,
    weight,
  }));
}

export function getLocalExerciseTarget(exerciseId: string) {
  return (
    db.getAllSync<ExerciseTargetLocalRow>(
      `
      select *
      from exercise_targets_local
      where exercise_id = ?
      limit 1
      `,
      [exerciseId]
    )[0] ?? null
  );
}

export function upsertLocalExerciseTarget(input: {
  exerciseId: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  incrementSize: number;
  deloadPercentage: number;
}) {
  const existingTarget = getLocalExerciseTarget(input.exerciseId);
  const localId = existingTarget?.local_id ?? Crypto.randomUUID();
  const now = new Date().toISOString();
  const targetSets = toPositiveInteger(
    input.targetSets,
    STANDARD_EXERCISE_DEFAULTS.targetSets
  );
  const repMin = toPositiveInteger(input.repMin, STANDARD_EXERCISE_DEFAULTS.repMin);
  const repMax = Math.max(
    repMin,
    toPositiveInteger(input.repMax, STANDARD_EXERCISE_DEFAULTS.repMax)
  );
  const incrementSize = toPositiveNumber(
    input.incrementSize,
    STANDARD_EXERCISE_DEFAULTS.incrementSize
  );
  const deloadPercentage = toPositiveNumber(
    input.deloadPercentage,
    STANDARD_EXERCISE_DEFAULTS.deloadPercentage
  );

  db.runSync(
    `
    insert into exercise_targets_local (
      local_id,
      exercise_id,
      target_sets,
      rep_min,
      rep_max,
      increment_size,
      deload_percentage,
      sync_status,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    on conflict(exercise_id) do update set
      target_sets = excluded.target_sets,
      rep_min = excluded.rep_min,
      rep_max = excluded.rep_max,
      increment_size = excluded.increment_size,
      deload_percentage = excluded.deload_percentage,
      sync_status = 'pending',
      updated_at = excluded.updated_at
    `,
    [
      localId,
      input.exerciseId,
      targetSets,
      repMin,
      repMax,
      incrementSize,
      deloadPercentage,
      now,
    ]
  );

  return getLocalExerciseTarget(input.exerciseId);
}

function getRecentCompletedExerciseSets(exerciseId: string) {
  return db.getAllSync<LocalWorkoutSet>(
    `
    select ws.*
    from workout_sets_local ws
    join workout_sessions_local s
      on s.local_id = ws.session_local_id
    where ws.exercise_id = ?
      and coalesce(ws.is_deleted, 0) = 0
      and ws.deleted_at is null
      and coalesce(s.is_deleted, 0) = 0
      and s.deleted_at is null
      and s.completed_at is not null
      and ws.session_local_id = (
        select ws2.session_local_id
        from workout_sets_local ws2
        join workout_sessions_local s2
          on s2.local_id = ws2.session_local_id
        where ws2.exercise_id = ?
          and coalesce(ws2.is_deleted, 0) = 0
          and ws2.deleted_at is null
          and coalesce(s2.is_deleted, 0) = 0
          and s2.deleted_at is null
          and s2.completed_at is not null
        order by s2.completed_at desc, s2.started_at desc
        limit 1
      )
    order by ws.set_number asc
    `,
    [exerciseId, exerciseId]
  );
}

export async function getSmartExerciseDefaults(
  exerciseId: string
): Promise<SmartExerciseDefaults> {
  const target = getLocalExerciseTarget(exerciseId);
  const normalizedTarget = normalizeExerciseTarget(target);
  const recentSets = getRecentCompletedExerciseSets(exerciseId);

  if (recentSets.length > 0) {
    const suggestedSets = recentSets.map((set, index) => ({
      setNumber: index + 1,
      reps: toPositiveInteger(set.reps, normalizedTarget.repMin),
      weight: toNonNegativeNumber(set.weight, 0),
    }));
    const targetSetCount = Math.max(
      normalizedTarget.targetSets,
      suggestedSets.length
    );
    const lastSuggestion = suggestedSets[suggestedSets.length - 1];

    while (suggestedSets.length < targetSetCount) {
      suggestedSets.push({
        ...lastSuggestion,
        setNumber: suggestedSets.length + 1,
      });
    }

    return {
      exerciseId,
      source: 'history',
      targetSets: targetSetCount,
      repMin: normalizedTarget.repMin,
      repMax: normalizedTarget.repMax,
      incrementSize: normalizedTarget.incrementSize,
      deloadPercentage: normalizedTarget.deloadPercentage,
      suggestedSets,
    };
  }

  if (target) {
    return {
      exerciseId,
      source: 'target',
      targetSets: normalizedTarget.targetSets,
      repMin: normalizedTarget.repMin,
      repMax: normalizedTarget.repMax,
      incrementSize: normalizedTarget.incrementSize,
      deloadPercentage: normalizedTarget.deloadPercentage,
      suggestedSets: buildFallbackSuggestedSets(
        normalizedTarget.targetSets,
        normalizedTarget.repMin,
        0
      ),
    };
  }

  return {
    exerciseId,
    source: 'fallback',
    targetSets: STANDARD_EXERCISE_DEFAULTS.targetSets,
    repMin: STANDARD_EXERCISE_DEFAULTS.repMin,
    repMax: STANDARD_EXERCISE_DEFAULTS.repMax,
    incrementSize: STANDARD_EXERCISE_DEFAULTS.incrementSize,
    deloadPercentage: STANDARD_EXERCISE_DEFAULTS.deloadPercentage,
    suggestedSets: buildFallbackSuggestedSets(
      STANDARD_EXERCISE_DEFAULTS.targetSets,
      STANDARD_EXERCISE_DEFAULTS.repMin,
      0
    ),
  };
}


export type WorkoutCompletionProgressionRecommendation = ProgressionRecommendation;

function groupWorkoutSetsByExercise(sets: LocalWorkoutSet[]) {
  return sets.reduce((groups, set) => {
    const exerciseSets = groups.get(set.exercise_id) ?? [];
    groups.set(set.exercise_id, [...exerciseSets, set]);
    return groups;
  }, new Map<string, LocalWorkoutSet[]>());
}

export function getWorkoutCompletionProgressionRecommendations(
  sessionLocalId: string,
  options: {
    effortFeedback?: ProgressionEffortFeedback | null;
    exerciseNamesById?: Record<string, string>;
  } = {}
) {
  const currentSetsByExercise = groupWorkoutSetsByExercise(getLocalWorkoutSets(sessionLocalId));

  return Array.from(currentSetsByExercise.entries()).map(
    ([exerciseId, currentSets]) => {
      const target = normalizeExerciseTarget(getLocalExerciseTarget(exerciseId));
      const previousSets = getRecentCompletedExerciseSets(exerciseId);

      return buildProgressionRecommendation({
        exerciseId,
        exerciseName: options.exerciseNamesById?.[exerciseId],
        currentSets,
        previousSets,
        targetSets: target.targetSets,
        repMin: target.repMin,
        repMax: target.repMax,
        incrementSize: target.incrementSize,
        deloadPercentage: target.deloadPercentage,
        effortFeedback: options.effortFeedback,
      });
    }
  );
}

export function getWorkoutCompletionProgressionReasonText(
  sessionLocalId: string,
  options: {
    effortFeedback?: ProgressionEffortFeedback | null;
    exerciseNamesById?: Record<string, string>;
  } = {}
) {
  const recommendations = getWorkoutCompletionProgressionRecommendations(
    sessionLocalId,
    options
  );
  const lines = buildProgressionSummaryLines(recommendations);

  return lines.length > 0 ? `Next time:\n${lines.join('\n')}` : '';
}

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
      is_deleted,
      deleted_at,
      sync_status,
      updated_at
    )
    values (?, ?, ?, ?, 0, null, 'pending', ?)
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
        and coalesce(is_deleted, 0) = 0
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
    where coalesce(is_deleted, 0) = 0
      and deleted_at is null
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
      and coalesce(is_deleted, 0) = 0
      and deleted_at is null
    order by started_at desc
    limit ?
    `,
    [limit]
  );
}

export function getMostRecentCompletedWorkoutSession(userId: string) {
  return (
    db.getAllSync<LocalWorkoutSessionRow>(
      `
      select *
      from workout_sessions_local
      where user_id = ?
        and completed_at is not null
        and coalesce(is_deleted, 0) = 0
        and deleted_at is null
      order by started_at desc
      limit ?
      `,
      [userId, 1]
    )[0] ?? null
  );
}

function buildFallbackWorkoutSessionExercises(sessionLocalId: string) {
  const now = new Date().toISOString();

  return getExerciseIdsBySessionFromSets(sessionLocalId).map((row, index) => ({
    local_id: `${sessionLocalId}:${row.exercise_id}`,
    session_local_id: sessionLocalId,
    exercise_id: row.exercise_id,
    sort_order: index + 1,
    created_at: now,
    updated_at: now,
  }));
}

function insertLocalWorkoutSessionExercise(
  sessionLocalId: string,
  exerciseId: string,
  sortOrder: number
) {
  const localId = Crypto.randomUUID();
  const now = new Date().toISOString();

  db.runSync(
    `
    insert or ignore into workout_session_exercises_local (
      local_id,
      session_local_id,
      exercise_id,
      sort_order,
      created_at,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?)
    `,
    [localId, sessionLocalId, exerciseId, sortOrder, now, now]
  );

  return localId;
}

export function getLocalWorkoutSessionExercises(sessionLocalId: string) {
  const savedExercises = getExercisesBySession(sessionLocalId);

  if (savedExercises.length > 0) {
    return savedExercises;
  }

  return buildFallbackWorkoutSessionExercises(sessionLocalId);
}

export function addLocalWorkoutSessionExercise(
  sessionLocalId: string,
  exerciseId: string,
  sortOrder?: number
) {
  let savedExercises = getExercisesBySession(sessionLocalId);

  if (savedExercises.length === 0) {
    for (const fallbackExercise of buildFallbackWorkoutSessionExercises(sessionLocalId)) {
      insertLocalWorkoutSessionExercise(
        sessionLocalId,
        fallbackExercise.exercise_id,
        fallbackExercise.sort_order
      );
    }

    savedExercises = getExercisesBySession(sessionLocalId);
  }

  const existing = savedExercises.find((exercise) => exercise.exercise_id === exerciseId);

  if (existing) {
    return existing.local_id;
  }

  const nextSortOrder =
    sortOrder ??
    savedExercises.reduce(
      (maxOrder, exercise) => Math.max(maxOrder, exercise.sort_order),
      0
    ) + 1;

  return insertLocalWorkoutSessionExercise(
    sessionLocalId,
    exerciseId,
    nextSortOrder
  );
}

export function repeatLastCompletedWorkout(userId: string) {
  const previousWorkout = getMostRecentCompletedWorkoutSession(userId);

  if (!previousWorkout) {
    return null;
  }

  const nextSessionLocalId = createLocalWorkoutSession(
    userId,
    `Repeat: ${previousWorkout.name}`
  );
  const exercisesToRepeat = getLocalWorkoutSessionExercises(previousWorkout.local_id);

  for (const exercise of exercisesToRepeat) {
    addLocalWorkoutSessionExercise(
      nextSessionLocalId,
      exercise.exercise_id,
      exercise.sort_order
    );
  }

  return {
    sessionLocalId: nextSessionLocalId,
    sourceSessionLocalId: previousWorkout.local_id,
    exerciseCount: exercisesToRepeat.length,
  };
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
      and coalesce(is_deleted, 0) = 0
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

  if (!existing || existing.is_deleted || existing.deleted_at) return;

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

  if (!deleted || deleted.is_deleted || deleted.deleted_at) return;

  const now = new Date().toISOString();

  db.runSync(
    `
    update workout_sets_local
    set is_deleted = 1,
        deleted_at = ?,
        sync_status = 'pending',
        updated_at = ?
    where local_id = ?
      and coalesce(is_deleted, 0) = 0
    `,
    [now, now, setLocalId]
  );

  const toRenumber = db.getAllSync<LocalWorkoutSet>(
    `
    select *
    from workout_sets_local
    where session_local_id = ?
      and exercise_id = ?
      and coalesce(is_deleted, 0) = 0
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


export function restoreLocalWorkoutSet(setLocalId: string) {
  const deleted = db.getAllSync<LocalWorkoutSet>(
    `
    select *
    from workout_sets_local
    where local_id = ?
    limit 1
    `,
    [setLocalId]
  )[0];

  if (!deleted || !deleted.is_deleted || !deleted.deleted_at) return;

  const now = new Date().toISOString();
  const toShift = db.getAllSync<LocalWorkoutSet>(
    `
    select *
    from workout_sets_local
    where session_local_id = ?
      and exercise_id = ?
      and coalesce(is_deleted, 0) = 0
      and deleted_at is null
      and set_number >= ?
    order by set_number desc
    `,
    [deleted.session_local_id, deleted.exercise_id, deleted.set_number]
  );

  for (const s of toShift) {
    db.runSync(
      `
      update workout_sets_local
      set set_number = ?,
          sync_status = 'pending',
          updated_at = ?
      where local_id = ?
      `,
      [s.set_number + 1, now, s.local_id]
    );
  }

  db.runSync(
    `
    update workout_sets_local
    set is_deleted = 0,
        deleted_at = null,
        set_number = ?,
        sync_status = 'pending',
        updated_at = ?
    where local_id = ?
      and coalesce(is_deleted, 0) = 1
    `,
    [deleted.set_number, now, setLocalId]
  );

  markWorkoutSessionPending(deleted.session_local_id);
}

export function deleteLocalWorkoutSession(sessionLocalId: string) {
  const now = new Date().toISOString();

  db.runSync(
    `
    update workout_sets_local
    set is_deleted = 1,
        deleted_at = ?,
        sync_status = 'pending',
        updated_at = ?
    where session_local_id = ?
      and coalesce(is_deleted, 0) = 0
      and deleted_at is null
    `,
    [now, now, sessionLocalId]
  );

  db.runSync(
    `
    update workout_sessions_local
    set is_deleted = 1,
        deleted_at = ?,
        sync_status = 'pending',
        updated_at = ?
    where local_id = ?
      and coalesce(is_deleted, 0) = 0
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
  addLocalWorkoutSessionExercise(input.sessionLocalId, input.exerciseId);

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
      is_deleted,
      deleted_at,
      sync_status,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, 1, 0, null, 'pending', ?)
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
      and coalesce(is_deleted, 0) = 0
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
  set: LocalWorkoutSet,
  remoteSessionId: string,
  fallbackDeletedAt?: string | null
) {
  const remoteSetId = set.server_id ?? set.local_id;
  const deletedAt = set.deleted_at ?? fallbackDeletedAt ?? new Date().toISOString();
  const { data, error } = await supabase
    .from('workout_sets')
    .upsert(
      {
        id: remoteSetId,
        session_id: remoteSessionId,
        exercise_id: set.exercise_id,
        set_number: set.set_number,
        reps: set.reps,
        weight: set.weight,
        completed: Boolean(set.completed),
        is_deleted: true,
        deleted_at: deletedAt,
      },
      { onConflict: 'id' }
    )
    .select('id')
    .maybeSingle();

  if (error || !data?.id) {
    markWorkoutSetFailed(set.local_id);
    return false;
  }

  // A missing remote row is recreated as a tombstone, so retries stay idempotent.
  markWorkoutSetSynced(set.local_id, String(data.id));
  return true;
}

async function syncDeletedWorkoutSession(
  supabase: Awaited<typeof import('@/src/lib/supabase')>['supabase'],
  session: LocalWorkoutSessionRow
) {
  const remoteSessionId = session.server_id ?? session.local_id;
  const deletedAt = session.deleted_at ?? new Date().toISOString();
  const setsToFinalize = getSetsBySessionForSync(session.local_id);

  const { data, error } = await supabase
    .from('workout_sessions')
    .upsert(
      {
        id: remoteSessionId,
        user_id: session.user_id,
        name: session.name,
        started_at: session.started_at,
        completed_at: session.completed_at,
        duration_seconds: session.duration_seconds,
        notes: session.notes,
        is_deleted: true,
        deleted_at: deletedAt,
      },
      { onConflict: 'id' }
    )
    .select('id')
    .maybeSingle();

  if (error || !data?.id) {
    for (const set of setsToFinalize) {
      markWorkoutSetFailed(set.local_id);
    }
    markWorkoutSessionFailed(session.local_id);
    return;
  }

  const syncedSessionId = String(data.id);
  let failedSetCount = 0;

  for (const set of setsToFinalize) {
    const didDelete = await syncDeletedWorkoutSet(
      supabase,
      set,
      syncedSessionId,
      deletedAt
    );
    if (!didDelete) failedSetCount += 1;
  }

  if (failedSetCount > 0) {
    markWorkoutSessionFailed(session.local_id);
    return;
  }

  markWorkoutSessionSynced(session.local_id, syncedSessionId);
}

let syncInFlight: Promise<void> | null = null;
let syncRequestedWhileInFlight = false;

async function syncPendingWorkoutSessionsImpl() {
  if (!USE_REMOTE_WORKOUT_SYNC) {
    return;
  }

  const { supabase } = await import('@/src/lib/supabase');
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user?.id) {
    throw new Error('Sign in before syncing workout sessions.');
  }

  const userId = authData.user.id;
  const pendingOwnerParameters = [LOCAL_DEV_USER_ID];
  pendingOwnerParameters.push(userId);

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
      and user_id = ?
    `,
    pendingOwnerParameters
  );

  for (const session of pendingSessions) {
    try {
      if (session.is_deleted || session.deleted_at) {
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
            is_deleted: false,
            deleted_at: null,
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
              is_deleted: false,
              deleted_at: null,
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
      const deletedSets = setsToSync.filter(
        (set) => Boolean(set.is_deleted) || Boolean(set.deleted_at)
      );
      const activeSets = setsToSync.filter(
        (set) => !set.is_deleted && !set.deleted_at
      );
      let failedSetCount = 0;

      for (const set of deletedSets) {
        const didDelete = await syncDeletedWorkoutSet(
          supabase,
          set,
          serverSessionId
        );
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
          is_deleted: false,
          deleted_at: null,
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
