import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeWhitespace, readProjectFile, runNodeScript } from './helpers/project.mjs';

test('local database schema stores the workout session and set fields used by the app', () => {
  const localDb = readProjectFile('src/lib/local-db.ts');

  for (const table of [
    'workout_sessions_local',
    'workout_sets_local',
    'meal_logs_local',
    'meal_items_local',
    'water_logs_local',
    'mood_logs_local',
  ]) {
    assert.ok(localDb.includes(`create table if not exists ${table}`), `missing local table ${table}`);
  }

  for (const column of [
    'local_id text primary key',
    'server_id text',
    'user_id text not null',
    'started_at text not null',
    'completed_at text',
    'duration_seconds integer',
    "sync_status text not null default 'pending'",
    'updated_at text not null',
  ]) {
    assert.ok(localDb.includes(column), `workout session schema missing ${column}`);
  }

  for (const column of [
    'session_local_id text not null',
    'exercise_id text not null',
    'set_number integer not null',
    'reps integer',
    'weight real',
    'completed integer default 0',
  ]) {
    assert.ok(localDb.includes(column), `workout set schema missing ${column}`);
  }
});

test('web local-db adapter supports every workout query pattern used by services', () => {
  const localDb = normalizeWhitespace(readProjectFile('src/lib/local-db.ts'));

  assert.match(localDb, /insert into workout_sessions_local/);
  assert.match(localDb, /insert into workout_sets_local/);
  assert.match(localDb, /update workout_sessions_local.*set completed_at/);
  assert.match(localDb, /update workout_sessions_local.*set sync_status = 'failed'/);
  assert.match(localDb, /update workout_sessions_local.*set server_id = \?/);
  assert.match(localDb, /update workout_sessions_local.*set server_id = null/);
  assert.match(localDb, /update workout_sets_local.*set sync_status = 'failed'/);
  assert.match(localDb, /update workout_sets_local.*set server_id = \?/);
  assert.match(localDb, /from workout_sessions_local.*where local_id = \?/);
  assert.match(localDb, /from workout_sessions_local.*sync_status/);
  assert.match(localDb, /from workout_sessions_local.*order by started_at desc/);
  assert.match(localDb, /from workout_sets_local.*session_local_id = \?/);
});

test('workout owner logic keeps local mode usable without Supabase auth', () => {
  const flags = readProjectFile('src/lib/runtime-flags.ts');
  const service = readProjectFile('src/features/workouts/workout-service.ts');

  assert.match(flags, /LOCAL_DEV_USER_ID = '00000000-0000-0000-0000-000000000999'/);
  assert.match(flags, /EXPO_PUBLIC_WORKOUT_SYNC_SOURCE === 'supabase'/);
  assert.match(service, /if \(!USE_REMOTE_WORKOUT_SYNC\) \{\s*return LOCAL_DEV_USER_ID;\s*\}/s);
  assert.match(service, /throw new Error\('Sign in before starting a cloud-synced workout\.'\)/);
});

test('workout service creates, completes, reads, and lists local sessions', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');

  assert.match(service, /export function createLocalWorkoutSession/);
  assert.match(service, /Crypto\.randomUUID\(\)/);
  assert.match(service, /values \(\?, \?, \?, \?, 'pending', \?\)/);
  assert.match(service, /export function getLocalWorkoutSession/);
  assert.match(service, /export function getRecentLocalWorkoutSessions/);
  assert.match(service, /export function getCompletedWorkoutSessions/);
  assert.match(service, /where completed_at is not null/);
  assert.match(service, /export function completeLocalWorkoutSession/);
  assert.match(service, /duration_seconds = cast\(\(julianday\(\?\) - julianday\(started_at\)\) \* 86400 as integer\)/);
});

test('set logging writes completed pending sets for the selected exercise', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');

  assert.match(service, /export function addLocalWorkoutSet/);
  assert.match(service, /session_local_id,\s*exercise_id,\s*set_number,\s*reps,\s*weight,\s*completed,\s*sync_status,/s);
  assert.match(service, /values \(\?, \?, \?, \?, \?, \?, 1, 'pending', \?\)/);
  assert.match(service, /export function getLocalWorkoutSets\(sessionLocalId: string\)/);
  assert.match(service, /return getSetsBySession\(sessionLocalId\);/);
});

test('remote sync avoids known RLS traps and handles stale remote rows', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');

  assert.match(service, /where sync_status in \('pending', 'failed'\)\s*and user_id != \?/s);
  assert.match(service, /\[LOCAL_DEV_USER_ID\]/);
  assert.match(service, /\.update\([\s\S]*?\)\s*\.eq\('id', serverSessionId\)\s*\.select\('id'\)\s*\.maybeSingle\(\)/);
  assert.match(service, /if \(!data\?\.id\) \{[\s\S]*clearWorkoutSessionServerId\(session\.local_id\);[\s\S]*serverSessionId = null;[\s\S]*\}/);
  assert.match(service, /\.upsert\([\s\S]*?\{ onConflict: 'id' \}\s*\)\s*\.select\('id'\)\s*\.maybeSingle\(\)/);
});

test('remote sync marks sessions and sets according to Supabase outcomes', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');

  assert.match(service, /if \(setsToSync\.length === 0\) \{\s*markWorkoutSessionSynced\(session\.local_id, serverSessionId\);\s*continue;\s*\}/s);
  assert.match(service, /\.from\('workout_sets'\)\s*\.upsert\(setRows, \{ onConflict: 'id' \}\)\s*\.select\('id'\)/);
  assert.match(service, /if \(setsError \|\| !Array\.isArray\(syncedSets\)\) \{/);
  assert.match(service, /markWorkoutSetSynced\(set\.local_id, set\.local_id\)/);
  assert.match(service, /markWorkoutSetFailed\(set\.local_id\)/);
  assert.match(service, /markWorkoutSessionFailed\(session\.local_id\)/);
  assert.match(service, /markWorkoutSessionSynced\(session\.local_id, serverSessionId\)/);
});

test('sync queue coalesces overlapping sync requests instead of running concurrently', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');

  assert.match(service, /let syncInFlight: Promise<void> \| null = null/);
  assert.match(service, /let syncRequestedWhileInFlight = false/);
  assert.match(service, /async function drainWorkoutSyncQueue\(\) \{\s*do \{/s);
  assert.match(service, /\} while \(syncRequestedWhileInFlight\);/);
  assert.match(service, /if \(syncInFlight\) \{\s*syncRequestedWhileInFlight = true;\s*return syncInFlight;/s);
});

test('estimated one-rep max uses the expected Epley-style formula', () => {
  const prService = readProjectFile('src/features/workouts/pr-service.ts');

  assert.match(prService, /if \(reps <= 1\) \{\s*return weight;\s*\}/s);
  assert.match(prService, /return weight \* \(1 \+ reps \/ 30\);/);
});

test('local development health check passes', () => {
  const output = runNodeScript('scripts/check-local-dev.mjs');

  assert.match(output, /Local MVP check passed\./);
  assert.match(output, /Workout start: local user, no Supabase auth required\./);
  assert.match(output, /Remote sync: off by default/);
});
