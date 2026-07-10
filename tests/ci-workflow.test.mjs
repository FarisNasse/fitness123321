import assert from 'node:assert/strict';
import test from 'node:test';

import { readProjectFile } from './helpers/project.mjs';

test('CI installs the committed dependency graph and runs the complete quality suite', () => {
  const workflow = readProjectFile('.github/workflows/tests.yml');

  assert.match(workflow, /node-version-file: \.nvmrc/);
  assert.match(workflow, /npm install -g npm@10\.9\.2 --no-audit --no-fund/);
  assert.match(workflow, /run: npm ci --no-audit --no-fund/);
  assert.match(workflow, /run: npm run test:all/);
  assert.doesNotMatch(workflow, /npm install --no-audit --no-fund/);
});
