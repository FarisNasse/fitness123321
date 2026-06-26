import assert from 'node:assert/strict';
import test from 'node:test';

import { readProjectFile } from './helpers/project.mjs';

test('CI explains stale package locks instead of failing with npm ci internals', () => {
  const workflow = readProjectFile('.github/workflows/tests.yml');

  assert.match(workflow, /npm install --no-audit --no-fund/);
  assert.match(workflow, /git diff --exit-code -- package\.json package-lock\.json/);
  assert.match(
    workflow,
    /package\.json and package-lock\.json are out of sync\. Run npm install locally and commit both files together\./
  );
  assert.doesNotMatch(workflow, /run:\s*npm ci(?:\s|$)/);
});
