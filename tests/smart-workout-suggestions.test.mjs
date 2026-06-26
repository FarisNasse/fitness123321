import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeWhitespace, readProjectFile } from './helpers/project.mjs';

function assertIncludes(source, text, message = `expected source to include ${text}`) {
  assert.ok(source.includes(text), message);
}

test('local database stores optional exercise target defaults offline-first', () => {
  const localDb = readProjectFile('src/lib/local-db.ts');

  assert.match(localDb, /export type ExerciseTargetLocal = \{/);
  assert.match(localDb, /exercise_targets_local: Record<string, unknown>\[\]/);
  assert.match(localDb, /create table if not exists exercise_targets_local \([\s\S]*exercise_id text not null unique[\s\S]*target_sets integer not null default 3[\s\S]*rep_min integer not null default 8[\s\S]*rep_max integer not null default 12[\s\S]*increment_size real not null default 5[\s\S]*deload_percentage real not null default 10/);
  assert.match(localDb, /create index if not exists idx_exercise_targets_exercise[\s\S]*on exercise_targets_local\(exercise_id\)/);
});

test('web local-db adapter can upsert exercise targets and answer recent-history default queries', () => {
  const localDb = normalizeWhitespace(readProjectFile('src/lib/local-db.ts'));

  assert.match(localDb, /insert into exercise_targets_local/);
  assert.match(localDb, /const existingTarget = store\.exercise_targets_local\.find/);
  assert.match(localDb, /Object\.assign\(existingTarget, targetRow\)/);
  assert.match(localDb, /from exercise_targets_local.*exercise_id = \?/);
  assert.match(localDb, /from workout_sets_local ws.*join workout_sessions_local s.*ws\.exercise_id = \?/);
  assert.match(localDb, /Boolean\(session\.completed_at\)/);
  assert.match(localDb, /latestSession\.local_id/);
});

test('model layer exposes a typed exercise target configuration shape', () => {
  const models = readProjectFile('src/types/models.ts');

  assert.match(models, /export type ExerciseTargetLocal = \{/);
  for (const field of [
    'exerciseId: string',
    'targetSets: number',
    'repMin: number',
    'repMax: number',
    'incrementSize: number',
    'deloadPercentage: number',
    'syncStatus: SyncStatus',
  ]) {
    assertIncludes(models, field);
  }
});

test('workout service implements the smart defaults fallback cascade', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');
  const compact = normalizeWhitespace(service);

  assert.match(service, /export type SmartExerciseDefaults = \{/);
  assert.match(service, /const STANDARD_EXERCISE_DEFAULTS = \{[\s\S]*targetSets: 3,[\s\S]*repMin: 8,[\s\S]*repMax: 12,[\s\S]*incrementSize: 5,[\s\S]*deloadPercentage: 10/);
  assert.match(service, /export function upsertLocalExerciseTarget/);
  assert.match(service, /on conflict\(exercise_id\) do update set/);
  assert.match(service, /function getRecentCompletedExerciseSets\(exerciseId: string\)/);
  assert.match(compact, /join workout_sessions_local s on s\.local_id = ws\.session_local_id where ws\.exercise_id = \? .* s\.completed_at is not null/);
  assert.match(service, /export async function getSmartExerciseDefaults/);
  assert.match(service, /if \(recentSets\.length > 0\) \{[\s\S]*source: 'history'/);
  assert.match(service, /if \(target\) \{[\s\S]*source: 'target'/);
  assert.match(service, /source: 'fallback'/);
});

test('live workout screen applies smart defaults when exercises are selected and after sets are logged', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /getSmartExerciseDefaults/);
  assert.match(live, /upsertLocalExerciseTarget/);
  assert.match(live, /const \[smartDefaultsByExerciseId, setSmartDefaultsByExerciseId\] = useState/);
  assert.match(live, /async function applySmartDefaultsForExercise\([\s\S]*const defaults = await getSmartExerciseDefaults\(exercise\.id\)[\s\S]*const nextSet = getSuggestedSetForIndex\(defaults, currentSetCount\)[\s\S]*setReps\(String\(nextSet\.reps\)\)[\s\S]*setWeight\(formatWeightInput\(nextSet\.weight\)\)/);
  assert.match(live, /async function chooseExercise\(exercise: Exercise\)[\s\S]*await applySmartDefaultsForExercise/);
  assert.match(live, /void applySmartDefaultsForExercise\(exercise, currentExerciseSets\.length \+ 1\)/);
});

test('live workout screen keeps target configuration optional and uses dynamic increment buttons', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assertIncludes(live, 'Optional targets');
  assertIncludes(live, 'Logging still works without touching it.');
  assert.match(live, /<TargetInput[\s\S]*label="Sets"[\s\S]*value=\{targetSetsInput\}/);
  assert.match(live, /<TargetInput[\s\S]*label="Rep min"[\s\S]*value=\{repMinInput\}/);
  assert.match(live, /<TargetInput[\s\S]*label="Rep max"[\s\S]*value=\{repMaxInput\}/);
  assert.match(live, /<TargetInput[\s\S]*label="Increment"[\s\S]*value=\{incrementSizeInput\}/);
  assert.match(live, /<TargetInput[\s\S]*label="Deload %"[\s\S]*value=\{deloadPercentageInput\}/);
  assert.match(live, /<Button title="Save optional targets" onPress=\{saveSelectedExerciseTarget\} \/>/);
  assert.match(live, /label=\{`− \$\{formatWeightInput\(activeIncrementSize\)\} lb`\}/);
  assert.match(live, /onPress=\{\(\) => adjustWeight\(-activeIncrementSize\)\}/);
  assert.match(live, /label=\{`\+ \$\{formatWeightInput\(activeIncrementSize\)\} lb`\}/);
  assert.match(live, /onPress=\{\(\) => adjustWeight\(activeIncrementSize\)\}/);
});
