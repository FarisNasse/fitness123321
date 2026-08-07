import assert from 'node:assert/strict';
import test from 'node:test';

import { fileExists, normalizeWhitespace, readProjectFile } from './helpers/project.mjs';

test('wellness screen loads and saves a complete dated daily check-in', () => {
  const screen = readProjectFile('app/(tabs)/wellness.tsx');

  assert.match(screen, /useFocusEffect/);
  assert.match(screen, /const ownerId = session\?\.user\.id \?\? null/);
  assert.match(screen, /getDailyWellnessCheckIn\(ownerId\)/);
  assert.match(screen, /getLatestWellnessCheckIn\(ownerId\)/);
  assert.match(screen, /setMood\(Number\(checkIn\.mood_score\)\)/);
  assert.match(screen, /setEnergy\(Number\(checkIn\.energy_score\)\)/);
  assert.match(screen, /setStress\(Number\(checkIn\.stress_score\)\)/);
  assert.match(screen, /setSteps\(String\(checkIn\.steps\)\)/);
  assert.match(screen, /setBedtime\(formatTimeInput\(checkIn\.sleep_start\)\)/);
  assert.match(screen, /setWakeTime\(formatTimeInput\(checkIn\.sleep_end\)\)/);
  assert.match(screen, /saveDailyWellnessCheckIn\(\{/);
  assert.match(screen, /sleepStart: sleepWindow\.sleepStart/);
  assert.match(screen, /sleepEnd: sleepWindow\.sleepEnd/);
  assert.match(screen, /steps: parsedSteps/);
  assert.match(screen, /syncPendingWellnessCheckIns\(\)/);
  assert.match(screen, /label="Manual steps"/);
  assert.match(screen, /label="Bedtime"/);
  assert.match(screen, /label="Wake time"/);
});

test('wellness service persists one local row per user and date and notifies subscribers', () => {
  const service = readProjectFile('src/features/wellness/wellness-service.ts');

  assert.match(service, /export function getLocalDateKey/);
  assert.match(service, /export function buildSleepWindow/);
  assert.match(service, /export function getDailyWellnessCheckIn/);
  assert.match(service, /export function getLatestWellnessCheckIn/);
  assert.match(service, /from mood_logs_local[\s\S]*user_id = \?[\s\S]*check_in_date = \?/);
  assert.match(service, /export function saveDailyWellnessCheckIn/);
  assert.match(service, /insert into mood_logs_local \([\s\S]*check_in_date,[\s\S]*sleep_start,[\s\S]*sleep_end,[\s\S]*steps,/);
  assert.match(service, /update mood_logs_local[\s\S]*set logged_at = \?[\s\S]*steps = \?[\s\S]*sync_status = 'pending'/);
  assert.match(service, /const wellnessListeners = new Set/);
  assert.match(service, /export function subscribeToWellnessChanges/);
  assert.match(service, /notifyWellnessChanged\(saved\)/);
});

test('wellness remote sync mirrors the local check-in to existing mood and sleep tables', () => {
  const service = readProjectFile('src/features/wellness/wellness-service.ts');

  assert.match(service, /USE_REMOTE_WELLNESS_SYNC/);
  assert.match(service, /from mood_logs_local[\s\S]*where sync_status in \('pending', 'failed'\)[\s\S]*and user_id != \?/);
  assert.match(service, /\.from\('mood_logs'\)[\s\S]*check_in_date: checkIn\.check_in_date[\s\S]*steps: checkIn\.steps[\s\S]*\{ onConflict: 'id' \}/);
  assert.match(service, /\.from\('sleep_logs'\)[\s\S]*sleep_start: checkIn\.sleep_start[\s\S]*sleep_end: checkIn\.sleep_end[\s\S]*\{ onConflict: 'id' \}/);
  assert.match(service, /export function syncPendingWellnessCheckIns\(\)/);
});

test('local database and web adapter support persisted wellness records', () => {
  const localDb = normalizeWhitespace(readProjectFile('src/lib/local-db.ts'));

  assert.match(localDb, /export type LocalWellnessCheckIn/);
  assert.match(localDb, /create table if not exists mood_logs_local/);
  assert.match(localDb, /check_in_date text not null/);
  assert.match(localDb, /sleep_start text not null/);
  assert.match(localDb, /sleep_end text not null/);
  assert.match(localDb, /steps integer not null default 0/);
  assert.match(localDb, /insert into mood_logs_local/);
  assert.match(localDb, /update mood_logs_local.*set logged_at = \?/);
  assert.match(localDb, /update mood_logs_local.*set sync_status = 'failed'/);
  assert.match(localDb, /update mood_logs_local.*set server_id = \?/);
  assert.match(localDb, /from mood_logs_local.*user_id = \?.*check_in_date = \?/);
  assert.match(localDb, /from mood_logs_local.*sync_status/);
  assert.match(localDb, /idx_mood_logs_user_date/);
});

test('dashboard and app lifecycle refresh wellness steps without wearable integration', () => {
  const dashboard = readProjectFile('app/(tabs)/dashboard.tsx');
  const syncState = readProjectFile('src/lib/sync-state.tsx');

  assert.match(dashboard, /const \[steps, setSteps\] = useState\(0\)/);
  assert.match(dashboard, /getDailyWellnessCheckIn\(ownerId\)/);
  assert.match(dashboard, /subscribeToWellnessChanges\(ownerId, \(checkIn\) =>/);
  assert.match(dashboard, /setSteps\(Number\(checkIn\.steps \?\? 0\)\)/);
  assert.match(dashboard, /progress=\{progress\(steps, targets\.steps\)\}/);
  assert.match(syncState, /wellness: syncPendingWellnessCheckIns/);
  assert.match(syncState, /source: 'sync-state-provider'/);
});

test('Supabase migration and documentation describe optional wellness sync', () => {
  assert.equal(fileExists('supabase/migrations/0004_add_daily_wellness_check_ins.sql'), true);

  const migration = readProjectFile('supabase/migrations/0004_add_daily_wellness_check_ins.sql');
  const flags = readProjectFile('src/lib/runtime-flags.ts');
  const env = readProjectFile('.env.example');
  const readme = readProjectFile('README.md');

  assert.match(migration, /alter table public\.mood_logs[\s\S]*add column if not exists steps/);
  assert.match(migration, /alter table public\.sleep_logs[\s\S]*add column if not exists check_in_date/);
  assert.match(flags, /EXPO_PUBLIC_WELLNESS_SYNC_SOURCE === 'supabase'/);
  assert.match(env, /EXPO_PUBLIC_WELLNESS_SYNC_SOURCE=local/);
  assert.match(readme, /Wellness check-ins are local by default/);
  assert.match(readme, /No wearable|wearable/i);
});
