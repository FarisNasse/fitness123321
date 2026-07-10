import assert from 'node:assert/strict';
import test from 'node:test';

import { fileExists, readProjectFile, readProjectJson } from './helpers/project.mjs';

test('auth screens expose sign-up, sign-in, sign-out, and password recovery', () => {
  const login = readProjectFile('app/(auth)/login.tsx');
  const register = readProjectFile('app/(auth)/register.tsx');
  const forgot = readProjectFile('app/(auth)/forgot-password.tsx');
  const reset = readProjectFile('app/reset-password.tsx');
  const dashboard = readProjectFile('app/(tabs)/dashboard.tsx');

  assert.match(login, /signInWithPassword/);
  assert.match(login, /href="\/forgot-password"/);
  assert.match(register, /supabase\.auth\.signUp/);
  assert.match(register, /if \(!data\.session\)/);
  assert.match(forgot, /requestPasswordRecovery/);
  assert.match(forgot, /If an account exists/);
  assert.match(reset, /Linking\.useLinkingURL\(\)/);
  assert.match(reset, /createRecoverySessionFromUrl/);
  assert.match(reset, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.match(reset, /Request a new link/);
  assert.match(reset, /invalid or has expired/);
  assert.match(dashboard, /supabase\.auth\.signOut\(\)/);
  assert.match(dashboard, /title="Sign out"/);
});

test('recovery helper handles implicit and PKCE links and supplies an allow-listed redirect', () => {
  const recovery = readProjectFile('src/features/auth/password-recovery.ts');
  const flags = readProjectFile('src/lib/runtime-flags.ts');

  assert.match(recovery, /resetPasswordForEmail\(email/);
  assert.match(recovery, /redirectTo: getPasswordRecoveryRedirectUrl\(\)/);
  assert.match(recovery, /exchangeCodeForSession/);
  assert.match(recovery, /access_token/);
  assert.match(recovery, /refresh_token/);
  assert.match(recovery, /supabase\.auth\.setSession/);
  assert.match(recovery, /error_description/);
  assert.match(recovery, /Linking\.createURL\('reset-password'\)/);
  assert.match(flags, /EXPO_PUBLIC_AUTH_REDIRECT_URL/);
});

test('new auth users receive an RLS-owned profile even with email confirmation enabled', () => {
  const migration = readProjectFile(
    'supabase/migrations/0005_create_profile_for_new_auth_users.sql'
  );

  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /insert into public\.profiles/);
  assert.match(migration, /new\.raw_user_meta_data/);
  assert.match(migration, /after insert on auth\.users/);
});

test('pending local sync is restricted to the restored authenticated user', () => {
  const layout = readProjectFile('app/_layout.tsx');

  assert.match(layout, /supabase\.auth\.getSession\(\)/);
  assert.match(layout, /supabase\.auth\.onAuthStateChange/);
  assert.match(layout, /if \(!session\?\.user\) return/);
  assert.match(layout, /syncPendingRecords\(\)/);

  for (const file of [
    'src/features/workouts/workout-service.ts',
    'src/features/nutrition/nutrition-service.ts',
    'src/features/wellness/wellness-service.ts',
    'src/features/progress/body-measurements-service.ts',
  ]) {
    const service = readProjectFile(file);
    assert.match(service, /supabase\.auth\.getUser\(\)/, `${file} must resolve the current user`);
    assert.match(service, /user_id = \?/, `${file} must scope pending rows to that user`);
  }
});

test('live-project verifier covers auth lifecycle, owner sync, cross-user RLS, and recovery', () => {
  const script = readProjectFile('scripts/verify-supabase-auth.mjs');
  const packageJson = readProjectJson('package.json');

  assert.equal(packageJson.scripts['check:supabase'], 'node scripts/verify-supabase-auth.mjs');
  assert.match(script, /\.auth\.signUp/);
  assert.match(script, /\.auth\.signInWithPassword/);
  assert.match(script, /restore user A session/);
  assert.match(script, /\.auth\.signOut/);
  assert.match(script, /cross-user insert is rejected/);
  assert.match(script, /other user is filtered/);
  assert.match(script, /generateLink/);
  assert.match(script, /type: 'recovery'/);

  for (const table of [
    'workout_sessions',
    'workout_sets',
    'meal_logs',
    'meal_items',
    'water_logs',
    'mood_logs',
    'sleep_logs',
    'body_measurements',
  ]) {
    assert.ok(script.includes(`'${table}'`), `live verifier is missing ${table}`);
  }
});

test('production-like EAS profiles enable Supabase without committing credentials', () => {
  const eas = readProjectJson('eas.json');
  const authPreview = eas.build['auth-preview'];
  const production = eas.build.production;

  assert.equal(authPreview.extends, 'preview');
  assert.equal(authPreview.environment, 'preview');
  assert.equal(authPreview.env.EXPO_PUBLIC_AUTH_MODE, 'supabase');
  assert.equal(production.environment, 'production');
  assert.equal(production.env.EXPO_PUBLIC_AUTH_MODE, 'supabase');
  assert.equal(authPreview.env.EXPO_PUBLIC_AUTH_REDIRECT_URL, 'fitnessapp://reset-password');
  assert.equal(production.env.EXPO_PUBLIC_AUTH_REDIRECT_URL, 'fitnessapp://reset-password');

  const serialized = JSON.stringify(eas);
  assert.doesNotMatch(serialized, /SUPABASE_(ANON|SERVICE_ROLE)_KEY/);
  assert.doesNotMatch(serialized, /https:\/\/[^"']+\.supabase\.co/);
});

test('dashboard settings and clean-project validation steps are documented', () => {
  assert.equal(fileExists('docs/supabase-production-validation.md'), true);
  const docs = readProjectFile('docs/supabase-production-validation.md');
  const readme = readProjectFile('README.md');

  for (const text of [
    'fitnessapp://reset-password',
    'npx supabase@latest link',
    'npx supabase@latest db push',
    'npx supabase@latest migration list',
    'npm run check:supabase',
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'auth-preview',
  ]) {
    assert.ok(docs.includes(text), `validation docs are missing ${text}`);
  }

  assert.match(docs, /expired/i);
  assert.match(docs, /physical device|emulator/i);
  assert.match(docs, /another user|user B/i);
  assert.match(readme, /Supabase production validation/);
});
