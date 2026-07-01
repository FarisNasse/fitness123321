import assert from 'node:assert/strict';
import test from 'node:test';

import { readProjectFile, readProjectJson, runNodeScript } from './helpers/project.mjs';

const exercises = readProjectJson('src/features/workouts/seed-exercises.json');
const requiredFields = [
  'id',
  'name',
  'muscleGroup',
  'equipment',
  'movementType',
  'difficulty',
  'instructions',
  'externalId',
  'bodyPart',
  'targetMuscle',
];

test('seeded exercise catalog is complete enough for the workout UI', () => {
  assert.ok(Array.isArray(exercises), 'seed-exercises.json should export an array');
  assert.ok(exercises.length >= 1000, 'expected the imported exercise dataset to include 1,000+ moves');

  const ids = new Set();
  const names = new Set();

  for (const [index, exercise] of exercises.entries()) {
    for (const field of requiredFields) {
      assert.equal(
        typeof exercise[field],
        'string',
        `exercise ${index + 1} should have string field ${field}`
      );
      assert.notEqual(exercise[field].trim(), '', `exercise ${index + 1} ${field} is blank`);
    }

    assert.match(exercise.id, /^[0-9a-f-]{36}$/i, `${exercise.name} should use a UUID-like id`);
    assert.ok(!ids.has(exercise.id), `duplicate exercise id: ${exercise.id}`);
    assert.ok(!names.has(exercise.name), `duplicate exercise name: ${exercise.name}`);
    if ('secondaryMuscles' in exercise) {
      assert.ok(Array.isArray(exercise.secondaryMuscles), `${exercise.name} secondaryMuscles should be an array`);
    }

    if ('instructionSteps' in exercise) {
      assert.ok(Array.isArray(exercise.instructionSteps), `${exercise.name} instructionSteps should be an array`);
    }

    ids.add(exercise.id);
    names.add(exercise.name);
  }
});

test('exercise catalog exposes diverse filter options', () => {
  const unique = (field) => new Set(exercises.map((exercise) => exercise[field]).filter(Boolean));

  assert.ok(unique('muscleGroup').size >= 4, 'library should have several muscle filters');
  assert.ok(unique('equipment').size >= 3, 'library should have several equipment filters');
  assert.ok(unique('movementType').size >= 4, 'library should have several movement filters');
  assert.ok(unique('difficulty').has('Beginner'), 'library should include beginner exercises');
  assert.ok(unique('difficulty').has('Intermediate'), 'library should include intermediate exercises');
});

test('exercise service maps Supabase rows and falls back to local seeds', () => {
  const service = readProjectFile('src/features/workouts/exercise-service.ts');

  assert.match(service, /function mapExercise\(row: ExerciseRow\): Exercise/);
  assert.match(service, /muscleGroup: row\.muscle_group/);
  assert.match(service, /movementType: row\.movement_type \?\? undefined/);
  assert.match(service, /videoUrl: row\.video_url \?\? undefined/);
  assert.match(service, /if \(!USE_SUPABASE_EXERCISES\) \{[\s\S]*const exercises = getSeededExercises\(\);[\s\S]*rememberExercises\(exercises\);[\s\S]*return exercises;[\s\S]*\}/);
  assert.match(service, /catch \(error\) \{[\s\S]*const exercises = getSeededExercises\(\);[\s\S]*rememberExercises\(exercises\);[\s\S]*return exercises;[\s\S]*\}/);
});

test('Supabase migrations contain exercise schema, anonymous read policy, and legacy cloud seeds', () => {
  const migration1 = readProjectFile('supabase/migrations/0001_initial_schema.sql');
  const migration2 = readProjectFile('supabase/migrations/0002_fix_exercise_library_schema_and_read_policy.sql');
  const combined = `${migration1}\n${migration2}`;

  for (const column of ['muscle_group', 'equipment', 'movement_type', 'difficulty', 'instructions', 'video_url']) {
    assert.match(combined, new RegExp(`\\b${column}\\b`), `missing exercises column ${column}`);
  }

  assert.match(migration2, /to anon, authenticated/);
  assert.match(migration2, /on conflict \(id\) do update set/);

  // The large imported catalog is intentionally local-first for now. The cloud
  // migration keeps the original MVP seeds until the Supabase table is expanded
  // for the richer imported metadata.
  for (const name of ['Bench Press', 'Squat', 'Deadlift', 'Pull-Up']) {
    assert.ok(combined.includes(name), `migration missing legacy seed ${name}`);
  }
});

test('exercise dataset importer is wired into package scripts and preserves metadata', () => {
  const packageJson = readProjectJson('package.json');
  const importer = readProjectFile('scripts/import-exercise-dataset.mjs');
  const models = readProjectFile('src/types/models.ts');
  const library = readProjectFile('src/features/workouts/ExerciseLibrary.tsx');

  assert.equal(packageJson.scripts['import:exercises'], 'node scripts/import-exercise-dataset.mjs');
  assert.match(importer, /stableUuidFromExerciseId/);
  assert.match(importer, /secondaryMuscles/);
  assert.match(importer, /instructionSteps/);
  assert.match(models, /externalId\?: string/);
  assert.match(models, /targetMuscle\?: string/);
  assert.match(models, /secondaryMuscles\?: string\[\]/);
  assert.match(library, /Exercise details/);
  assert.match(library, /selectedExercise\.instructionSteps\?\.length/);
});

test('exercise data validation script passes', () => {
  const output = runNodeScript('scripts/check-exercise-library-data.mjs');
  assert.match(output, /Loaded \d+ local exercises\./);
  assert.match(output, /Muscles:/);
  assert.match(output, /Equipment:/);
});
