import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeWhitespace, readProjectFile, readLiveWorkoutUiSource } from './helpers/project.mjs';

function assertInOrder(source, snippets, message = 'expected snippets to appear in order') {
  let cursor = -1;

  for (const snippet of snippets) {
    const nextIndex = source.indexOf(snippet, cursor + 1);
    assert.notEqual(nextIndex, -1, `${message}: missing ${snippet}`);
    assert.ok(nextIndex > cursor, `${message}: ${snippet} appeared out of order`);
    cursor = nextIndex;
  }
}

test('logged set editing state lives in the controller and opens a dedicated edit sheet', () => {
  const controller = readProjectFile('src/features/workouts/live/useLiveWorkoutController.ts');
  const view = readLiveWorkoutUiSource();

  assert.match(controller, /const \[editingSet, setEditingSet\] = useState<LocalWorkoutSet \| null>\(null\)/);
  assert.match(controller, /const \[editInputs, setEditInputs\] = useState<EditSetInputs>\(DEFAULT_EDIT_INPUTS\)/);
  assert.match(controller, /function openEditSheet\(set: LocalWorkoutSet\) \{/);
  assert.match(controller, /setEditInputs\(\{[\s\S]*reps: String\(set\.reps \?\? ''\),[\s\S]*weight: String\(set\.weight \?\? ''\),[\s\S]*\}\);/);
  assert.match(controller, /dispatch\(\{ type: 'sheet\.opened', sheet: 'edit-set' \}\);/);
  assert.match(view, /<EditSetSheet controller=\{controller\} \/>/);
});

test('recent set rows are tappable edit affordances without inline destructive targets', () => {
  const view = readLiveWorkoutUiSource();

  assert.match(view, /function RecentSetList\(/);
  assert.match(view, /sets\.map\(\(set\) => \(/);
  assert.match(view, /<Pressable\s+key=\{set\.local_id\}\s+onPress=\{\(\) => onEdit\(set\)\}/s);
  assert.match(view, /\{formatRecentSetLine\(set\)\}/);
  assert.match(view, />Edit<\/Text>/);
  assert.doesNotMatch(view, /onDelete\(set\.local_id\)/);
  assert.doesNotMatch(view, /hitSlop=\{10\}/);
  assert.doesNotMatch(view, /✕/);
});

test('saving an edited set validates input, updates local storage, closes the sheet, and refreshes sets', () => {
  const controller = readProjectFile('src/features/workouts/live/useLiveWorkoutController.ts');

  assert.match(controller, /function saveEditedSet\(\) \{/);
  assert.match(controller, /const parsedReps = Number\.parseInt\(editInputs\.reps, 10\)/);
  assert.match(controller, /const parsedWeight = Number\.parseFloat\(editInputs\.weight\)/);
  assert.match(controller, /setEditValidationMessage\('Enter a valid rep count\.'\)/);
  assert.match(controller, /setEditValidationMessage\('Enter a valid weight\.'\)/);
  assert.doesNotMatch(controller, /Alert\.alert/);
  assertInOrder(controller, [
    'updateLocalWorkoutSet(ownerId, editingSet.local_id, parsedReps, parsedWeight);',
    'setEditingSet(null);',
    "dispatch({ type: 'sheet.closed' });",
    'refreshSets();',
  ], 'saveEditedSet should persist, close the editor, and refresh');
});

test('deleting a set is moved into the edit sheet rather than a tiny row-level control', () => {
  const controller = readProjectFile('src/features/workouts/live/useLiveWorkoutController.ts');
  const view = readLiveWorkoutUiSource();

  assert.match(controller, /function deleteEditingSet\(\) \{/);
  assert.match(controller, /const setLocalId = editingSet\.local_id;/);
  assert.match(controller, /deleteLocalWorkoutSet\(ownerId, setLocalId\);/);
  assert.match(controller, /queueWorkoutSync\('deleting a set'\)/);
  assert.match(view, /<Button title="Delete set" onPress=\{controller\.deleteEditingSet\} variant="danger" \/>/);
});

test('new sets continue numbering within the active exercise only', () => {
  const controller = readProjectFile('src/features/workouts/live/useLiveWorkoutController.ts');
  const compact = normalizeWhitespace(controller);

  assert.match(controller, /const selectedExerciseSets = useMemo\(\(\) => \{[\s\S]*return exerciseSetMap\.get\(selectedExercise\.id\) \?\? \[\];[\s\S]*\}, \[exerciseSetMap, selectedExercise\]\);/);
  assert.match(controller, /const currentExerciseSets = exerciseSetMap\.get\(selectedExercise\.id\) \?\? \[\];/);
  assert.match(controller, /const setNumber = currentExerciseSets\.length \+ 1;/);
  assert.match(compact, /addLocalWorkoutSet\(\{ userId: ownerId, sessionLocalId: sessionId, exerciseId: selectedExercise\.id, setNumber,/);
});

test('workout service exposes explicit update and delete helpers for logged sets', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');

  assert.match(service, /export function updateLocalWorkoutSet\(\s*userId: string,\s*setLocalId: string,\s*reps: number,\s*weight: number\s*\)/);
  assert.match(service, /export function deleteLocalWorkoutSet\(userId: string, setLocalId: string\)/);
});

test('updateLocalWorkoutSet updates only reps, weight, sync status, and timestamp for the target set', () => {
  const service = normalizeWhitespace(readProjectFile('src/features/workouts/workout-service.ts'));

  assert.match(service, /update workout_sets_local set reps = \?, weight = \?, sync_status = 'pending', updated_at = \? where local_id = \?/);
  assert.match(service, /\[reps, weight, now, setLocalId\]/);
});

test('deleteLocalWorkoutSet reads the target row first and safely no-ops when it is already gone', () => {
  const service = readProjectFile('src/features/workouts/workout-service.ts');

  assertInOrder(service, [
    'export function deleteLocalWorkoutSet(userId: string, setLocalId: string) {',
    'const deleted = getOwnedWorkoutSet(userId, setLocalId);',
    'if (!deleted || deleted.is_deleted || deleted.deleted_at) return;',
  ], 'deleteLocalWorkoutSet should fetch the owner-scoped row before deletion');
  assert.match(service, /function getOwnedWorkoutSet[\s\S]*select ws\.\*[\s\S]*join workout_sessions_local s[\s\S]*where s\.user_id = \?[\s\S]*limit 1/);
});

test('deleteLocalWorkoutSet soft-deletes and renumbers only later sets from the same session and exercise', () => {
  const service = normalizeWhitespace(readProjectFile('src/features/workouts/workout-service.ts'));

  assert.match(service, /update workout_sets_local set is_deleted = 1, deleted_at = \?, sync_status = 'pending', updated_at = \? where local_id = \? and coalesce\(is_deleted, 0\) = 0/);
  assert.match(service, /select \* from workout_sets_local where session_local_id = \? and exercise_id = \? and coalesce\(is_deleted, 0\) = 0 and deleted_at is null and set_number > \? order by set_number asc/);
  assert.match(service, /set set_number = \?, sync_status = 'pending', updated_at = \? where local_id = \?/);
});

test('web local-db adapter handles every query shape used by set editing and deletion', () => {
  const localDb = normalizeWhitespace(readProjectFile('src/lib/local-db.ts'));

  assert.match(localDb, /from workout_sets_local.*where local_id = \?/);
  assert.match(localDb, /update workout_sets_local.*set reps =/);
  assert.match(localDb, /update workout_sets_local.*set set_number =/);
  assert.match(localDb, /is_deleted = 1/);
  assert.match(localDb, /deleted_at = \?/);
  assert.doesNotMatch(localDb, /normalized\.startsWith\('delete from workout_sets_local'\)/);
  assert.match(localDb, /session_local_id = \?.*exercise_id = \?.*set_number >/);
});
