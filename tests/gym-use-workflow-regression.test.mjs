import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import { normalizeWhitespace, readProjectFile, readProjectJson } from './helpers/project.mjs';

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isDeletedRecord(record) {
  return Boolean(record.deleted_at) || record.is_deleted === 1 || record.is_deleted === true;
}

function createWorkoutStore() {
  return {
    workout_sessions_local: [],
    workout_session_exercises_local: [],
    exercise_targets_local: [],
    workout_sets_local: [],
  };
}

function createWorkoutHarness(store = createWorkoutStore()) {
  let uuidCounter = 0;
  const nextUuid = () => `test-uuid-${String(++uuidCounter).padStart(4, '0')}`;

  function getExercisesBySession(sessionLocalId) {
    return store.workout_session_exercises_local
      .filter((item) => item.session_local_id === sessionLocalId)
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  }

  function getExerciseIdsBySessionFromSets(sessionLocalId) {
    const seenExerciseIds = new Set();
    const rows = [];

    for (const set of store.workout_sets_local) {
      if (set.session_local_id !== sessionLocalId || isDeletedRecord(set)) continue;
      if (seenExerciseIds.has(set.exercise_id)) continue;

      seenExerciseIds.add(set.exercise_id);
      rows.push({ exercise_id: set.exercise_id });
    }

    return rows;
  }

  function getSetsBySession(sessionLocalId) {
    return store.workout_sets_local
      .filter((set) => set.session_local_id === sessionLocalId && !isDeletedRecord(set))
      .sort((a, b) => Number(a.set_number) - Number(b.set_number));
  }

  function getSetsBySessionForSync(sessionLocalId) {
    return store.workout_sets_local.filter((set) => set.session_local_id === sessionLocalId);
  }

  const db = {
    runSync(sql, params = []) {
      const normalized = normalizeSql(sql);

      if (normalized.startsWith('insert into workout_sessions_local')) {
        const [localId, userId, name, startedAt, updatedAt] = params;
        store.workout_sessions_local.push({
          local_id: localId,
          server_id: null,
          user_id: userId,
          name,
          started_at: startedAt,
          completed_at: null,
          duration_seconds: null,
          notes: null,
          is_deleted: 0,
          deleted_at: null,
          sync_status: 'pending',
          updated_at: updatedAt,
        });
        return;
      }

      if (normalized.startsWith('insert or ignore into workout_session_exercises_local')) {
        const [localId, sessionLocalId, exerciseId, sortOrder, createdAt, updatedAt] = params;
        const existing = store.workout_session_exercises_local.some(
          (item) => item.session_local_id === sessionLocalId && item.exercise_id === exerciseId
        );

        if (!existing) {
          store.workout_session_exercises_local.push({
            local_id: localId,
            session_local_id: sessionLocalId,
            exercise_id: exerciseId,
            sort_order: sortOrder,
            created_at: createdAt,
            updated_at: updatedAt,
          });
        }
        return;
      }

      if (normalized.startsWith('insert into workout_sets_local')) {
        const [localId, sessionLocalId, exerciseId, setNumber, reps, weight, updatedAt] = params;
        store.workout_sets_local.push({
          local_id: localId,
          server_id: null,
          session_local_id: sessionLocalId,
          exercise_id: exerciseId,
          set_number: setNumber,
          reps,
          weight,
          completed: 1,
          is_deleted: 0,
          deleted_at: null,
          sync_status: 'pending',
          updated_at: updatedAt,
        });
        return;
      }

      if (normalized.startsWith('insert into exercise_targets_local')) {
        const [localId, exerciseId, targetSets, repMin, repMax, incrementSize, deloadPercentage, updatedAt] = params;
        const existing = store.exercise_targets_local.find((target) => target.exercise_id === exerciseId);
        const next = {
          local_id: existing?.local_id ?? localId,
          exercise_id: exerciseId,
          target_sets: targetSets,
          rep_min: repMin,
          rep_max: repMax,
          increment_size: incrementSize,
          deload_percentage: deloadPercentage,
          sync_status: 'pending',
          updated_at: updatedAt,
        };

        if (existing) {
          Object.assign(existing, next);
        } else {
          store.exercise_targets_local.push(next);
        }
        return;
      }

      if (normalized.startsWith('update workout_sessions_local') && normalized.includes('set completed_at')) {
        const [completedAt, durationNow, updatedAt, sessionLocalId] = params;
        const session = store.workout_sessions_local.find((item) => item.local_id === sessionLocalId);

        if (session) {
          session.completed_at = completedAt;
          session.duration_seconds = Math.max(
            0,
            Math.round((Date.parse(String(durationNow)) - Date.parse(String(session.started_at))) / 1000)
          );
          session.sync_status = 'pending';
          session.updated_at = updatedAt;
        }
        return;
      }

      if (normalized.startsWith('update workout_sessions_local') && normalized.includes("set sync_status = 'pending'")) {
        const [updatedAt, sessionLocalId] = params;
        const session = store.workout_sessions_local.find((item) => item.local_id === sessionLocalId);

        if (session) {
          session.sync_status = 'pending';
          session.updated_at = updatedAt;
        }
        return;
      }

      throw new Error(`Unsupported runSync SQL in workout harness: ${normalized}`);
    },

    getAllSync(sql, params = []) {
      const normalized = normalizeSql(sql);

      if (normalized.includes('from exercise_targets_local') && normalized.includes('exercise_id = ?')) {
        const [exerciseId] = params;
        return store.exercise_targets_local.filter((target) => target.exercise_id === exerciseId);
      }

      if (
        normalized.includes('from workout_sets_local ws') &&
        normalized.includes('join workout_sessions_local s') &&
        normalized.includes('ws.exercise_id = ?')
      ) {
        const [exerciseId] = params;
        const latestSession = store.workout_sessions_local
          .filter((session) => session.completed_at && !isDeletedRecord(session))
          .filter((session) =>
            store.workout_sets_local.some(
              (set) => set.session_local_id === session.local_id && set.exercise_id === exerciseId && !isDeletedRecord(set)
            )
          )
          .sort((a, b) => {
            const completedDiff = Date.parse(String(b.completed_at)) - Date.parse(String(a.completed_at));
            if (completedDiff !== 0) return completedDiff;
            return Date.parse(String(b.started_at)) - Date.parse(String(a.started_at));
          })[0];

        if (!latestSession) return [];

        return store.workout_sets_local
          .filter((set) => set.session_local_id === latestSession.local_id && set.exercise_id === exerciseId && !isDeletedRecord(set))
          .sort((a, b) => Number(a.set_number) - Number(b.set_number));
      }

      if (normalized.includes('from workout_sessions_local') && normalized.includes('order by started_at desc')) {
        const hasUserFilter = normalized.includes('user_id = ?');
        const userId = hasUserFilter ? params[0] : null;
        const limit = Number(hasUserFilter ? params[1] : params[0]);
        const completedOnly = normalized.includes('completed_at is not null');

        return [...store.workout_sessions_local]
          .filter((session) => !userId || session.user_id === userId)
          .filter((session) => !completedOnly || Boolean(session.completed_at))
          .filter((session) => !isDeletedRecord(session))
          .sort((a, b) => Date.parse(String(b.started_at)) - Date.parse(String(a.started_at)))
          .slice(0, limit || 5);
      }

      if (normalized.includes('from workout_session_exercises_local') && normalized.includes('session_local_id = ?')) {
        const [sessionLocalId] = params;
        return getExercisesBySession(sessionLocalId);
      }

      if (normalized.includes('from workout_sets_local') && normalized.includes('group by exercise_id')) {
        const [sessionLocalId] = params;
        return getExerciseIdsBySessionFromSets(sessionLocalId);
      }

      if (normalized.includes('from workout_sets_local') && normalized.includes('session_local_id = ?')) {
        const [sessionLocalId] = params;
        return getSetsBySession(sessionLocalId);
      }

      throw new Error(`Unsupported getAllSync SQL in workout harness: ${normalized}`);
    },
  };

  return {
    store,
    globals: {
      db,
      getExerciseIdsBySessionFromSets,
      getExercisesBySession,
      getSetsBySession,
      getSetsBySessionForSync,
      LOCAL_DEV_USER_ID: '00000000-0000-0000-0000-000000000999',
      USE_REMOTE_WORKOUT_SYNC: false,
      Crypto: { randomUUID: nextUuid },
      buildProgressionRecommendation: () => ({ decision: 'repeat' }),
      buildProgressionSummaryLines: () => [],
    },
  };
}

function extractConstDeclaration(source, name) {
  const start = source.indexOf(`const ${name}`);
  assert.notEqual(start, -1, `${name} should exist in workout-service.ts`);

  const end = source.indexOf('};', start);
  assert.notEqual(end, -1, `${name} declaration should end with };`);

  return source.slice(start, end + 2);
}

function extractFunctionDeclaration(source, name) {
  const nameIndex = source.indexOf(`function ${name}`);
  assert.notEqual(nameIndex, -1, `${name} should exist in workout-service.ts`);

  const lineStart = source.lastIndexOf('\n', nameIndex) + 1;
  const openBrace = source.indexOf('{', nameIndex);
  assert.notEqual(openBrace, -1, `${name} should have a function body`);

  let depth = 0;

  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      return source.slice(lineStart, index + 1);
    }
  }

  throw new Error(`Could not find the end of ${name}`);
}

function stripWorkoutServiceTypescript(source) {
  const stripFunctionParameters = (match, prefix, functionName, parameters) => {
    const strippedParameters = parameters
      .split(',')
      .map((parameter) =>
        parameter
          .replace(/\?/g, '')
          .replace(/:\s*[^=]+$/, '')
          .trim()
      )
      .join(', ');

    return `${prefix}function${functionName}(${strippedParameters})`;
  };

  return source
    .replace(/db\.getAllSync<[^>]+>/g, 'db.getAllSync')
    .replace(
      /((?:export\s+)?(?:async\s+)?)function(\s+[A-Za-z_$][\w$]*\s*)\(([\s\S]*?)\)\s*(?::\s*[A-Za-z_$][\w$<>\[\]\s|&,.:'"@\/\?]*)?/g,
      stripFunctionParameters
    );
}

function buildExecutableWorkoutServiceSource(source) {
  const declarations = [
    extractConstDeclaration(source, 'STANDARD_EXERCISE_DEFAULTS'),
    extractFunctionDeclaration(source, 'toPositiveInteger'),
    extractFunctionDeclaration(source, 'toPositiveNumber'),
    extractFunctionDeclaration(source, 'toNonNegativeNumber'),
    extractFunctionDeclaration(source, 'normalizeExerciseTarget'),
    extractFunctionDeclaration(source, 'buildFallbackSuggestedSets'),
    extractFunctionDeclaration(source, 'getLocalExerciseTarget'),
    extractFunctionDeclaration(source, 'getRecentCompletedExerciseSets'),
    extractFunctionDeclaration(source, 'getSmartExerciseDefaults'),
    extractFunctionDeclaration(source, 'createLocalWorkoutSession'),
    extractFunctionDeclaration(source, 'getMostRecentCompletedWorkoutSession'),
    extractFunctionDeclaration(source, 'buildFallbackWorkoutSessionExercises'),
    extractFunctionDeclaration(source, 'insertLocalWorkoutSessionExercise'),
    extractFunctionDeclaration(source, 'getLocalWorkoutSessionExercises'),
    extractFunctionDeclaration(source, 'addLocalWorkoutSessionExercise'),
    extractFunctionDeclaration(source, 'repeatLastCompletedWorkout'),
    extractFunctionDeclaration(source, 'getLocalWorkoutSets'),
  ];

  return stripWorkoutServiceTypescript(declarations.join('\n\n'));
}

async function loadWorkoutServiceWithHarness(globals) {
  const tempDir = mkdtempSync(join(tmpdir(), 'workout-service-harness-'));

  try {
    const source = readFileSync(resolve('src/features/workouts/workout-service.ts'), 'utf8');
    const executableServiceSource = buildExecutableWorkoutServiceSource(source);
    const harnessPrelude = `
const {
  db,
  getExerciseIdsBySessionFromSets,
  getExercisesBySession,
  getSetsBySession,
  getSetsBySessionForSync,
  LOCAL_DEV_USER_ID,
  USE_REMOTE_WORKOUT_SYNC,
  Crypto,
  buildProgressionRecommendation,
  buildProgressionSummaryLines,
} = globalThis.__workoutServiceHarness;
`;
    const modulePath = join(tempDir, 'workout-service.mjs');

    globalThis.__workoutServiceHarness = globals;
    writeFileSync(modulePath, `${harnessPrelude}\n${executableServiceSource}`);

    return await import(`${pathToFileURL(resolve(modulePath)).href}?t=${Date.now()}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('repeating a workout creates a fresh session and leaves the original session and sets unchanged', async () => {
  const { store, globals } = createWorkoutHarness();
  const service = await loadWorkoutServiceWithHarness(globals);

  store.workout_sessions_local.push({
    local_id: 'old-session',
    server_id: 'remote-old-session',
    user_id: 'user-1',
    name: 'Push day',
    started_at: '2026-06-20T10:00:00.000Z',
    completed_at: '2026-06-20T11:00:00.000Z',
    duration_seconds: 3600,
    notes: null,
    is_deleted: 0,
    deleted_at: null,
    sync_status: 'synced',
    updated_at: '2026-06-20T11:00:00.000Z',
  });
  store.workout_session_exercises_local.push(
    {
      local_id: 'old-pick-1',
      session_local_id: 'old-session',
      exercise_id: 'bench-press',
      sort_order: 1,
      created_at: '2026-06-20T10:00:00.000Z',
      updated_at: '2026-06-20T10:00:00.000Z',
    },
    {
      local_id: 'old-pick-2',
      session_local_id: 'old-session',
      exercise_id: 'row',
      sort_order: 2,
      created_at: '2026-06-20T10:00:00.000Z',
      updated_at: '2026-06-20T10:00:00.000Z',
    }
  );
  store.workout_sets_local.push(
    {
      local_id: 'old-set-1',
      server_id: 'remote-old-set-1',
      session_local_id: 'old-session',
      exercise_id: 'bench-press',
      set_number: 1,
      reps: 8,
      weight: 135,
      completed: 1,
      is_deleted: 0,
      deleted_at: null,
      sync_status: 'synced',
      updated_at: '2026-06-20T10:20:00.000Z',
    },
    {
      local_id: 'old-set-2',
      server_id: 'remote-old-set-2',
      session_local_id: 'old-session',
      exercise_id: 'row',
      set_number: 1,
      reps: 10,
      weight: 95,
      completed: 1,
      is_deleted: 0,
      deleted_at: null,
      sync_status: 'synced',
      updated_at: '2026-06-20T10:25:00.000Z',
    }
  );

  const originalSessions = clone(store.workout_sessions_local);
  const originalSets = clone(store.workout_sets_local);
  const repeated = service.repeatLastCompletedWorkout('user-1');

  assert.equal(repeated.sourceSessionLocalId, 'old-session');
  assert.equal(repeated.exerciseCount, 2);
  assert.notEqual(repeated.sessionLocalId, 'old-session');

  assert.deepEqual(store.workout_sessions_local.find((session) => session.local_id === 'old-session'), originalSessions[0]);
  assert.deepEqual(store.workout_sets_local, originalSets);

  const newSession = store.workout_sessions_local.find((session) => session.local_id === repeated.sessionLocalId);
  assert.ok(newSession, 'repeat should create a new workout session');
  assert.equal(newSession.name, 'Repeat: Push day');
  assert.equal(newSession.completed_at, null);

  assert.deepEqual(
    store.workout_session_exercises_local
      .filter((exercise) => exercise.session_local_id === repeated.sessionLocalId)
      .map((exercise) => ({ exerciseId: exercise.exercise_id, sortOrder: exercise.sort_order })),
    [
      { exerciseId: 'bench-press', sortOrder: 1 },
      { exerciseId: 'row', sortOrder: 2 },
    ]
  );
  assert.equal(
    store.workout_sets_local.filter((set) => set.session_local_id === repeated.sessionLocalId).length,
    0,
    'repeat should not clone logged set rows into the new session'
  );
});

test('suggested defaults come from the most recent completed history for that exercise', async () => {
  const { store, globals } = createWorkoutHarness();
  const service = await loadWorkoutServiceWithHarness(globals);

  store.exercise_targets_local.push({
    local_id: 'target-bench',
    exercise_id: 'bench-press',
    target_sets: 4,
    rep_min: 6,
    rep_max: 10,
    increment_size: 2.5,
    deload_percentage: 15,
    sync_status: 'synced',
    updated_at: '2026-06-01T00:00:00.000Z',
  });
  store.workout_sessions_local.push(
    {
      local_id: 'older-session',
      user_id: 'user-1',
      name: 'Older push day',
      started_at: '2026-06-10T10:00:00.000Z',
      completed_at: '2026-06-10T11:00:00.000Z',
      is_deleted: 0,
      deleted_at: null,
      sync_status: 'synced',
      updated_at: '2026-06-10T11:00:00.000Z',
    },
    {
      local_id: 'latest-session',
      user_id: 'user-1',
      name: 'Latest push day',
      started_at: '2026-06-18T10:00:00.000Z',
      completed_at: '2026-06-18T11:00:00.000Z',
      is_deleted: 0,
      deleted_at: null,
      sync_status: 'synced',
      updated_at: '2026-06-18T11:00:00.000Z',
    }
  );
  store.workout_sets_local.push(
    {
      local_id: 'older-set-1',
      session_local_id: 'older-session',
      exercise_id: 'bench-press',
      set_number: 1,
      reps: 8,
      weight: 100,
      completed: 1,
      is_deleted: 0,
      deleted_at: null,
      sync_status: 'synced',
      updated_at: '2026-06-10T10:15:00.000Z',
    },
    {
      local_id: 'latest-set-1',
      session_local_id: 'latest-session',
      exercise_id: 'bench-press',
      set_number: 1,
      reps: 10,
      weight: 105,
      completed: 1,
      is_deleted: 0,
      deleted_at: null,
      sync_status: 'synced',
      updated_at: '2026-06-18T10:15:00.000Z',
    },
    {
      local_id: 'latest-set-2',
      session_local_id: 'latest-session',
      exercise_id: 'bench-press',
      set_number: 2,
      reps: 9,
      weight: 105,
      completed: 1,
      is_deleted: 0,
      deleted_at: null,
      sync_status: 'synced',
      updated_at: '2026-06-18T10:20:00.000Z',
    },
    {
      local_id: 'deleted-latest-set',
      session_local_id: 'latest-session',
      exercise_id: 'bench-press',
      set_number: 3,
      reps: 1,
      weight: 1,
      completed: 1,
      is_deleted: 1,
      deleted_at: '2026-06-18T10:25:00.000Z',
      sync_status: 'pending',
      updated_at: '2026-06-18T10:25:00.000Z',
    }
  );

  const defaults = await service.getSmartExerciseDefaults('bench-press');

  assert.equal(defaults.source, 'history');
  assert.equal(defaults.targetSets, 4, 'saved target set count should extend shorter recent history');
  assert.equal(defaults.repMin, 6);
  assert.equal(defaults.repMax, 10);
  assert.equal(defaults.incrementSize, 2.5);
  assert.equal(defaults.deloadPercentage, 15);
  assert.deepEqual(defaults.suggestedSets, [
    { setNumber: 1, reps: 10, weight: 105 },
    { setNumber: 2, reps: 9, weight: 105 },
    { setNumber: 3, reps: 9, weight: 105 },
    { setNumber: 4, reps: 9, weight: 105 },
  ]);
});

test('one-tap Done saves the reps and weight currently displayed in the live workout card', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');
  const compact = normalizeWhitespace(live);

  assert.match(live, /suggestedReps: reps/);
  assert.match(live, /suggestedWeight: weight/);
  assert.match(live, /<Pressable\s+disabled=\{!selectedExercise\}\s+onPress=\{addSet\}/s);
  assert.match(compact, /function addSet\(\) \{ if \(!selectedExercise\) return; logSetForExercise\(selectedExercise\); \}/);
  assert.match(
    compact,
    /function parseSetInputs\(\) \{ const parsedReps = Number\.parseInt\(reps, 10\); const parsedWeight = Number\.parseFloat\(weight\);/,
    'the parser should read the same reps and weight state shown in the card'
  );
  assert.match(
    compact,
    /addLocalWorkoutSet\(\{ sessionLocalId: sessionId, exerciseId: exercise\.id, setNumber: currentExerciseSets\.length \+ 1, reps: parsed\.parsedReps, weight: parsed\.parsedWeight, \}\);/,
    'the one-tap logger should persist the parsed displayed values'
  );
});

test('quick adjustments mutate the displayed values that the next saved set uses', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');
  const compact = normalizeWhitespace(live);

  assert.match(live, /function adjustReps\(delta: number\) \{[\s\S]*setReps\(\(current\) => \{[\s\S]*return String\(nextValue\);[\s\S]*\}/);
  assert.match(live, /function adjustWeight\(delta: number\) \{[\s\S]*setWeight\(\(current\) => \{[\s\S]*return formatWeightInput\(nextValue\);[\s\S]*\}/);
  assert.match(live, /<QuickAdjustButton label="− rep" onPress=\{\(\) => adjustReps\(-REP_STEP\)\} \/>/);
  assert.match(live, /<QuickAdjustButton label="\+ rep" onPress=\{\(\) => adjustReps\(REP_STEP\)\} \/>/);
  assert.match(live, /onPress=\{\(\) => adjustWeight\(-activeIncrementSize\)\}/);
  assert.match(live, /onPress=\{\(\) => adjustWeight\(activeIncrementSize\)\}/);
  assert.match(
    compact,
    /suggestedReps: reps, suggestedWeight: weight,[\s\S]*const parsedReps = Number\.parseInt\(reps, 10\); const parsedWeight = Number\.parseFloat\(weight\);/,
    'quick-adjusted display state should be the same state parsed for persistence'
  );
});

test('gym workflow regression coverage runs through npm run test:all', () => {
  const packageJson = readProjectJson('package.json');

  assert.equal(packageJson.scripts.test, 'node --test tests');
  assert.match(packageJson.scripts['test:all'], /npm run test/);
  assert.match(packageJson.scripts['test:all'], /npm run typecheck/);
});
