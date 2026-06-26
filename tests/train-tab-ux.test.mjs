import assert from 'node:assert/strict';
import test from 'node:test';

import { fileExists, readProjectFile, readProjectJson } from './helpers/project.mjs';

function assertInOrder(source, snippets, message = 'expected snippets to appear in order') {
  let cursor = -1;

  for (const snippet of snippets) {
    const nextIndex = source.indexOf(snippet, cursor + 1);
    assert.notEqual(nextIndex, -1, `${message}: missing ${snippet}`);
    assert.ok(nextIndex > cursor, `${message}: ${snippet} appeared out of order`);
    cursor = nextIndex;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertNoDeveloperCopy(source, surfaceName) {
  const blockedPhrases = [
    'npm run check:exercises',
    'seed file',
    'Supabase',
    'remote database',
    'Local mode',
    'Cloud sync on',
    'seeded',
  ];

  for (const phrase of blockedPhrases) {
    assert.doesNotMatch(
      source,
      new RegExp(escapeRegExp(phrase), 'i'),
      `${surfaceName} should not expose developer copy: ${phrase}`
    );
  }
}

test('train tab UX coverage stays in the fast test suite', () => {
  const pkg = readProjectJson('package.json');

  assert.equal(pkg.scripts.test, 'node --test tests/*.test.mjs');
  assert.match(pkg.scripts['test:all'], /npm run test/);

  for (const dependency of ['jest', 'jest-expo', '@testing-library/react-native', 'react-test-renderer']) {
    assert.equal(pkg.devDependencies?.[dependency], undefined, `${dependency} should not be needed for UX copy checks`);
  }
});

test('dedicated exercise browser route and stack screen are registered', () => {
  const route = readProjectFile('app/workout/exercises.tsx');
  const layout = readProjectFile('app/_layout.tsx');

  assert.equal(fileExists('app/workout/exercises.tsx'), true);
  assert.match(route, /export default function WorkoutExercisesScreen\(\)/);
  assert.match(route, /<Screen>[\s\S]*<ExerciseLibrary scrollMode="page" \/>[\s\S]*<\/Screen>/);
  assert.match(layout, /<Stack\.Screen[\s\S]*name="workout\/exercises"[\s\S]*title: 'Exercise Browser'[\s\S]*headerTintColor: '#a3e635'/);
});

test('train tab is a simplified hub and never renders the full ExerciseLibrary inline', () => {
  const workouts = readProjectFile('app/(tabs)/workouts.tsx');

  assert.doesNotMatch(workouts, /from '@\/src\/features\/workouts\/ExerciseLibrary'/);
  assert.doesNotMatch(workouts, /<ExerciseLibrary\b/);
  assert.match(workouts, /function browseExercises\(\) \{[\s\S]*router\.push\('\/workout\/exercises'\);[\s\S]*\}/);
  assert.match(workouts, /<Text className="text-2xl font-black text-base-content">Quick actions<\/Text>/);
  assert.doesNotMatch(workouts, /Quick start/);
  assertInOrder(workouts, ['title="Start workout"', 'title="Browse exercises"'], 'Start workout should remain the first quick action');
  assert.match(workouts, /title="Browse exercises"[\s\S]*onPress=\{browseExercises\}[\s\S]*variant="outline"/);
  assert.match(workouts, /Start a workout, log your sets, and review what you completed\./);
  assert.match(workouts, /MiniStat label="Recent sessions"/);
  assert.match(workouts, /MiniStat label="Sets logged"/);
  assert.doesNotMatch(workouts, /<MiniStat[^>]*label="Sync"/s);
  assertNoDeveloperCopy(workouts, 'Train tab');
});

test('repeat-last action is gated by history but the no-history guard remains', () => {
  const workouts = readProjectFile('app/(tabs)/workouts.tsx');

  assert.match(workouts, /async function repeatLastWorkout\(\)/);
  assert.match(workouts, /const repeatedWorkout = repeatLastCompletedWorkout\(userId\)/);
  assert.match(workouts, /if \(!repeatedWorkout\) \{[\s\S]*Alert\.alert\([\s\S]*'No completed workout yet',[\s\S]*'Finish a workout once, then Repeat Last Workout can preload those exercises\.'[\s\S]*\);[\s\S]*return;[\s\S]*\}/);
  assert.match(workouts, /\{recentSessions\.length > 0 \? \([\s\S]*title="Repeat Last Workout"[\s\S]*\) : null\}/);
  assert.doesNotMatch(workouts, /Nothing to repeat yet/);
});

test('exercise browser keeps filtering optional, detail modal intact, and picker selection wired', () => {
  const library = readProjectFile('src/features/workouts/ExerciseLibrary.tsx');
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(library, /const \[isFilterSheetOpen, setIsFilterSheetOpen\] = useState\(false\)/);
  assert.match(library, /const activeFilterCount = FILTERS\.filter\(\(filter\) => filters\[filter\.key\]\)\.length/);
  assert.match(library, /onPress=\{\(\) => setIsFilterSheetOpen\(true\)\}/);
  assert.match(library, /<Modal[\s\S]*visible=\{isFilterSheetOpen\}[\s\S]*<Text className="text-2xl font-black text-base-content" style=\{styles\.sheetTitle\}>Filters<\/Text>/);
  assert.match(library, /activeFilterCount > 0 \? `Filter \(\$\{activeFilterCount\}\)` : 'Filter'/);
  assert.match(library, /<Modal[\s\S]*visible=\{Boolean\(selectedExercise\)\}[\s\S]*Muscle diagram placeholder/);
  assert.match(library, /function selectExercise\(exercise: Exercise\) \{[\s\S]*onSelect\?\.\(exercise\);[\s\S]*setSelectedExercise\(null\);[\s\S]*\}/);
  assert.match(library, /\{onSelect \? \([\s\S]*<LibraryButton[\s\S]*title=\{selectButtonTitle\}[\s\S]*onPress=\{\(\) => selectExercise\(selectedExercise\)\}/);
  assert.match(live, /<ExerciseLibrary[\s\S]*onSelect=\{chooseExercise\}[\s\S]*selectButtonTitle="Use this exercise"/);
  assert.match(live, /function chooseExercise\(exercise: Exercise\) \{[\s\S]*rememberExerciseSelection\(exercise\);[\s\S]*setSelectedExercise\(exercise\);[\s\S]*setIsPickerOpen\(false\);/);
});

test('normal Train and ExerciseLibrary surfaces avoid developer-facing copy', () => {
  const workouts = readProjectFile('app/(tabs)/workouts.tsx');
  const library = readProjectFile('src/features/workouts/ExerciseLibrary.tsx');

  assertNoDeveloperCopy(workouts, 'Train tab');
  assertNoDeveloperCopy(library, 'ExerciseLibrary');
  assert.match(library, /Browse exercises, search quickly, and open details before adding one to a workout\./);
  assert.match(library, /No exercises are available right now\. Try again in a moment\./);
  assert.match(library, /The exercise list could not be loaded\. Try again in a moment\./);
  assert.match(library, /Clear the search or filters to get back to the full exercise list\./);
});
