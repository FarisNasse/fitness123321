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

test('live workout screen imports the helpers and types required for set review, editing, and deletion', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  for (const importedName of [
    'deleteLocalWorkoutSet',
    'getLocalWorkoutSets',
    'updateLocalWorkoutSet',
  ]) {
    assertIncludes(live, importedName, `live workout screen should import/use ${importedName}`);
  }

  assert.match(live, /import type \{ LocalWorkoutSet \} from '@\/src\/lib\/local-db';/);
});

test('live workout screen keeps explicit state for the currently edited set and pre-filled edit fields', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /const \[editingSet, setEditingSet\] = useState<LocalWorkoutSet \| null>\(null\)/);
  assert.match(live, /const \[editReps, setEditReps\] = useState\(''\)/);
  assert.match(live, /const \[editWeight, setEditWeight\] = useState\(''\)/);
});

test('logged set UI replaces the old count-only experience with one active exercise workspace', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.doesNotMatch(live, /Sets added:/, 'the old count-only label should not be the logged-set UI');
  assertIncludes(live, 'No exercises added');
  assertIncludes(live, 'ACTIVE EXERCISE');
  assertIncludes(live, 'Logged sets');
  assertIncludes(live, 'No sets logged for this exercise yet.');
  assertIncludes(live, '<WorkoutStatusPill label="Sets" value={String(sets.length)} />');
  assertIncludes(live, 'selectedExerciseSets.map((set) => (');
});

test('logged sets are grouped by exercise and restore exercise cards from logged set data', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /function buildExerciseSetMap\(sets: LocalWorkoutSetRow\[\]\) \{/);
  assert.match(live, /sets\.reduce\(\(map, set\) => \{/);
  assert.match(live, /const exerciseSets = map\.get\(set\.exercise_id\) \?\? \[\]/);
  assert.match(live, /map\.set\(set\.exercise_id, \[\.\.\.exerciseSets, set\]\)/);
  assert.match(live, /function resolveExercise\(exerciseId: string\) \{/);
  assert.match(live, /exerciseLookup\[exerciseId\] \?\? getExerciseById\(exerciseId\) \?\? null/);
  assert.match(live, /Array\.from\(nextMap\.keys\(\)\)\s*\.map\(\(exerciseId\) => resolveExercise\(exerciseId\)\)/);
  assert.match(live, /selectedExercises\.map\(\(exercise\) => \{/);
  assertIncludes(live, '{exercise.name}');
});

test('each logged set renders as a tappable row showing set number plus reps times weight', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /selectedExerciseSets\.map\(\(set\) => \(/);
  assert.match(live, /<Pressable\s+key=\{set\.local_id\}\s+onPress=\{\(\) => openEditModal\(set\)\}/s);
  assertIncludes(live, 'Set {set.set_number}');
  assertIncludes(live, '{set.reps ?? 0} reps × {set.weight ?? 0} lb');
});

test('tapping a set row opens editing with the existing reps and weight pre-filled', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /function openEditModal\(set: LocalWorkoutSet\) \{/);
  assertInOrder(live, [
    'function openEditModal(set: LocalWorkoutSet) {',
    'setEditingSet(set);',
    "setEditReps(String(set.reps ?? ''));",
    "setEditWeight(String(set.weight ?? ''));",
  ], 'openEditModal should populate edit state from the tapped set');
});

test('saveEditedSet validates edited values before writing them back to local storage', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /function saveEditedSet\(\) \{/);
  assert.match(live, /const parsedReps = Number\.parseInt\(editReps, 10\)/);
  assert.match(live, /const parsedWeight = Number\.parseFloat\(editWeight\)/);
  assert.match(live, /Alert\.alert\('Invalid reps', 'Enter a valid rep count\.'\)/);
  assert.match(live, /Alert\.alert\('Invalid weight', 'Enter a valid weight\.'\)/);
});

test('saving an edited set updates the existing local set, closes the editor, and refreshes the list', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assertInOrder(live, [
    'updateLocalWorkoutSet(editingSet.local_id, parsedReps, parsedWeight);',
    'setEditingSet(null);',
    'refreshSets();',
  ], 'saveEditedSet should persist, close, and refresh in that order');
});

test('edit modal is wired to the editing state and uses the edit-specific input values', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /visible=\{Boolean\(editingSet\)\}/);
  assert.match(live, /onRequestClose=\{\(\) => setEditingSet\(null\)\}/);
  assertIncludes(live, 'Edit Set {editingSet?.set_number}');
  assert.match(live, /value=\{editReps\}\s+onChangeText=\{setEditReps\}/s);
  assert.match(live, /value=\{editWeight\}\s+onChangeText=\{setEditWeight\}/s);
  assert.match(live, /onPress=\{saveEditedSet\}[\s\S]*<Text style=\{\{ color: colors\.primaryContent, fontWeight: '900' \}\}>Save<\/Text>/);
});

test('delete control is separate from row editing and stops event propagation', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /onPress=\{\((event|e)\) => \{\s*(event|e)\.stopPropagation\(\);\s*confirmDeleteSet\(set\.local_id\);\s*\}\}/s);
  assertIncludes(live, 'hitSlop={10}');
  assertIncludes(live, '✕');
});

test('delete confirmation uses a destructive action that removes the set and refreshes the screen', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /function confirmDeleteSet\(setLocalId: string\) \{/);
  assertIncludes(live, "Alert.alert('Remove set', 'Delete this set?', [");
  assert.match(live, /\{ text: 'Cancel', style: 'cancel' \}/);
  assert.match(live, /text: 'Delete',[\s\S]*style: 'destructive',[\s\S]*onPress: \(\) => \{[\s\S]*deleteLocalWorkoutSet\(setLocalId\);[\s\S]*refreshSets\(\);[\s\S]*\}/);
});

test('new sets continue numbering within the exercise being logged', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /const selectedExerciseSets = useMemo\(\(\) => \{[\s\S]*return exerciseSetMap\.get\(selectedExercise\.id\) \?\? \[\];[\s\S]*\}, \[exerciseSetMap, selectedExercise\]\);/);
  assert.match(live, /function logSetForExercise\(exercise: Exercise\) \{/);
  assert.match(live, /const currentExerciseSets = exerciseSetMap\.get\(exercise\.id\) \?\? \[\]/);
  assert.match(live, /setNumber: currentExerciseSets\.length \+ 1/);
  assert.match(live, /function addSet\(\) \{[\s\S]*logSetForExercise\(selectedExercise\);[\s\S]*\}/);
});

test('compact exercise list only switches the active exercise and never logs from inactive rows', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assertIncludes(live, 'One active exercise at a time. Switch exercises below when you are ready.');
  assert.match(live, /selectedExercises\.map\(\(exercise\) => \{/);
  assert.match(live, /onPress=\{\(\) => void selectExerciseForLogging\(exercise\)\}/);
  assertIncludes(live, '<Badge label="Active" variant="primary" />');
  assertIncludes(live, 'Switch</Text>');
  assert.doesNotMatch(live, /onPress=\{\(\) => logSetForExercise\(exercise\)\}/);
  assert.doesNotMatch(live, /handleExerciseCardAction/);
});

test('workout service exposes explicit update and delete helpers for logged sets', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');

  assert.match(service, /export function updateLocalWorkoutSet\(\s*setLocalId: string,\s*reps: number,\s*weight: number\s*\)/);
  assert.match(service, /export function deleteLocalWorkoutSet\(setLocalId: string\)/);
});

test('updateLocalWorkoutSet updates only reps, weight, sync status, and timestamp for the target set', () => {
  const service = normalizeWhitespace(readProjectFile('src/features/workouts/workout-service.ts'));

  assert.match(service, /update workout_sets_local set reps = \?, weight = \?, sync_status = 'pending', updated_at = \? where local_id = \?/);
  assert.match(service, /\[reps, weight, now, setLocalId\]/);
});

test('deleteLocalWorkoutSet reads the target row first and safely no-ops when it is already gone', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');

  assertInOrder(service, [
    'export function deleteLocalWorkoutSet(setLocalId: string) {',
    'select *',
    'from workout_sets_local',
    'where local_id = ?',
    'limit 1',
    'if (!deleted || deleted.is_deleted || deleted.deleted_at) return;',
  ], 'deleteLocalWorkoutSet should fetch the deleted row before deletion');
});

test('deleteLocalWorkoutSet soft-deletes exactly the requested local set id', () => {
  const service = normalizeWhitespace(readProjectFile('src/features/workouts/workout-service.ts'));

  assert.match(service, /update workout_sets_local set is_deleted = 1, deleted_at = \?, sync_status = 'pending', updated_at = \? where local_id = \? and coalesce\(is_deleted, 0\) = 0/);
  assert.match(service, /\[now, now, setLocalId\]/);
});

test('deleteLocalWorkoutSet renumbers only later sets from the same session and exercise', () => {
  const service = normalizeWhitespace(readProjectFile('src/features/workouts/workout-service.ts'));

  assert.match(service, /select \* from workout_sets_local where session_local_id = \? and exercise_id = \? and coalesce\(is_deleted, 0\) = 0 and deleted_at is null and set_number > \? order by set_number asc/);
  assert.match(service, /\[deleted\.session_local_id, deleted\.exercise_id, deleted\.set_number\]/);
});

test('deleteLocalWorkoutSet decrements every remaining later set and queues each for sync', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');

  assert.match(service, /for \(const s of toRenumber\) \{/);
  assert.match(service, /update workout_sets_local\s+set set_number = \?,\s+sync_status = 'pending',\s+updated_at = \?\s+where local_id = \?/s);
  assert.match(service, /\[s\.set_number - 1, now, s\.local_id\]/);
});

test('web local-db adapter handles every query shape used by set editing and deletion', () => {
  const localDb = normalizeWhitespace(readProjectFile('src/lib/local-db.ts'));

  assert.match(localDb, /from workout_sets_local.*where local_id = \?/);
  assert.match(localDb, /update workout_sets_local.*set reps =/);
  assert.match(localDb, /update workout_sets_local.*set set_number =/);
  assert.match(localDb, /is_deleted = 1/);
  assert.match(localDb, /deleted_at = \?/);
  assert.doesNotMatch(localDb, /delete from workout_sets_local/);
  assert.match(localDb, /session_local_id = \?.*exercise_id = \?.*set_number >/);
});
