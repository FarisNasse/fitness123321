import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(baseUrl && anonKey && serviceRoleKey);

async function request(path, { method = 'GET', token = serviceRoleKey, apikey = serviceRoleKey, body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { response, data };
}

async function createUser(label) {
  const email = `sync-${label}-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}-aA1!`;
  const created = await request('/auth/v1/admin/users', {
    method: 'POST',
    body: { email, password, email_confirm: true },
  });
  assert.ok([200, 201].includes(created.response.status), JSON.stringify(created.data));
  const userId = created.data.id ?? created.data.user?.id;
  assert.ok(userId);

  const login = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    token: anonKey,
    apikey: anonKey,
    body: { email, password },
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.data));
  assert.ok(login.data.access_token);
  return { id: userId, email, token: login.data.access_token };
}

async function insert(table, row, userToken, { upsert = false } = {}) {
  const suffix = upsert ? '?on_conflict=id' : '';
  const { response, data } = await request(`/rest/v1/${table}${suffix}`, {
    method: 'POST',
    token: userToken,
    apikey: anonKey,
    body: row,
    headers: {
      Prefer: `${upsert ? 'resolution=merge-duplicates,' : ''}return=representation`,
    },
  });
  assert.ok([200, 201].includes(response.status), `${table}: ${response.status} ${JSON.stringify(data)}`);
  return Array.isArray(data) ? data[0] : data;
}

async function select(table, query, userToken, apikey = anonKey) {
  const { response, data } = await request(`/rest/v1/${table}?${query}`, {
    token: userToken,
    apikey,
  });
  assert.equal(response.status, 200, `${table}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function patch(table, query, values, userToken) {
  const { response, data } = await request(`/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    token: userToken,
    apikey: anonKey,
    body: values,
    headers: { Prefer: 'return=representation' },
  });
  assert.equal(response.status, 200, `${table}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function removeUser(userId) {
  const result = await request(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
  assert.ok([200, 204].includes(result.response.status), JSON.stringify(result.data));
}

test('fresh Supabase migrations enforce ownership, uniqueness, tombstones, replay, and cascade', { skip: !configured }, async () => {
  const userA = await createUser('a');
  const userB = await createUser('b');

  try {
    const exerciseId = randomUUID();
    const exercise = await request('/rest/v1/exercises', {
      method: 'POST',
      body: {
        id: exerciseId,
        name: 'Integration press',
        muscle_group: 'Chest',
        equipment: 'Barbell',
      },
      headers: { Prefer: 'return=minimal' },
    });
    assert.ok([200, 201].includes(exercise.response.status), JSON.stringify(exercise.data));

    const sessionId = randomUUID();
    const setId = randomUUID();
    const mealId = randomUUID();
    const mealItemId = randomUUID();
    const waterId = randomUUID();
    const moodId = randomUUID();
    const sleepId = randomUUID();
    const measurementId = randomUUID();
    const targetsId = randomUUID();
    const checkInDate = '2026-08-09';
    const now = '2026-08-09T20:00:00.000Z';

    await insert('workout_sessions', {
      id: sessionId, user_id: userA.id, name: 'Integration workout', started_at: now,
    }, userA.token);
    await insert('workout_sets', {
      id: setId, session_id: sessionId, exercise_id: exerciseId, set_number: 1,
      reps: 8, weight: 135, completed: true, exercise_sort_order: 0,
    }, userA.token);
    await insert('meal_logs', {
      id: mealId, user_id: userA.id, logged_at: now, meal_type: 'lunch',
    }, userA.token);
    await insert('meal_items', {
      id: mealItemId, meal_log_id: mealId, food_name: 'Integration food', quantity: 1,
      unit: 'serving', calories: 250, protein_g: 20, carbs_g: 25, fat_g: 8,
    }, userA.token);
    await insert('water_logs', {
      id: waterId, user_id: userA.id, logged_at: now, amount_ml: 500,
    }, userA.token);
    await insert('mood_logs', {
      id: moodId, user_id: userA.id, logged_at: now, check_in_date: checkInDate,
      mood_score: 4, stress_score: 2, energy_score: 4, steps: 9000,
    }, userA.token);
    await insert('sleep_logs', {
      id: sleepId, user_id: userA.id, check_in_date: checkInDate,
      sleep_start: '2026-08-09T06:00:00.000Z', sleep_end: '2026-08-09T14:00:00.000Z',
    }, userA.token);
    await insert('body_measurements', {
      id: measurementId, user_id: userA.id, measured_at: now, weight_kg: 70,
    }, userA.token);
    await insert('daily_targets', {
      id: targetsId, user_id: userA.id, calories: 2100, protein_g: 140, water_ml: 2500, steps: 9000,
    }, userA.token);

    // Updates and tombstones are executable for every synchronized domain.
    for (const [table, id, values] of [
      ['workout_sessions', sessionId, { notes: 'edited in integration', is_deleted: true, deleted_at: '2026-08-09T20:30:00.000Z' }],
      ['workout_sets', setId, { reps: 9, is_deleted: true, deleted_at: '2026-08-09T20:31:00.000Z' }],
      ['meal_logs', mealId, { meal_type: 'dinner', is_deleted: true, deleted_at: '2026-08-09T20:32:00.000Z' }],
      ['meal_items', mealItemId, { quantity: 2, is_deleted: true, deleted_at: '2026-08-09T20:33:00.000Z' }],
      ['water_logs', waterId, { amount_ml: 750, is_deleted: true, deleted_at: '2026-08-09T20:34:00.000Z' }],
      ['sleep_logs', sleepId, { notes: 'edited in integration', is_deleted: true, deleted_at: '2026-08-09T20:35:00.000Z' }],
      ['body_measurements', measurementId, { notes: 'edited in integration', is_deleted: true, deleted_at: '2026-08-09T20:36:00.000Z' }],
    ]) {
      const changed = await patch(table, `id=eq.${id}`, values, userA.token);
      assert.equal(changed.length, 1, `${table} update should affect exactly one row`);
      assert.equal(changed[0].is_deleted, true, `${table} tombstone should persist`);
      assert.ok(changed[0].updated_at, `${table} update must advance recency`);
    }

    // Duplicate replay is idempotent for client-generated IDs.
    await insert('workout_sessions', {
      id: sessionId, user_id: userA.id, name: 'Integration workout replay', started_at: now,
    }, userA.token, { upsert: true });
    const replayed = await select('workout_sessions', `id=eq.${sessionId}&select=id,name`, userA.token);
    assert.deepEqual(replayed.map((row) => row.id), [sessionId]);
    assert.equal(replayed[0].name, 'Integration workout replay');

    // RLS must hide all A-owned parent and child domain rows from B.
    for (const [table, id] of [
      ['workout_sessions', sessionId],
      ['workout_sets', setId],
      ['meal_logs', mealId],
      ['meal_items', mealItemId],
      ['water_logs', waterId],
      ['mood_logs', moodId],
      ['sleep_logs', sleepId],
      ['body_measurements', measurementId],
      ['daily_targets', targetsId],
    ]) {
      const rows = await select(table, `id=eq.${id}&select=id`, userB.token);
      assert.deepEqual(rows, [], `${table} leaked across users`);
    }

    // Failed ownership writes are retryable in each user-owned domain.
    const retryCases = [
      ['workout_sessions', { name: 'Retry workout', started_at: now }],
      ['meal_logs', { logged_at: now, meal_type: 'snack' }],
      ['mood_logs', { logged_at: now, check_in_date: '2026-08-10', mood_score: 3, stress_score: 3, energy_score: 3, steps: 100 }],
      ['body_measurements', { measured_at: now, weight_kg: 71 }],
    ];
    for (const [table, values] of retryCases) {
      const id = randomUUID();
      const rejectedOwner = await request(`/rest/v1/${table}`, {
        method: 'POST', token: userB.token, apikey: anonKey,
        body: { id, user_id: userA.id, ...values },
        headers: { Prefer: 'return=representation' },
      });
      assert.ok(rejectedOwner.response.status >= 400, `${table} must reject cross-user ownership`);
      await insert(table, { id, user_id: userB.id, ...values }, userB.token);
    }

    // A failed nutrition ownership write can be retried without leaving a row behind.
    const retryId = randomUUID();
    const rejected = await request('/rest/v1/water_logs', {
      method: 'POST', token: userB.token, apikey: anonKey,
      body: { id: retryId, user_id: userA.id, logged_at: now, amount_ml: 250 },
      headers: { Prefer: 'return=representation' },
    });
    assert.ok(rejected.response.status >= 400);
    await insert('water_logs', {
      id: retryId, user_id: userB.id, logged_at: now, amount_ml: 250,
    }, userB.token);

    // One active wellness row per user/date; tombstoning frees the date for a newer row.
    const duplicateMood = await request('/rest/v1/mood_logs', {
      method: 'POST', token: userA.token, apikey: anonKey,
      body: {
        id: randomUUID(), user_id: userA.id, logged_at: now, check_in_date: checkInDate,
        mood_score: 3, stress_score: 3, energy_score: 3, steps: 1,
      },
      headers: { Prefer: 'return=representation' },
    });
    assert.equal(duplicateMood.response.status, 409);

    const before = (await select('mood_logs', `id=eq.${moodId}&select=updated_at`, userA.token))[0].updated_at;
    await patch('mood_logs', `id=eq.${moodId}`, {
      is_deleted: true, deleted_at: '2026-08-09T21:00:00.000Z',
    }, userA.token);
    const replacementMoodId = randomUUID();
    await insert('mood_logs', {
      id: replacementMoodId, user_id: userA.id, logged_at: '2026-08-09T22:00:00.000Z',
      check_in_date: checkInDate, mood_score: 5, stress_score: 1, energy_score: 5, steps: 10000,
    }, userA.token);
    const tombstoned = await select('mood_logs', `id=eq.${moodId}&select=is_deleted,deleted_at,updated_at`, userA.token);
    assert.equal(tombstoned[0].is_deleted, true);
    assert.ok(Date.parse(tombstoned[0].updated_at) >= Date.parse(before));

    // Daily targets are one row per user.
    const duplicateTargets = await request('/rest/v1/daily_targets', {
      method: 'POST', token: userA.token, apikey: anonKey,
      body: { id: randomUUID(), user_id: userA.id, calories: 1900 },
      headers: { Prefer: 'return=representation' },
    });
    assert.equal(duplicateTargets.response.status, 409);

    // Deleting auth.users cascades owned data so account deletion has a complete lifecycle.
    await removeUser(userA.id);
    const remainingSessions = await select('workout_sessions', `id=eq.${sessionId}&select=id`, serviceRoleKey, serviceRoleKey);
    const remainingMeals = await select('meal_logs', `id=eq.${mealId}&select=id`, serviceRoleKey, serviceRoleKey);
    const remainingMeasurements = await select('body_measurements', `id=eq.${measurementId}&select=id`, serviceRoleKey, serviceRoleKey);
    assert.deepEqual(remainingSessions, []);
    assert.deepEqual(remainingMeals, []);
    assert.deepEqual(remainingMeasurements, []);
  } finally {
    await removeUser(userA.id).catch(() => undefined);
    await removeUser(userB.id).catch(() => undefined);
  }
});
