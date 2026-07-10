import assert from 'node:assert/strict';
import test from 'node:test';

import { fileExists, readProjectFile, readProjectJson } from './helpers/project.mjs';

test('flat ESLint configuration covers TypeScript, React hooks, and React Native', () => {
  const config = readProjectFile('eslint.config.mjs');
  const pkg = readProjectJson('package.json');

  assert.match(config, /from 'typescript-eslint'/);
  assert.match(config, /from 'eslint-plugin-react-hooks'/);
  assert.match(config, /from '@react-native\/eslint-plugin'/);
  assert.match(config, /reactHooks\.configs\.flat\.recommended\.rules/);
  assert.match(config, /'react-hooks\/set-state-in-effect': 'off'/);
  assert.match(config, /'@react-native\/no-deep-imports': 'error'/);
  assert.match(config, /'@react-native\/platform-colors': 'error'/);
  assert.equal(pkg.scripts.lint, 'eslint . --max-warnings=0');
  assert.match(pkg.scripts['test:all'], /npm run lint/);
});

test('known repository cleanup items stay removed', () => {
  const pkg = readProjectJson('package.json');
  const lock = readProjectJson('package-lock.json');
  const unusedDependencies = [
    '@gorhom/bottom-sheet',
    'expo-constants',
    'expo-linear-gradient',
    'expo-notifications',
    'expo-secure-store',
    'expo-status-bar',
    'react-hook-form',
    'react-native-gifted-charts',
    'zod',
    'zustand',
  ];

  assert.equal(fileExists('fitness123321-issue-4-workout-history.patch'), false);

  for (const dependency of unusedDependencies) {
    assert.equal(pkg.dependencies[dependency], undefined, `${dependency} should not be direct`);
  }

  assert.equal(pkg.dependencies['react-native-svg'], '15.15.5');
  assert.equal(lock.packages[''].dependencies['expo-notifications'], undefined);
  assert.equal(lock.packages['node_modules/expo-notifications'], undefined);
});

test('README documents immutable clean-checkout verification', () => {
  const readme = readProjectFile('README.md');

  assert.match(readme, /## Clean-checkout verification/);
  assert.match(readme, /npm ci\s+npm run test:all/);
  assert.match(readme, /JavaScript, TypeScript, React hooks, and React Native/);
  assert.match(readme, /expo-dev-client/);
  assert.match(readme, /react-dom.*react-native-web/);
  assert.match(readme, /react-native-screens/);
});
