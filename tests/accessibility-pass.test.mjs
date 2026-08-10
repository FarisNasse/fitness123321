import assert from 'node:assert/strict';
import test from 'node:test';

import { readProjectFile } from './helpers/project.mjs';

test('critical shared controls expose labels, states, and minimum touch targets', () => {
  const button = readProjectFile('src/components/Button.tsx');
  const input = readProjectFile('src/components/Input.tsx');
  const segmented = readProjectFile('src/components/SegmentedControl.tsx');
  const mood = readProjectFile('src/components/MoodSelector.tsx');
  const onboarding = readProjectFile('app/(onboarding)/index.tsx');

  assert.match(button, /accessibilityRole=/);
  assert.match(button, /min-h-11/);
  assert.match(input, /accessibilityLabel=/);
  assert.match(segmented, /accessibilityState=\{\{ selected/);
  assert.match(segmented, /min-h-11/);
  assert.match(mood, /accessibilityState=\{\{ selected/);
  assert.match(onboarding, /accessibilityState=\{\{ selected/);
});

test('critical dialogs opt into modal semantics and web focus trapping', () => {
  const hook = readProjectFile('src/lib/use-modal-focus-trap.ts');
  const nutrition = readProjectFile('app/(tabs)/nutrition.tsx');
  const progress = readProjectFile('app/(tabs)/progress.tsx');
  const library = readProjectFile('src/features/workouts/ExerciseLibrary.tsx');
  const sheet = readProjectFile('src/features/workouts/live/components/sheets/BaseSheet.tsx');

  assert.match(hook, /Shift|shiftKey/);
  assert.match(hook, /previouslyFocused/);
  for (const source of [nutrition, progress, library, sheet]) {
    assert.match(source, /useModalFocusTrap/);
    assert.match(source, /accessibilityViewIsModal/);
  }
});
