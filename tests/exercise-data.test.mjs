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
];

test('seeded exercise catalog is complete enough for the workout UI', () => {
  assert.ok(Array.isArray(exercises), 'seed-exercises.json should export an array');
  assert.ok(exercises.length >= 8, 'expected at least the eight MVP seed exercises');

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

test('Supabase migrations contain exercise schema, anonymous read policy, and current seeds', () => {
  const migration1 = readProjectFile('supabase/migrations/0001_initial_schema.sql');
  const migration2 = readProjectFile('supabase/migrations/0002_fix_exercise_library_schema_and_read_policy.sql');
  const combined = `${migration1}\n${migration2}`;

  for (const column of ['muscle_group', 'equipment', 'movement_type', 'difficulty', 'instructions', 'video_url']) {
    assert.match(combined, new RegExp(`\\b${column}\\b`), `missing exercises column ${column}`);
  }

  assert.match(migration2, /to anon, authenticated/);
  assert.match(migration2, /on conflict \(id\) do update set/);

  for (const exercise of exercises) {
    assert.ok(combined.includes(exercise.id), `migration missing seed id ${exercise.id}`);
    assert.ok(combined.includes(exercise.name.replace(/'/g, "''")), `migration missing ${exercise.name}`);
  }
});

test('exercise data validation script passes', () => {
  const output = runNodeScript('scripts/check-exercise-library-data.mjs');
  assert.match(output, /Loaded \d+ local exercises\./);
  assert.match(output, /Muscles:/);
  assert.match(output, /Equipment:/);
});
