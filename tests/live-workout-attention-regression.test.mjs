import assert from 'node:assert/strict';
import test from 'node:test';

import { fileExists, readLiveWorkoutUiSource, readProjectFile } from './helpers/project.mjs';

function lineCount(path) {
  return readProjectFile(path).split('\n').length;
}

test('live workout components are split so the route and view stay reviewable', () => {
  const requiredFiles = [
    'app/workout/session/[id].tsx',
    'src/features/workouts/live/useLiveWorkoutController.ts',
    'src/features/workouts/live/liveWorkoutState.ts',
    'src/features/workouts/live/liveWorkoutReducer.ts',
    'src/features/workouts/live/liveWorkoutSelectors.ts',
    'src/features/workouts/live/liveWorkoutFormatting.ts',
    'src/features/workouts/live/components/LiveWorkoutScreenView.tsx',
    'src/features/workouts/live/components/LiveWorkoutHeader.tsx',
    'src/features/workouts/live/components/ExerciseSwitcher.tsx',
    'src/features/workouts/live/components/ActiveSetLogger.tsx',
    'src/features/workouts/live/components/SetValueStepper.tsx',
    'src/features/workouts/live/components/RecentSetList.tsx',
    'src/features/workouts/live/components/DockedLogSetAction.tsx',
    'src/features/workouts/live/components/NoExerciseState.tsx',
    'src/features/workouts/live/components/SavedSetNotice.tsx',
    'src/features/workouts/live/components/sheets/BaseSheet.tsx',
    'src/features/workouts/live/components/sheets/ExercisePickerSheet.tsx',
    'src/features/workouts/live/components/sheets/TargetSettingsSheet.tsx',
    'src/features/workouts/live/components/sheets/EditSetSheet.tsx',
    'src/features/workouts/live/components/sheets/ExerciseInstructionsSheet.tsx',
    'src/features/workouts/live/components/sheets/FinishWorkoutSheet.tsx',
  ];

  for (const file of requiredFiles) {
    assert.equal(fileExists(file), true, `missing required live-workout file: ${file}`);
  }

  assert.ok(lineCount('app/workout/session/[id].tsx') <= 120, 'route must stay a shell');
  assert.ok(
    lineCount('src/features/workouts/live/components/LiveWorkoutScreenView.tsx') <= 180,
    'LiveWorkoutScreenView must stay composition-only'
  );

  for (const file of requiredFiles.filter((file) => file.includes('/components/'))) {
    assert.ok(lineCount(file) <= 220, `${file} is too large; split the component`);
  }
});

test('active logging exposes exactly one compact add-exercise affordance', () => {
  const switcher = readProjectFile('src/features/workouts/live/components/ExerciseSwitcher.tsx');
  const noExercise = readProjectFile('src/features/workouts/live/components/NoExerciseState.tsx');
  const dock = readProjectFile('src/features/workouts/live/components/DockedLogSetAction.tsx');
  const ui = readLiveWorkoutUiSource();

  assert.match(switcher, /accessibilityLabel="Add exercise"/);
  assert.match(switcher, />\+<\/Text>/);
  assert.doesNotMatch(switcher, /\+ Exercise|\+ Add exercise|\+ Add first exercise/);

  assert.match(noExercise, /title="Add first exercise"/);
  assert.doesNotMatch(noExercise, /title="\+ Add/);

  assert.doesNotMatch(dock, /openExercisePicker|Add first exercise|Add exercise|\+ Exercise/);
  assert.doesNotMatch(ui, /title="\+ Exercise"|>\+ Exercise<|title="\+ Add exercise"|title="\+ Add first exercise"/);
});

test('docked action is log-set only and finish stays out of the footer', () => {
  const dock = readProjectFile('src/features/workouts/live/components/DockedLogSetAction.tsx');
  const header = readProjectFile('src/features/workouts/live/components/LiveWorkoutHeader.tsx');

  assert.match(dock, /if \(!controller\.selectedExercise\) return null/);
  assert.match(dock, /onPress=\{controller\.addSet\}/);
  assert.match(dock, /\{controller\.currentSetDraft\.logButtonTitle\}/);
  assert.match(dock, /\{controller\.currentSetDraft\.logButtonDetail\}/);
  assert.doesNotMatch(dock, /openExercisePicker|openFinishSheet|Finish workout|\+ Exercise/);

  assert.match(header, /accessibilityLabel="Finish workout"/);
  assert.match(header, /onPress=\{controller\.openFinishSheet\}/);
});

test('primary live workout path stays quiet and free of dashboard copy', () => {
  const controller = readProjectFile('src/features/workouts/live/useLiveWorkoutController.ts');
  const ui = readLiveWorkoutUiSource();

  for (const forbidden of [
    'Workout feedback (optional)',
    'Other Exercises',
    'Best 1RM',
    'Ready to log',
    'Rest starts after a set',
    'Tap to edit',
    'Secondary settings stay out of the logging path',
  ]) {
    assert.doesNotMatch(ui, new RegExp(forbidden.replace(/[()]/g, '\\$&')));
  }

  assert.doesNotMatch(controller, /Alert\.alert/);
});
