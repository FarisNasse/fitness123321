import assert from 'node:assert/strict';
import test from 'node:test';

import { fileExists, readProjectFile, readProjectJson } from './helpers/project.mjs';

// Keep this direct-dependency policy in lockstep with Expo Doctor's SDK 56 recommendations.
const expectedSdkDependencies = {
  '@react-native-async-storage/async-storage': '2.2.0',
  'expo-constants': '~56.0.23',
  'expo-font': '~56.0.6',
  react: '19.2.3',
  'react-dom': '19.2.3',
  'react-native': '0.85.3',
  'react-native-gesture-handler': '~2.31.1',
  'react-native-reanimated': '4.3.1',
  'react-native-safe-area-context': '~5.7.0',
  'react-native-svg': '15.15.4',
  'react-native-worklets': '0.8.3',
};

test('app.config.ts is the single Expo app configuration source', () => {
  const pkg = readProjectJson('package.json');
  const appConfig = readProjectFile('app.config.ts');

  assert.equal(fileExists('app.json'), false);
  assert.equal(pkg.main, 'expo-router/entry');
  assert.match(appConfig, /name: 'All-In-One Fitness'/);
  assert.match(appConfig, /scheme: 'fitnessapp'/);
  assert.match(appConfig, /bundleIdentifier: 'com\.farisnasse\.allinonefitness'/);
  assert.match(appConfig, /package: 'com\.farisnasse\.allinonefitness'/);
  assert.match(appConfig, /bundler: 'metro'/);
});

test('direct native dependencies match the Expo SDK 56 compatibility map', () => {
  const pkg = readProjectJson('package.json');
  const lock = readProjectJson('package-lock.json');

  for (const [dependency, version] of Object.entries(expectedSdkDependencies)) {
    assert.equal(pkg.dependencies[dependency], version, `${dependency} must stay aligned with SDK 56`);
    assert.equal(lock.packages[''].dependencies[dependency], version);
  }

  assert.equal(pkg.devDependencies['expo-doctor'], '1.20.0');
  assert.equal(lock.packages[''].devDependencies['expo-doctor'], '1.20.0');
});

test('Babel applies the Worklets transform exactly once through NativeWind v4', () => {
  const babel = readProjectFile('babel.config.js');

  assert.match(babel, /babel-preset-expo/);
  assert.match(babel, /jsxImportSource: 'nativewind'/);
  assert.match(babel, /reanimated: false/);
  assert.match(babel, /worklets: false/);
  assert.match(babel, /nativewind\/babel/);
  assert.doesNotMatch(babel, /react-native-reanimated\/plugin/);
  assert.doesNotMatch(babel, /(?:'|")react-native-worklets\/plugin(?:'|")/);
});

test('release checks cover Expo dependency validation and native bundle exports', () => {
  const pkg = readProjectJson('package.json');
  const readme = readProjectFile('README.md');
  const workflow = readProjectFile('.github/workflows/tests.yml');

  assert.equal(pkg.scripts['check:expo'], 'expo install --check && expo-doctor');
  assert.match(pkg.scripts['check:release'], /npm run check:expo/);
  assert.match(pkg.scripts['check:release'], /npm run bundle:android/);
  assert.match(pkg.scripts['check:release'], /npm run bundle:ios/);
  assert.match(readme, /## Expo SDK 56 release baseline/);
  assert.match(readme, /npm run check:expo/);
  assert.match(readme, /npx eas-cli@latest build --platform android --profile development/);
  assert.match(readme, /npx eas-cli@latest build --platform ios --profile development/);
  assert.match(workflow, /npm run check:expo/);
});
