import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeWhitespace, readProjectFile } from './helpers/project.mjs';

test('exercise targets are uniquely scoped by owner and legacy targets migrate safely', () => {
  const localDb = readProjectFile('src/lib/local-db.ts');

  assert.match(localDb, /export type ExerciseTargetLocal = \{[\s\S]*user_id: string;/);
  assert.match(localDb, /create table if not exists exercise_targets_local \([\s\S]*user_id text not null[\s\S]*unique\(user_id, exercise_id\)/);
  assert.match(localDb, /function migrateExerciseTargetsToOwnerScope\(\)/);
  assert.match(localDb, /exercise_targets_local rename to exercise_targets_local_legacy/);
  assert.match(localDb, /LOCAL_DEV_USER_ID/);
  assert.match(localDb, /idx_exercise_targets_owner_exercise[\s\S]*exercise_targets_local\(user_id, exercise_id\)/);
});

test('workout reads, writes, targets, and history require the active owner', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');
  const compact = normalizeWhitespace(service);

  assert.match(service, /getLocalExerciseTarget\(userId: string, exerciseId: string\)/);
  assert.match(service, /on conflict\(user_id, exercise_id\) do update set/);
  assert.match(service, /getLocalWorkoutSession\(userId: string, sessionLocalId: string\)/);
  assert.match(service, /getCompletedWorkoutSessions\(userId: string, limit = 5\)/);
  assert.match(service, /getLocalWorkoutSets\(userId: string, sessionLocalId: string\)/);
  assert.match(service, /completeLocalWorkoutSession\(\s*userId: string,\s*sessionLocalId: string\s*\)/);
  assert.match(compact, /join workout_sessions_local s on s\.local_id = ws\.session_local_id where s\.user_id = \? and ws\.local_id = \?/);
  assert.match(compact, /where user_id = \? and local_id = \? and coalesce\(is_deleted, 0\) = 0/);
});

test('nutrition, wellness, and measurement summaries and subscriptions isolate listeners by owner', () => {
  const nutrition = readProjectFile('src/features/nutrition/nutrition-service.ts');
  const wellness = readProjectFile('src/features/wellness/wellness-service.ts');
  const measurements = readProjectFile('src/features/progress/body-measurements-service.ts');

  assert.match(nutrition, /getDailyNutritionSummary\(\s*userId: string,/);
  assert.match(nutrition, /subscribeToNutritionLogChanges\(\s*userId: string,\s*listener:/);
  assert.match(nutrition, /registration\.userId === userId/);
  assert.match(nutrition, /join meal_logs_local ml[\s\S]*where ml\.user_id = \?/);

  assert.match(wellness, /subscribeToWellnessChanges\(\s*userId: string,\s*listener:/);
  assert.match(wellness, /registration\.userId === checkIn\.user_id/);
  assert.match(wellness, /getDailyWellnessCheckIn\(\s*userId: string,/);

  assert.match(measurements, /subscribeToBodyMeasurementChanges\(\s*userId: string,\s*listener:/);
  assert.match(measurements, /registration\.userId === userId/);
  assert.match(measurements, /getBodyMeasurementHistory\(\s*userId: string,/);
});

test('all primary screens derive local ownership from the authenticated session', () => {
  for (const path of [
    'app/(tabs)/dashboard.tsx',
    'app/(tabs)/nutrition.tsx',
    'app/(tabs)/progress.tsx',
    'app/(tabs)/wellness.tsx',
    'app/(tabs)/workouts.tsx',
    'app/workout/history/[id].tsx',
    'src/features/workouts/live/useLiveWorkoutController.ts',
  ]) {
    const source = readProjectFile(path);
    assert.match(source, /useAuthSession\(\)/, `${path} must resolve the signed-in session`);
    assert.match(source, /ownerId/, `${path} must pass an owner through local operations`);
  }
});

test('account switches clear cached data and cannot be overwritten by stale sync completions', () => {
  const layout = readProjectFile('app/_layout.tsx');
  const syncState = readProjectFile('src/lib/sync-state.tsx');

  assert.match(layout, /queryClient\.clear\(\);[\s\S]*\[session\?\.user\.id\]/);
  assert.match(layout, /ownerId=\{session\?\.user\.id \?\? null\}/);
  assert.match(syncState, /ownerGenerationRef\.current \+= 1/);
  assert.match(syncState, /const syncOwnerId = ownerIdRef\.current/);
  assert.match(syncState, /if \(!isCurrentOwner\(\)\) return/);
  assert.match(syncState, /activeSyncsRef\.current\[domain\] === syncPromise/);
  assert.match(syncState, /getOwnerSyncBacklog\(ownerId\)/);
  assert.match(syncState, /\[canSync, networkStatus, ownerId, retryAll\]/);
});

test('the web fallback enforces owner predicates for session mutations', () => {
  const localDb = readProjectFile('src/lib/local-db.ts');

  assert.match(localDb, /const hasOwnerPredicate = normalized\.includes\('where user_id = \?'\)/);
  assert.match(localDb, /!hasOwnerPredicate \|\| item\.user_id === userId/);
  assert.match(localDb, /getOwnerSyncBacklog\(userId: string\)/);
  assert.match(localDb, /ownedSessionIds\.has\(String\(set\.session_local_id\)\)/);
  assert.match(localDb, /ownedMealLogIds\.has\(String\(item\.meal_log_local_id\)\)/);
});
