import assert from 'node:assert/strict';
import test from 'node:test';

import { fileExists, normalizeWhitespace, readProjectFile, readProjectJson } from './helpers/project.mjs';

function assertIncludes(source, expected, message) {
  assert.ok(source.includes(expected), message ?? `Expected to find ${expected}`);
}

test('reviewer docs explain the local-first workout design, recommendations, and demo path', () => {
  const expectedDocs = [
    'docs/workout-local-first-architecture.md',
    'docs/workout-recommendation-logic.md',
    'docs/workout-demo-script.md',
  ];

  for (const doc of expectedDocs) {
    assert.ok(fileExists(doc), `${doc} should exist`);
  }

  const architecture = readProjectFile('docs/workout-local-first-architecture.md');
  const recommendations = readProjectFile('docs/workout-recommendation-logic.md');
  const demo = readProjectFile('docs/workout-demo-script.md');
  const readme = readProjectFile('README.md');

  assertIncludes(architecture, 'The phone/browser local database is the source of truth for active logging.');
  assertIncludes(architecture, 'Cloud sync runs after local writes when `USE_REMOTE_WORKOUT_SYNC` is enabled');
  assertIncludes(architecture, '`workout_sessions_local`');
  assertIncludes(architecture, '`workout_sets_local`');
  assertIncludes(architecture, '`exercise_targets_local`');
  assertIncludes(architecture, 'Soft-deleted rows are upserted as remote tombstones instead of hard deleted.');

  assertIncludes(recommendations, 'Recent history');
  assertIncludes(recommendations, 'Saved target');
  assertIncludes(recommendations, 'Starter default');
  assertIncludes(recommendations, '`increase`');
  assertIncludes(recommendations, '`repeat`');
  assertIncludes(recommendations, '`deload`');
  assertIncludes(recommendations, 'Estimated one-rep max is shown only as a secondary clue.');

  assertIncludes(demo, 'Start workout');
  assertIncludes(demo, 'Log a set with one tap');
  assertIncludes(demo, 'Repeat Last Workout');
  assertIncludes(demo, 'The key workout cards use wrapping rows/minimum widths');

  assertIncludes(readme, 'Workout reviewer docs');
  assertIncludes(readme, 'docs/workout-local-first-architecture.md');
  assertIncludes(readme, 'docs/workout-recommendation-logic.md');
  assertIncludes(readme, 'docs/workout-demo-script.md');
});

test('workout screens have explicit loading, empty, and error states for normal edge cases', () => {
  const workouts = readProjectFile('app/(tabs)/workouts.tsx');
  const live = readProjectFile('app/workout/session/[id].tsx');
  const history = readProjectFile('app/workout/history/[id].tsx');
  const library = readProjectFile('src/features/workouts/ExerciseLibrary.tsx');

  assertIncludes(workouts, 'isLoadingRecentSessions');
  assertIncludes(workouts, 'Could not load workout history');
  assertIncludes(workouts, 'Loading recent workouts…');
  assertIncludes(workouts, 'No completed workouts yet');

  assertIncludes(live, 'SessionLoadState');
  assertIncludes(live, 'Loading workout session…');
  assertIncludes(live, 'Workout session unavailable');
  assertIncludes(live, 'Back to workouts');

  assertIncludes(history, 'Could not load workout sets');
  assertIncludes(history, 'Workout not found');
  assertIncludes(history, 'No sets logged');

  assertIncludes(library, 'Could not load exercises');
  assertIncludes(library, 'No exercises match these filters');
  assertIncludes(library, 'Exercise library is empty');
  assertIncludes(library, 'Clear search and filters');
});

test('key workout cards use mobile-safe wrapping and minimum widths', () => {
  const workouts = readProjectFile('app/(tabs)/workouts.tsx');
  const live = normalizeWhitespace(readProjectFile('app/workout/session/[id].tsx'));
  const history = normalizeWhitespace(readProjectFile('app/workout/history/[id].tsx'));

  assert.match(workouts, /className="flex-row flex-wrap gap-3"/);
  assert.match(workouts, /style=\{\{ minWidth: 96 \}\}/);

  assertIncludes(live, "flexDirection: 'row', flexWrap: 'wrap', gap: 12");
  assertIncludes(live, "flexDirection: 'row', flexWrap: 'wrap', gap: 10");
  assert.match(live, /minWidth: 130, padding: 14/);
  assert.match(live, /flexGrow: 1, minWidth: 74/);
  assert.match(live, /flex: 1, minWidth: 112/);

  assert.match(history, /flexDirection: 'row', flexWrap: 'wrap', gap: 10/);
  assert.match(history, /flex: 1, minWidth: 112/);
});

test('project quality docs and empty-state coverage run through npm run test:all', () => {
  const packageJson = readProjectJson('package.json');

  assert.equal(packageJson.scripts.test, 'node --test tests');
  assert.match(packageJson.scripts['test:all'], /npm run test/);
});
