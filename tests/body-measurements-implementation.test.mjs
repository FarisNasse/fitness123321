import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeWhitespace, readProjectFile } from './helpers/project.mjs';

test('body measurements use a durable local mirror with all optional fields', () => {
  const localDb = readProjectFile('src/lib/local-db.ts');
  const compact = normalizeWhitespace(localDb);

  assert.match(localDb, /export type LocalBodyMeasurement/);
  assert.match(compact, /create table if not exists body_measurements_local \( local_id text primary key, server_id text, user_id text not null, measured_at text not null, weight_kg real not null, body_fat_percent real, waist_cm real, hips_cm real, chest_cm real, arm_cm real, thigh_cm real, notes text, sync_status text not null default 'pending', updated_at text not null \)/);
  assert.match(localDb, /idx_body_measurements_user_measured/);
  assert.match(localDb, /body_measurements_local: \[\]/);
  assert.match(localDb, /insert into body_measurements_local/);
  assert.match(localDb, /from body_measurements_local/);
});

test('measurement service validates weight, keeps optional values nullable, and returns chronological history', () => {
  const service = readProjectFile('src/features/progress/body-measurements-service.ts');

  assert.match(service, /export function saveBodyMeasurement/);
  assert.match(service, /weightKg: number/);
  assert.match(service, /bodyFatPercent\?: number \| null/);
  assert.match(service, /waistCm\?: number \| null/);
  assert.match(service, /hipsCm\?: number \| null/);
  assert.match(service, /chestCm\?: number \| null/);
  assert.match(service, /armCm\?: number \| null/);
  assert.match(service, /thighCm\?: number \| null/);
  assert.match(service, /input\.bodyFatPercent \?\? null/);
  assert.match(service, /input\.waistCm \?\? null/);
  assert.match(service, /order by measured_at asc, updated_at asc/);
  assert.match(service, /notifyBodyMeasurementsChanged\(\)/);
});

test('progress screen logs measurements and derives the card and chart from saved history', () => {
  const screen = readProjectFile('app/(tabs)/progress.tsx');
  const chart = readProjectFile('src/components/WeightChart.tsx');

  assert.match(screen, /getBodyMeasurementHistory\(userId\)/);
  assert.match(screen, /saveBodyMeasurement\(\{/);
  assert.match(screen, /weightKg: poundsToKilograms/);
  assert.match(screen, /bodyFatPercent: parsedBodyFat/);
  assert.match(screen, /waistCm:/);
  assert.match(screen, /hipsCm:/);
  assert.match(screen, /chestCm:/);
  assert.match(screen, /armCm:/);
  assert.match(screen, /thighCm:/);
  assert.match(screen, /value=\{latestMeasurement \? formatWeight\(latestMeasurement\.weight_kg\) : '—'\}/);
  assert.match(screen, /<WeightChart data=\{chartPoints\} \/>/);
  assert.match(screen, /measurements\.slice\(-12\)\.map/);
  assert.match(screen, /title="No weight logged"/);
  assert.match(screen, /message="Log your first measurement to start a real weight trend\."/);
  assert.doesNotMatch(screen, /value="170 lb"/);
  assert.doesNotMatch(chart, /const data = \[/);
});

test('remote measurement sync is opt-in and constrained to the authenticated owner', () => {
  const service = readProjectFile('src/features/progress/body-measurements-service.ts');
  const flags = readProjectFile('src/lib/runtime-flags.ts');
  const layout = readProjectFile('app/_layout.tsx');
  const env = readProjectFile('.env.example');
  const readme = readProjectFile('README.md');

  assert.match(flags, /EXPO_PUBLIC_BODY_MEASUREMENT_SYNC_SOURCE === 'supabase'/);
  assert.match(service, /supabase\.auth\.getUser\(\)/);
  assert.match(service, /authData\.user\?\.id !== userId/);
  assert.match(service, /\.from\(["']body_measurements["']\)/);
  assert.match(service, /\.eq\(["']user_id["'], userId\)/);
  assert.match(service, /where sync_status in \('pending', 'failed'\)[\s\S]*and user_id != \?[\s\S]*and user_id = \?/);
  assert.match(service, /\.upsert\([\s\S]*\{ onConflict: ["']id["'] \}/);
  assert.match(layout, /syncPendingBodyMeasurements\(\)/);
  assert.match(layout, /Failed to sync pending body measurements/);
  assert.match(env, /EXPO_PUBLIC_BODY_MEASUREMENT_SYNC_SOURCE=local/);
  assert.match(readme, /Empty accounts[\s\S]*no fabricated progress data/);
});
