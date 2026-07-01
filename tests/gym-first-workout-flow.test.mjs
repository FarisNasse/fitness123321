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

test('live workout screen builds a current-set draft from the active exercise draft state', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /type SetDraft = \{\s*reps: string;\s*weight: string;\s*\}/s);
  assert.match(live, /const \[draftsByExerciseId, setDraftsByExerciseId\] = useState<DraftsByExerciseId>\(\{\}\)/);
  assert.match(live, /const selectedExerciseDraft = selectedExercise\s*\? getDraftForExercise\(selectedExercise\.id\)\s*: DEFAULT_SET_DRAFT/s);
  assert.match(live, /const currentSetDraft = useMemo\(/);
  assert.match(live, /exerciseName: selectedExercise\?\.name \?\? 'Choose an exercise'/);
  assert.match(live, /setNumber: selectedExercise \? selectedExerciseSets\.length \+ 1 : 1/);
  assert.match(live, /suggestedReps: selectedExerciseDraft\.reps/);
  assert.match(live, /suggestedWeight: selectedExerciseDraft\.weight/);
  assert.match(live, /logButtonLabel: buildLogSetButtonLabel\(/);
});

test('active exercise card prominently shows the next set, editable draft, and logged sets together', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assertInOrder(live, [
    'ACTIVE EXERCISE',
    '{currentSetDraft.exerciseName}',
    'NEXT SET',
    'Set {currentSetDraft.setNumber}',
    '<SetDraftEditor',
    'reps={currentSetDraft.suggestedReps}',
    'weight={currentSetDraft.suggestedWeight}',
    '{currentSetDraft.logButtonLabel}',
    'Logged sets',
    '<LoggedSetList',
  ], 'active exercise card should keep logging and review in one place');

  assert.match(live, /function SetDraftEditor\(/);
  assert.match(live, /function DraftInput\(/);
  assert.match(live, /function LoggedSetList\(/);
});

test('explicit Log set action saves through addSet and starts the rest timer', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /function buildLogSetButtonLabel\(setNumber: number, draft: SetDraft\)/);
  assert.match(live, /return `Log set \$\{setNumber\} — \$\{repsLabel\} @ \$\{formatWeightInput\(parsedWeight\)\} lb`/);
  assert.match(live, /<Pressable\s+disabled=\{!selectedExercise\}\s+onPress=\{addSet\}/s);
  assertInOrder(live, [
    '<Text style={{ color: colors.primaryContent, fontSize: 21, fontWeight: \'900\' }}>',
    '{currentSetDraft.logButtonLabel}',
    'Save this set and start rest timer',
  ], 'Log set button should be visually prominent and self-describing');
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
  ], 'Log set should route through the normal selected-exercise set logger');
});

test('quick adjustment controls change the active exercise draft values that are saved', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');
  const compact = normalizeWhitespace(live);

  assert.match(live, /const REP_STEP = 1/);
  assert.match(live, /const WEIGHT_STEP = 5/);
  assert.match(live, /function adjustReps\(delta: number\) \{[\s\S]*const draft = getDraftForExercise\(selectedExercise\.id\)[\s\S]*updateExerciseDraft\(selectedExercise\.id, \{ reps: String\(nextValue\) \}\);/);
  assert.match(live, /function adjustWeight\(delta: number\) \{[\s\S]*const draft = getDraftForExercise\(selectedExercise\.id\)[\s\S]*updateExerciseDraft\(selectedExercise\.id, \{ weight: formatWeightInput\(nextValue\) \}\);/);
  assert.match(live, /<StepperButton label=\{decrementLabel\} onPress=\{onDecrement\} \/>/);
  assert.match(live, /<StepperButton label=\{incrementLabel\} onPress=\{onIncrement\} \/>/);
  assert.match(live, /onWeightDown=\{\(\) => adjustWeight\(-activeIncrementSize\)\}/);
  assert.match(live, /onWeightUp=\{\(\) => adjustWeight\(activeIncrementSize\)\}/);
  assert.match(compact, /const draft = getDraftForExercise\(exerciseId\); const parsedReps = Number\.parseInt\(draft\.reps, 10\); const parsedWeight = Number\.parseFloat\(draft\.weight \|\| '0'\).*reps: parsed\.parsedReps, weight: parsed\.parsedWeight/s);
});

test('duplicated manual fallback is removed while editing and target settings remain available', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.doesNotMatch(live, /MANUAL FALLBACK/);
  assert.doesNotMatch(live, /<Button title="Add set" onPress=\{addSet\} disabled=\{!selectedExercise\} \/>/);
  assertIncludes(live, 'Edit targets');
  assert.match(live, /const \[isTargetSheetOpen, setIsTargetSheetOpen\] = useState\(false\)/);
  assert.match(live, /visible=\{isTargetSheetOpen && Boolean\(selectedExercise\)\}/);
  assert.match(live, /<TargetInput[\s\S]*label="Sets"[\s\S]*value=\{targetSetsInput\}/);
  assert.match(live, /<Button[\s\S]*title="Save targets"[\s\S]*onPress=\{saveSelectedExerciseTarget\}/);
  assert.match(live, /function openEditModal\(set: LocalWorkoutSet\) \{/);
  assert.match(live, /function saveEditedSet\(\) \{/);
  assert.match(live, /visible=\{Boolean\(editingSet\)\}/);
});
