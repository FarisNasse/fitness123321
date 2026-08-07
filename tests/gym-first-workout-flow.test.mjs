import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeWhitespace, readProjectFile, readLiveWorkoutUiSource } from './helpers/project.mjs';

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

test('live workout route is now a small route shell instead of a 1600-line feature dashboard', () => {
  const route = readProjectFile('app/workout/session/[id].tsx');
  const lineCount = route.split('\n').length;

  assert.ok(lineCount < 150, `route should stay below 150 lines, found ${lineCount}`);
  assert.match(route, /useLiveWorkoutController/);
  assert.match(route, /<LiveWorkoutScreenView controller=\{result\.controller\} \/>/);
  assert.doesNotMatch(route, /ExerciseLibrary/);
  assert.doesNotMatch(route, /addLocalWorkoutSet/);
  assert.doesNotMatch(route, /Workout feedback \(optional\)/);
});

test('live workout state tracks draft provenance and dirty state so async defaults cannot overwrite manual edits', () => {
  const state = readProjectFile('src/features/workouts/live/liveWorkoutState.ts');
  const reducer = readProjectFile('src/features/workouts/live/liveWorkoutReducer.ts');

  assert.match(state, /export type SetDraftSource = 'suggested' \| 'last-set' \| 'manual'/);
  assert.match(state, /reps: string;[\s\S]*weight: string;[\s\S]*source: SetDraftSource;[\s\S]*dirty: boolean;/);
  assert.match(reducer, /case 'draft\.changed'/);
  assert.match(reducer, /source: 'manual',[\s\S]*dirty: true/);
  assert.match(reducer, /if \(currentDraft\?\.dirty && !event\.replaceDraft\) \{[\s\S]*return state;/);
});

test('controller builds the current set model from the active per-exercise draft and logs exactly those values', () => {
  const controller = readProjectFile('src/features/workouts/live/useLiveWorkoutController.ts');
  const compact = normalizeWhitespace(controller);

  assert.match(controller, /const activeDraft = selectedExercise\s*\? getDraftForExercise\(selectedExercise\.id\)\s*: DEFAULT_SET_DRAFT/s);
  assert.match(controller, /logButtonTitle: buildLogSetTitle/);
  assert.match(controller, /logButtonDetail: buildLogSetDetail\(activeDraft\)/);
  assert.match(controller, /function addSet\(\) \{/);
  assert.match(compact, /const parsed = parseSetInputs\(activeDraft\);/);
  assert.match(compact, /addLocalWorkoutSet\(\{ userId: ownerId, sessionLocalId: sessionId, exerciseId: selectedExercise\.id, setNumber, reps: parsed\.parsedReps, weight: parsed\.parsedWeight, \}\);/);
  assert.match(compact, /dispatch\(\{ type: 'rest\.started', seconds: REST_DURATION_SECONDS \}\);/);
});

test('primary live workout view is organized as a compact logger with recent-first set review and a docked primary action', () => {
  const view = readLiveWorkoutUiSource();

  assertInOrder(view, [
    '<LiveWorkoutHeader controller={controller} />',
    '<ExerciseSwitcher controller={controller} />',
    '<ActiveSetLogger controller={controller} />',
    '<RecentSetList',
    '<DockedLogSetAction',
  ], 'view should prioritize header, switcher, logger, recent sets, docked action');
  assertIncludes(view, 'Last');
  assertIncludes(view, 'Set {draft.setNumber}');
  assertIncludes(view, '{controller.currentSetDraft.logButtonTitle}');
  assertIncludes(view, '{controller.currentSetDraft.logButtonDetail}');
  assertIncludes(view, 'Recent sets');
  assert.doesNotMatch(view, /OTHER EXERCISES/);
  assert.doesNotMatch(view, /Workout feedback \(optional\)/);
});

test('quick adjustment controls mutate the same active draft that the logger persists', () => {
  const controller = readProjectFile('src/features/workouts/live/useLiveWorkoutController.ts');
  const view = readLiveWorkoutUiSource();

  assert.match(controller, /function adjustReps\(delta: number\)[\s\S]*updateSelectedDraft\(\{ reps: String\(nextValue\) \}\);/);
  assert.match(controller, /function adjustWeight\(delta: number\)[\s\S]*updateSelectedDraft\(\{ weight: formatWeightInput\(nextValue\) \}\);/);
  assert.match(view, /<StepperButton label=\{decrementLabel\} onPress=\{onDecrement\} \/>/);
  assert.match(view, /<StepperButton label=\{incrementLabel\} onPress=\{onIncrement\} \/>/);
  assert.match(view, /onChangeText=\{\(value\) => controller\.updateSelectedDraft\(\{ reps: value \}\)\}/);
  assert.match(view, /onChangeText=\{\(value\) => controller\.updateSelectedDraft\(\{ weight: value \}\)\}/);
});

test('secondary tasks are pushed into sheets instead of competing with Log set in the main flow', () => {
  const view = readLiveWorkoutUiSource();

  assert.match(view, /function TargetSettingsSheet/);
  assert.match(view, /function ExerciseInstructionsSheet/);
  assert.match(view, /function EditSetSheet/);
  assert.match(view, /function FinishWorkoutSheet/);
  assertIncludes(view, 'How did this workout feel?');
  assertIncludes(view, 'Delete set');
  assert.doesNotMatch(view, /hitSlop=\{10\}/);
  assert.doesNotMatch(view, /✕/);
});
