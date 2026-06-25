import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeWhitespace, readProjectFile } from './helpers/project.mjs';

test('offline safety schema keeps local tombstones for workout sessions and sets', () => {
  const localDb = readProjectFile('src/lib/local-db.ts');

  assert.match(localDb, /deleted_at text/);
  assert.match(localDb, /addMissingLocalColumn\((['\"])workout_sessions_local\1, (['\"])deleted_at text\2\)/);
  assert.match(localDb, /addMissingLocalColumn\((['\"])workout_sets_local\1, (['\"])deleted_at text\2\)/);
  assert.match(localDb, /export function getSetsBySession\(sessionLocalId: string\)[\s\S]*deleted_at is null/);
  assert.match(localDb, /export function getSetsBySessionForSync\(sessionLocalId: string\)[\s\S]*sync_status in \('pending', 'failed'\)/);
});

test('workout service soft-deletes local rows and syncs tombstones to Supabase deletes', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');
  const compact = normalizeWhitespace(service);

  assert.match(compact, /export function deleteLocalWorkoutSet\(setLocalId: string\).*update workout_sets_local set deleted_at = \?, sync_status = 'pending', updated_at = \? where local_id = \?/);
  assert.match(compact, /export function deleteLocalWorkoutSession\(sessionLocalId: string\).*update workout_sets_local set deleted_at = \?, sync_status = 'pending', updated_at = \? where session_local_id = \? and deleted_at is null.*update workout_sessions_local set deleted_at = \?, sync_status = 'pending', updated_at = \? where local_id = \?/);
  assert.match(service, /async function syncDeletedWorkoutSet[\s\S]*\.from\('workout_sets'\)[\s\S]*\.delete\(\)[\s\S]*\.eq\('id', remoteSetId\)/);
  assert.match(service, /async function syncDeletedWorkoutSession[\s\S]*\.from\('workout_sets'\)[\s\S]*\.delete\(\)[\s\S]*\.eq\('session_id', remoteSessionId\)[\s\S]*\.from\('workout_sessions'\)[\s\S]*\.delete\(\)[\s\S]*\.eq\('id', remoteSessionId\)/);
  assert.match(service, /A missing remote row is already the desired state/);
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
