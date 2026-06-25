import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeWhitespace, readProjectFile } from './helpers/project.mjs';

function assertIncludes(source, text, message = `expected source to include ${text}`) {
  assert.ok(source.includes(text), message);
}

function assertInOrder(source, snippets, message = 'expected snippets to appear in order') {
  let cursor = -1;

  for (const snippet of snippets) {
    const nextIndex = source.indexOf(snippet, cursor + 1);
    assert.notEqual(nextIndex, -1, `${message}: missing ${snippet}`);
    assert.ok(nextIndex > cursor, `${message}: ${snippet} appeared out of order`);
    cursor = nextIndex;
  }
}

test('local database stores session exercise selections separately from logged sets', () => {
  const localDb = readProjectFile('src/lib/local-db.ts');

  assert.match(localDb, /export type LocalWorkoutSessionExercise = \{/);
  assert.match(localDb, /workout_session_exercises_local: Record<string, unknown>\[\]/);
  assert.match(localDb, /create table if not exists workout_session_exercises_local \([\s\S]*session_local_id text not null[\s\S]*exercise_id text not null[\s\S]*sort_order integer not null[\s\S]*unique\(session_local_id, exercise_id\)/);
  assert.match(localDb, /create index if not exists idx_workout_session_exercises_session[\s\S]*on workout_session_exercises_local\(session_local_id, sort_order\)/);
});

test('web local-db adapter can save ordered selected exercises and recover set-derived order for older workouts', () => {
  const localDb = normalizeWhitespace(readProjectFile('src/lib/local-db.ts'));

  assert.match(localDb, /insert or ignore into workout_session_exercises_local/);
  assert.match(localDb, /store\.workout_session_exercises_local\.some/);
  assert.match(localDb, /from workout_session_exercises_local.*session_local_id = \?.*sort\(/);
  assert.match(localDb, /from workout_sets_local.*group by exercise_id/);
  assert.match(localDb, /seenExerciseIds\.add\(exerciseId\)/);
  assert.match(localDb, /return rows as T\[\]/);
});

test('workout service repeats the latest completed user workout without copying old sets', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');

  assert.match(service, /export function getMostRecentCompletedWorkoutSession\(userId: string\)/);
  assert.match(service, /where user_id = \?[\s\S]*completed_at is not null[\s\S]*order by started_at desc[\s\S]*limit \?/);
  assert.match(service, /export function repeatLastCompletedWorkout\(userId: string\)/);
  assertInOrder(service, [
    'const previousWorkout = getMostRecentCompletedWorkoutSession(userId);',
    'if (!previousWorkout) {',
    'return null;',
    'const nextSessionLocalId = createLocalWorkoutSession(',
    'const exercisesToRepeat = getLocalWorkoutSessionExercises(previousWorkout.local_id);',
    'for (const exercise of exercisesToRepeat) {',
    'addLocalWorkoutSessionExercise(',
  ], 'repeatLastCompletedWorkout should create a fresh session and copy only exercise selections');

  const repeatFunction = service.slice(
    service.indexOf('export function repeatLastCompletedWorkout'),
    service.indexOf('export function getLocalWorkoutSets')
  );
  assert.doesNotMatch(repeatFunction, /addLocalWorkoutSet\(/, 'repeat should not clone prior logged sets');
  assert.match(repeatFunction, /sessionLocalId: nextSessionLocalId/);
  assert.match(repeatFunction, /sourceSessionLocalId: previousWorkout\.local_id/);
  assert.match(repeatFunction, /exerciseCount: exercisesToRepeat\.length/);
});

test('workout service records exercise selections when picking or logging movements', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');

  assert.match(service, /export function getLocalWorkoutSessionExercises\(sessionLocalId: string\)/);
  assert.match(service, /const savedExercises = getExercisesBySession\(sessionLocalId\)/);
  assert.match(service, /getExerciseIdsBySessionFromSets\(sessionLocalId\)\.map\(\(row, index\) => \(\{/);
  assert.match(service, /export function addLocalWorkoutSessionExercise\([\s\S]*sessionLocalId: string,[\s\S]*exerciseId: string,[\s\S]*sortOrder\?: number/);
  assert.match(service, /insert or ignore into workout_session_exercises_local/);
  assert.match(service, /addLocalWorkoutSessionExercise\(input\.sessionLocalId, input\.exerciseId\);/);
});

test('workouts tab exposes Repeat Last Workout and a useful empty state', () => {
  const workouts = readProjectFile('app/(tabs)/workouts.tsx');

  assert.match(workouts, /repeatLastCompletedWorkout/);
  assert.match(workouts, /async function repeatLastWorkout\(\)/);
  assert.match(workouts, /const repeatedWorkout = repeatLastCompletedWorkout\(userId\)/);
  assert.match(workouts, /router\.push\(`\/workout\/session\/\$\{repeatedWorkout\.sessionLocalId\}`\)/);
  assertIncludes(workouts, 'title="Repeat Last Workout"');
  assertIncludes(workouts, 'Nothing to repeat yet');
  assertIncludes(workouts, 'Finish a workout once, then Repeat Last Workout will open a new session with those exercises already loaded.');
});

test('live workout screen preloads saved exercises before any new sets are logged', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /getLocalWorkoutSessionExercises/);
  assert.match(live, /const savedExerciseRows = getLocalWorkoutSessionExercises\(sessionId\)/);
  assert.match(live, /const orderedSessionExercises = savedExerciseRows[\s\S]*\.map\(\(row\) => resolveExercise\(row\.exercise_id\)\)/);
  assert.match(live, /const nextExercises = \[\.\.\.orderedSessionExercises, \.\.\.exercisesFromLoggedSets\]/);
  assert.match(live, /setSelectedExercises\(\(current\) => \{/);
  assert.match(live, /setSelectedExercise\(\(current\) => current \?\? nextExercises\[0\]\)/);
});

test('exercise picker persists the session exercise order independently of set rows', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assertInOrder(live, [
    'function chooseExercise(exercise: Exercise) {',
    'if (sessionId) {',
    'addLocalWorkoutSessionExercise(sessionId, exercise.id);',
    'rememberExercises([exercise]);',
    'rememberExerciseSelection(exercise);',
  ], 'chooseExercise should record the exercise selection before updating screen state');
});
