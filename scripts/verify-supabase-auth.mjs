import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const emailDomain = process.env.SUPABASE_TEST_EMAIL_DOMAIN ?? 'example.com';
const recoveryRedirectUrl =
  process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ?? 'fitnessapp://reset-password';

for (const [name, value] of [
  ['SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL)', supabaseUrl],
  ['SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY)', anonKey],
  ['SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey],
]) {
  if (!value) {
    throw new Error(`Missing ${name}. See docs/supabase-production-validation.md.`);
  }
}

class MemoryStorage {
  values = new Map();

  async getItem(key) {
    return this.values.get(key) ?? null;
  }

  async setItem(key, value) {
    this.values.set(key, value);
  }

  async removeItem(key) {
    this.values.delete(key);
  }
}

function createUserClient(storage = new MemoryStorage()) {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      storage,
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function describeError(error) {
  return error ? `${error.message} (${error.code ?? 'no code'})` : 'no error';
}

async function requireSuccess(label, promise) {
  const result = await promise;
  assert.equal(result.error, null, `${label}: ${describeError(result.error)}`);
  return result.data;
}

async function requireBlockedInsert(label, promise) {
  const result = await promise;
  assert.ok(result.error, `${label}: the cross-user insert unexpectedly succeeded`);
}

function logPass(message) {
  console.log(`PASS ${message}`);
}

const suffix = `${Date.now()}-${randomBytes(4).toString('hex')}`;
const userAEmail = `fitness-auth-a+${suffix}@${emailDomain}`;
const userBEmail = `fitness-auth-b+${suffix}@${emailDomain}`;
const initialPassword = `Valid-${randomBytes(12).toString('base64url')}!`;
const recoveredPassword = `Recovered-${randomBytes(12).toString('base64url')}!`;
const createdUserIds = [];

try {
  const signupStorage = new MemoryStorage();
  const signupClient = createUserClient(signupStorage);
  const signup = await signupClient.auth.signUp({
    email: userAEmail,
    password: initialPassword,
    options: { data: { display_name: 'Supabase validation user A' } },
  });

  assert.equal(signup.error, null, `public sign-up failed: ${describeError(signup.error)}`);
  assert.ok(signup.data.user?.id, 'public sign-up did not return a user');
  const userAId = signup.data.user.id;
  createdUserIds.push(userAId);

  if (signup.data.session) {
    await requireSuccess('sign out after sign-up', signupClient.auth.signOut());
  } else {
    await requireSuccess(
      'confirm validation email through admin API',
      admin.auth.admin.updateUserById(userAId, { email_confirm: true })
    );
  }
  logPass('public sign-up works with the project email-confirmation setting');

  const createdB = await requireSuccess(
    'create second validation user',
    admin.auth.admin.createUser({
      email: userBEmail,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { display_name: 'Supabase validation user B' },
    })
  );
  assert.ok(createdB.user?.id, 'admin user creation did not return user B');
  const userBId = createdB.user.id;
  createdUserIds.push(userBId);

  const storageA = new MemoryStorage();
  const firstClientA = createUserClient(storageA);
  const signedInA = await requireSuccess(
    'sign in user A',
    firstClientA.auth.signInWithPassword({ email: userAEmail, password: initialPassword })
  );
  assert.equal(signedInA.user?.id, userAId);

  const restoredClientA = createUserClient(storageA);
  const restored = await requireSuccess('restore user A session', restoredClientA.auth.getSession());
  assert.equal(restored.session?.user.id, userAId);
  logPass('sign-in and persisted session restoration work');

  await requireSuccess('sign out restored user A', restoredClientA.auth.signOut());
  const signedOut = await requireSuccess('read signed-out session', restoredClientA.auth.getSession());
  assert.equal(signedOut.session, null);
  await requireSuccess(
    'sign user A back in',
    restoredClientA.auth.signInWithPassword({ email: userAEmail, password: initialPassword })
  );
  logPass('sign-out and subsequent sign-in work');

  const clientB = createUserClient();
  const signedInB = await requireSuccess(
    'sign in user B',
    clientB.auth.signInWithPassword({ email: userBEmail, password: initialPassword })
  );
  assert.equal(signedInB.user?.id, userBId);

  const profileA = await requireSuccess(
    'load automatically created profile A',
    restoredClientA.from('profiles').select('id, display_name, primary_goal').eq('id', userAId).single()
  );
  assert.equal(profileA.id, userAId, '0005 profile trigger is not installed');
  await requireSuccess(
    'complete onboarding for user A',
    restoredClientA
      .from('profiles')
      .update({ primary_goal: 'Build muscle', fitness_level: 'intermediate' })
      .eq('id', userAId)
      .select('id, primary_goal')
      .single()
  );
  logPass('profile creation and onboarding write work');

  const workoutSessionId = randomUUID();
  const workoutSetId = randomUUID();
  const mealLogId = randomUUID();
  const mealItemId = randomUUID();
  const waterLogId = randomUUID();
  const moodLogId = randomUUID();
  const sleepLogId = randomUUID();
  const measurementId = randomUUID();
  const startedAt = new Date(Date.now() - 45 * 60_000).toISOString();
  const completedAt = new Date().toISOString();
  const date = completedAt.slice(0, 10);
  const exerciseId = '00000000-0000-0000-0000-000000000001';

  await requireSuccess(
    'sync workout session',
    restoredClientA.from('workout_sessions').insert({
      id: workoutSessionId,
      user_id: userAId,
      name: 'RLS validation workout',
      started_at: startedAt,
      completed_at: completedAt,
      duration_seconds: 2700,
    })
  );
  await requireSuccess(
    'sync workout set',
    restoredClientA.from('workout_sets').insert({
      id: workoutSetId,
      session_id: workoutSessionId,
      exercise_id: exerciseId,
      set_number: 1,
      reps: 8,
      weight: 100,
      completed: true,
    })
  );

  await requireSuccess(
    'sync meal log',
    restoredClientA.from('meal_logs').insert({
      id: mealLogId,
      user_id: userAId,
      logged_at: completedAt,
      meal_type: 'lunch',
    })
  );
  await requireSuccess(
    'sync meal item',
    restoredClientA.from('meal_items').insert({
      id: mealItemId,
      meal_log_id: mealLogId,
      food_name: 'RLS validation meal',
      quantity: 1,
      unit: 'serving',
      calories: 500,
      protein_g: 40,
      carbs_g: 50,
      fat_g: 15,
    })
  );
  await requireSuccess(
    'sync water log',
    restoredClientA.from('water_logs').insert({
      id: waterLogId,
      user_id: userAId,
      logged_at: completedAt,
      amount_ml: 500,
    })
  );

  await requireSuccess(
    'sync mood and steps',
    restoredClientA.from('mood_logs').insert({
      id: moodLogId,
      user_id: userAId,
      check_in_date: date,
      logged_at: completedAt,
      mood_score: 4,
      stress_score: 2,
      energy_score: 4,
      steps: 9000,
    })
  );
  await requireSuccess(
    'sync sleep log',
    restoredClientA.from('sleep_logs').insert({
      id: sleepLogId,
      user_id: userAId,
      check_in_date: date,
      sleep_start: new Date(Date.now() - 9 * 60 * 60_000).toISOString(),
      sleep_end: new Date(Date.now() - 60 * 60_000).toISOString(),
      quality_rating: 4,
    })
  );

  await requireSuccess(
    'sync progress measurement',
    restoredClientA.from('body_measurements').insert({
      id: measurementId,
      user_id: userAId,
      measured_at: completedAt,
      weight_kg: 70,
      body_fat_percent: 15,
    })
  );

  for (const [label, table, id] of [
    ['workout session', 'workout_sessions', workoutSessionId],
    ['workout set', 'workout_sets', workoutSetId],
    ['meal log', 'meal_logs', mealLogId],
    ['meal item', 'meal_items', mealItemId],
    ['water log', 'water_logs', waterLogId],
    ['mood log', 'mood_logs', moodLogId],
    ['sleep log', 'sleep_logs', sleepLogId],
    ['body measurement', 'body_measurements', measurementId],
  ]) {
    const ownerRows = await requireSuccess(
      `owner reads ${label}`,
      restoredClientA.from(table).select('id').eq('id', id)
    );
    assert.equal(ownerRows.length, 1, `owner could not read ${label}`);

    const otherRows = await requireSuccess(
      `other user is filtered from ${label}`,
      clientB.from(table).select('id').eq('id', id)
    );
    assert.equal(otherRows.length, 0, `user B read user A's ${label}`);
  }

  const blockedUpdate = await requireSuccess(
    'cross-user update is filtered',
    clientB
      .from('body_measurements')
      .update({ notes: 'unauthorized update' })
      .eq('id', measurementId)
      .select('id')
  );
  assert.equal(blockedUpdate.length, 0, 'user B updated user A body measurement');
  await requireBlockedInsert(
    'cross-user insert is rejected',
    clientB.from('water_logs').insert({
      id: randomUUID(),
      user_id: userAId,
      logged_at: completedAt,
      amount_ml: 250,
    })
  );
  logPass('workout, nutrition, wellness, and progress sync obey owner RLS');

  const hiddenProfile = await requireSuccess(
    'other profile is filtered',
    clientB.from('profiles').select('id').eq('id', userAId)
  );
  assert.equal(hiddenProfile.length, 0, 'user B read user A profile');

  const generatedRecovery = await requireSuccess(
    'generate recovery link',
    admin.auth.admin.generateLink({
      type: 'recovery',
      email: userAEmail,
      options: { redirectTo: recoveryRedirectUrl },
    })
  );
  assert.equal(generatedRecovery.properties.verification_type, 'recovery');
  assert.equal(generatedRecovery.properties.redirect_to, recoveryRedirectUrl);

  const recoveryClient = createUserClient();
  await requireSuccess(
    'exchange recovery token',
    recoveryClient.auth.verifyOtp({
      token_hash: generatedRecovery.properties.hashed_token,
      type: 'recovery',
    })
  );
  await requireSuccess(
    'update recovered password',
    recoveryClient.auth.updateUser({ password: recoveredPassword })
  );
  await requireSuccess('sign out recovered session', recoveryClient.auth.signOut());
  const recoveredSignIn = await requireSuccess(
    'sign in with recovered password',
    recoveryClient.auth.signInWithPassword({ email: userAEmail, password: recoveredPassword })
  );
  assert.equal(recoveredSignIn.user?.id, userAId);
  logPass('recovery token exchange and password update work');

  console.log('\nSupabase production validation passed. Complete the device-only checklist in the validation document.');
} finally {
  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.warn(`Could not delete validation user ${userId}: ${error.message}`);
    }
  }
}
