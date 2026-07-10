import assert from 'node:assert/strict';
import test from 'node:test';

import { readProjectFile } from './helpers/project.mjs';

test('CI installs the committed dependency graph and runs the complete quality suite', () => {
  const workflow = readProjectFile('.github/workflows/tests.yml');

  assert.match(workflow, /timeout-minutes: 30/);
  assert.match(workflow, /node-version-file: \.nvmrc/);
  assert.match(workflow, /test "\$\(node --version\)" = "v\$\(cat \.nvmrc\)"/);
  assert.match(workflow, /test "\$\(npm --version\)" = "10\.9\.8"/);
  assert.match(workflow, /run: bash scripts\/ci-npm-install\.sh/);
  assert.match(workflow, /uses: actions\/upload-artifact@v4/);
  assert.match(workflow, /npm-ci-diagnostics/);
  assert.match(workflow, /run: npm run test:all/);
  assert.doesNotMatch(workflow, /npm install -g npm/);
  assert.doesNotMatch(workflow, /npm install --no-audit --no-fund/);
});

test('CI retries only npm and registry transport failures while preserving immutable installs', () => {
  const installer = readProjectFile('scripts/ci-npm-install.sh');

  assert.match(installer, /npm ci/);
  assert.match(installer, /--prefer-offline/);
  assert.match(installer, /--fetch-retries=5/);
  assert.match(installer, /--fetch-timeout=120000/);
  assert.match(installer, /--maxsockets=5/);
  assert.match(installer, /Exit handler never called/);
  assert.match(installer, /ETIMEDOUT/);
  assert.match(installer, /append_latest_npm_debug_log/);
  assert.match(installer, /rm -rf node_modules/);
  assert.match(installer, /NPM_CI_MAX_ATTEMPTS:-3/);
  assert.doesNotMatch(installer, /^\s*npm install(?:\s|$)/m);
  assert.doesNotMatch(installer, /npm cache clean/);
});
