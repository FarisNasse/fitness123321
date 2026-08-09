import assert from 'node:assert/strict';
import test from 'node:test';

import { fileExists, readProjectFile, readProjectJson } from './helpers/project.mjs';

test('root render failures show a branded recovery surface with an app restart path', () => {
  assert.equal(fileExists('src/components/AppErrorBoundary.tsx'), true);

  const boundary = readProjectFile('src/components/AppErrorBoundary.tsx');
  const layout = readProjectFile('app/_layout.tsx');

  assert.match(boundary, /componentDidCatch/);
  assert.match(boundary, /reportError\(error/);
  assert.match(boundary, /reloadAppAsync\('root-error-boundary-recovery'\)/);
  assert.match(boundary, /All-in-one fitness/);
  assert.match(boundary, /Restart app/);
  assert.match(boundary, /saved on-device records are[\s\S]*still available/i);
  assert.match(layout, /<AppErrorBoundary>/);
  assert.match(layout, /export default Sentry\.wrap\(RootLayout\)/);
});

test('production diagnostics include environment and release metadata with source maps configured', () => {
  const reporter = readProjectFile('src/lib/error-reporting.ts');
  const metadata = readProjectFile('src/lib/runtime-metadata.ts');
  const metro = readProjectFile('metro.config.js');
  const appConfig = readProjectFile('app.config.js');
  const packageJson = readProjectJson('package.json');

  assert.equal(packageJson.dependencies['@sentry/react-native'], '~7.11.0');
  assert.match(reporter, /Sentry\.init\(/);
  assert.match(reporter, /environment: APP_ENVIRONMENT/);
  assert.match(reporter, /release: APP_RELEASE/);
  assert.match(reporter, /dist: APP_DISTRIBUTION/);
  assert.match(reporter, /Sentry\.captureException/);
  assert.match(reporter, /console\.error\('\[runtime-error\]'/);
  assert.match(metadata, /EXPO_PUBLIC_APP_ENV/);
  assert.match(metadata, /EXPO_PUBLIC_APP_RELEASE/);
  assert.match(metadata, /EXPO_PUBLIC_APP_DIST/);
  assert.match(metro, /getSentryExpoConfig\(__dirname\)/);
  assert.match(metro, /withNativeWind\(config/);
  assert.match(appConfig, /'@sentry\/react-native\/expo'/);
});

test('provider errors retain diagnostics but user screens do not expose raw provider messages', () => {
  const reporter = readProjectFile('src/lib/error-reporting.ts');

  assert.match(reporter, /reportProviderError/);
  assert.match(reporter, /reportError\(error, context\)/);
  assert.match(reporter, /getUserSafeProviderMessage/);

  for (const file of [
    'app/(auth)/login.tsx',
    'app/(auth)/register.tsx',
    'app/(auth)/forgot-password.tsx',
    'app/(onboarding)/index.tsx',
    'app/reset-password.tsx',
  ]) {
    const source = readProjectFile(file);
    assert.match(source, /reportProviderError/);
    assert.doesNotMatch(source, /Alert\.alert\([^\n]+error\.message/);
  }
});

test('shared network and domain sync state keep offline local logging available', () => {
  const network = readProjectFile('src/lib/network-state.tsx');
  const sync = readProjectFile('src/lib/sync-state.tsx');
  const banner = readProjectFile('src/components/RuntimeStatusBanner.tsx');
  const packageJson = readProjectJson('package.json');

  assert.equal(packageJson.dependencies['@react-native-community/netinfo'], '12.0.1');
  assert.match(network, /NetInfo\.addEventListener/);
  assert.match(network, /'unknown' \| 'online' \| 'offline'/);

  for (const domain of ['workouts', 'nutrition', 'wellness', 'progress']) {
    assert.ok(sync.includes(`${domain}:`), `sync state is missing ${domain}`);
  }

  assert.match(sync, /subscribeToSyncPending/);
  assert.match(sync, /networkStatusRef\.current !== 'online'/);
  assert.match(sync, /AppState\.addEventListener/);
  assert.match(banner, /You’re offline/);
  assert.match(banner, /Logging stays available/);
  assert.match(banner, /Saved changes will sync/);

  for (const file of [
    'src/features/workouts/workout-service.ts',
    'src/features/nutrition/nutrition-service.ts',
    'src/features/wellness/wellness-service.ts',
    'src/features/progress/body-measurements-service.ts',
  ]) {
    assert.match(readProjectFile(file), /markSyncPending/);
  }
});


test('provider-backed data services preserve raw failures only in structured diagnostics', () => {
  const expectations = [
    ['src/features/workouts/exercise-service.ts', /reportError\(error/, /fallback: 'local-seed-data'/],
    ['src/features/nutrition/nutrition-service.ts', /operation: 'search-foods'/, /Food search is temporarily unavailable\./],
    ['src/features/wellness/wellness-service.ts', /operation: 'sync-mood-check-in'/, /markWellnessCheckInFailed/],
    ['src/features/progress/body-measurements-service.ts', /operation: "refresh-measurements"/, /Measurements could not be refreshed right now\./],
    ['src/features/workouts/workout-service.ts', /operation: 'sync-workout-session'/, /markWorkoutSessionFailed/],
  ];

  for (const [file, diagnosticPattern, safeBehaviorPattern] of expectations) {
    const source = readProjectFile(file);
    assert.match(source, diagnosticPattern);
    assert.match(source, safeBehaviorPattern);
  }
});

test('runtime protection setup and manual verification are documented', () => {
  assert.equal(fileExists('docs/runtime-protection.md'), true);
  const docs = readProjectFile('docs/runtime-protection.md');
  const env = readProjectFile('.env.example');
  const readme = readProjectFile('README.md');

  for (const value of [
    'EXPO_PUBLIC_SENTRY_DSN',
    'EXPO_PUBLIC_APP_ENV',
    'EXPO_PUBLIC_APP_RELEASE',
    'EXPO_PUBLIC_APP_DIST',
    'SENTRY_AUTH_TOKEN',
  ]) {
    assert.ok(docs.includes(value), `runtime docs are missing ${value}`);
    assert.ok(env.includes(value), `.env.example is missing ${value}`);
  }

  assert.match(docs, /deliberate render error/i);
  assert.match(docs, /must not prevent[\s\S]*on-device database/i);
  assert.match(readme, /Runtime protection and diagnostics/);
});
