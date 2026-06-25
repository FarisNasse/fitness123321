import assert from 'node:assert/strict';
import test from 'node:test';

import { fileExists, normalizeWhitespace, readProjectFile } from './helpers/project.mjs';

test('offline safety schema keeps local soft-delete tombstones for workout sessions and sets', () => {
  const localDb = readProjectFile('src/lib/local-db.ts');

  assert.match(localDb, /is_deleted integer not null default 0/);
  assert.match(localDb, /deleted_at text/);
  assert.match(localDb, /addMissingLocalColumn\((['"])workout_sessions_local\1, (['"])is_deleted integer not null default 0\2\)/);
  assert.match(localDb, /addMissingLocalColumn\((['"])workout_sessions_local\1, (['"])deleted_at text\2\)/);
  assert.match(localDb, /addMissingLocalColumn\((['"])workout_sets_local\1, (['"])is_deleted integer not null default 0\2\)/);
  assert.match(localDb, /addMissingLocalColumn\((['"])workout_sets_local\1, (['"])deleted_at text\2\)/);
  assert.match(localDb, /where deleted_at is not null[\s\S]*and coalesce\(is_deleted, 0\) = 0/);
  assert.match(localDb, /export function getSetsBySession\(sessionLocalId: string\)[\s\S]*coalesce\(is_deleted, 0\) = 0[\s\S]*deleted_at is null/);
  assert.match(localDb, /export function getSetsBySessionForSync\(sessionLocalId: string\)[\s\S]*sync_status in \('pending', 'failed'\)/);
});

test('Supabase migrations add matching soft-delete fields without requiring hard deletes', () => {
  assert.ok(fileExists('supabase/migrations/0003_add_workout_soft_delete_columns.sql'));

  const initial = readProjectFile('supabase/migrations/0001_initial_schema.sql');
  const migration = readProjectFile('supabase/migrations/0003_add_workout_soft_delete_columns.sql');

  for (const sql of [initial, migration]) {
    assert.match(sql, /workout_sessions[\s\S]*is_deleted boolean not null default false/);
    assert.match(sql, /workout_sessions[\s\S]*deleted_at timestamptz/);
    assert.match(sql, /workout_sets[\s\S]*is_deleted boolean not null default false/);
    assert.match(sql, /workout_sets[\s\S]*deleted_at timestamptz/);
  }

  assert.match(migration, /idx_workout_sessions_active_user_started/);
  assert.match(migration, /idx_workout_sets_active_session/);
});

test('workout service marks local rows deleted and syncs tombstones as remote soft deletes', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');
  const compact = normalizeWhitespace(service);

  assert.match(compact, /export function deleteLocalWorkoutSet\(setLocalId: string\).*update workout_sets_local set is_deleted = 1, deleted_at = \?, sync_status = 'pending', updated_at = \? where local_id = \? and coalesce\(is_deleted, 0\) = 0/);
  assert.match(compact, /export function deleteLocalWorkoutSession\(sessionLocalId: string\).*update workout_sets_local set is_deleted = 1, deleted_at = \?, sync_status = 'pending', updated_at = \? where session_local_id = \? and coalesce\(is_deleted, 0\) = 0 and deleted_at is null.*update workout_sessions_local set is_deleted = 1, deleted_at = \?, sync_status = 'pending', updated_at = \? where local_id = \? and coalesce\(is_deleted, 0\) = 0/);
  assert.match(service, /async function syncDeletedWorkoutSet[\s\S]*\.from\('workout_sets'\)[\s\S]*\.upsert\([\s\S]*is_deleted: true,[\s\S]*deleted_at: deletedAt/);
  assert.match(service, /async function syncDeletedWorkoutSession[\s\S]*\.from\('workout_sessions'\)[\s\S]*\.upsert\([\s\S]*is_deleted: true,[\s\S]*deleted_at: deletedAt/);
  assert.match(service, /A missing remote row is recreated as a tombstone/);
  assert.doesNotMatch(service, /\.from\('workout_sets'\)[\s\S]{0,120}\.delete\(\)/);
  assert.doesNotMatch(service, /\.from\('workout_sessions'\)[\s\S]{0,120}\.delete\(\)/);
});

test('sync status labels and retry UI use plain language and do not block logging', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');
  const workouts = readProjectFile('app/(tabs)/workouts.tsx');
  const live = readProjectFile('app/workout/session/[id].tsx');
  const historyCard = readProjectFile('src/components/WorkoutHistoryCard.tsx');

  for (const label of ['Saved on device', 'Syncing', 'Synced', 'Sync failed']) {
    assert.ok(service.includes(label), `missing status label: ${label}`);
  }

  assert.match(workouts, /syncUiStatus === 'failed'[\s\S]*retryWorkoutSync\(session\.local_id\)/);
  assert.match(historyCard, /Retry sync/);
  assert.match(historyCard, /event\.stopPropagation\(\)/);
  assert.match(live, /queueWorkoutSync\('adding a set'\)/);
  assert.match(live, /queueWorkoutSync\('editing a set'\)/);
  assert.match(live, /queueWorkoutSync\('deleting a set'\)/);
  assert.match(live, /void syncPendingWorkoutSessions\(\)\.catch/);
});
