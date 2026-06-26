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

test('live workout screen builds a current-set draft from the selected exercise and current inputs', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /const currentSetDraft = useMemo\(/);
  assert.match(live, /exerciseName: selectedExercise\?\.name \?\? 'Choose an exercise'/);
  assert.match(live, /setNumber: selectedExercise \? selectedExerciseSets\.length \+ 1 : 1/);
  assert.match(live, /suggestedReps: reps/);
  assert.match(live, /suggestedWeight: weight/);
});

test('current-set card prominently shows exercise name, set number, suggested reps, and suggested weight', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assertInOrder(live, [
    'CURRENT SET',
    '{currentSetDraft.exerciseName}',
    'NEXT UP',
    'Set {currentSetDraft.setNumber}',
    'Suggested for {currentSetDraft.exerciseName}',
    'label="Suggested reps"',
    'value={currentSetDraft.suggestedReps || \'—\'}',
    'label="Suggested weight"',
    "value={`${currentSetDraft.suggestedWeight || '—'} lb`}",
  ], 'current set card should expose every required draft field');

  assert.match(live, /function CurrentSetValue\(\{ label, value \}: \{ label: string; value: string \}\)/);
});

test('Done is the one-tap logging action and still starts the rest timer through addSet', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /<Pressable\s+disabled=\{!selectedExercise\}\s+onPress=\{addSet\}/s);
  assertInOrder(live, [
    '<Text style={{ color: colors.primaryContent, fontSize: 24, fontWeight: \'900\' }}>',
    'Done',
    'Log displayed values and start rest timer',
  ], 'Done button should be visually prominent and clear');
  assertInOrder(live, [
    'function logSetForExercise(exercise: Exercise) {',
    'addLocalWorkoutSet({',
    'reps: parsed.parsedReps,',
    'weight: parsed.parsedWeight,',
    'setRestSeconds(REST_DURATION_SECONDS);',
  ], 'logSetForExercise should save the displayed values and keep the rest timer');
  assertInOrder(live, [
    'function addSet() {',
    'if (!selectedExercise) return;',
    'logSetForExercise(selectedExercise);',
  ], 'Done should route through the normal selected-exercise set logger');
});

test('quick adjustment controls change the same reps and weight values that are saved', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');
  const compact = normalizeWhitespace(live);

  assert.match(live, /const REP_STEP = 1/);
  assert.match(live, /const WEIGHT_STEP = 5/);
  assert.match(live, /function adjustReps\(delta: number\) \{[\s\S]*setReps\(\(current\) => \{[\s\S]*Math\.max\(1,/);
  assert.match(live, /function adjustWeight\(delta: number\) \{[\s\S]*setWeight\(\(current\) => \{[\s\S]*Math\.max\(0,/);
  assert.match(live, /return formatWeightInput\(nextValue\);/);
  assert.match(live, /<QuickAdjustButton label="− rep" onPress=\{\(\) => adjustReps\(-REP_STEP\)\} \/>/);
  assert.match(live, /<QuickAdjustButton label="\+ rep" onPress=\{\(\) => adjustReps\(REP_STEP\)\} \/>/);
  assert.match(live, /<QuickAdjustButton label="− 5 lb" onPress=\{\(\) => adjustWeight\(-WEIGHT_STEP\)\} \/>/);
  assert.match(live, /<QuickAdjustButton label="\+ 5 lb" onPress=\{\(\) => adjustWeight\(WEIGHT_STEP\)\} \/>/);
  assert.match(compact, /const parsedReps = Number\.parseInt\(reps, 10\).*const parsedWeight = Number\.parseFloat\(weight\).*reps: parsed\.parsedReps, weight: parsed\.parsedWeight/);
});

test('manual add and edit flow remains available as the fallback path', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assertIncludes(live, 'MANUAL FALLBACK');
  assert.match(live, /value=\{reps\}\s+onChangeText=\{setReps\}/s);
  assert.match(live, /value=\{weight\}\s+onChangeText=\{setWeight\}/s);
  assert.match(live, /<Button title="Add set" onPress=\{addSet\} disabled=\{!selectedExercise\} \/>/);
  assert.match(live, /function openEditModal\(set: LocalWorkoutSet\) \{/);
  assert.match(live, /function saveEditedSet\(\) \{/);
  assert.match(live, /visible=\{Boolean\(editingSet\)\}/);
});
