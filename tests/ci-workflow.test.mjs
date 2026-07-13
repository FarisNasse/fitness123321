import assert from 'node:assert/strict';
import test from 'node:test';

import { fileExists, readProjectFile, readProjectJson } from './helpers/project.mjs';

test('CI rejects private registry lockfiles before installing dependencies', () => {
  const workflow = readProjectFile('.github/workflows/tests.yml');
  const pkg = readProjectJson('package.json');

  assert.match(workflow, /timeout-minutes: 20/);
  assert.match(workflow, /node-version-file: \.nvmrc/);
  assert.match(workflow, /cache: npm/);
  assert.match(workflow, /test "\$\(node --version\)" = "v\$\(cat \.nvmrc\)"/);
  assert.match(workflow, /test "\$\(npm --version\)" = "10\.9\.8"/);
  assert.match(workflow, /run: node scripts\/check-lockfile-registry\.mjs/);
  assert.match(workflow, /run: npm ci --no-audit --no-fund/);
  assert.match(workflow, /uses: actions\/upload-artifact@v4/);
  assert.match(workflow, /npm-ci-diagnostics/);
  assert.match(workflow, /run: npm run test:all/);
  assert.equal(pkg.scripts['check:lockfile'], 'node scripts/check-lockfile-registry.mjs');
  assert.match(pkg.scripts['test:all'], /^npm run check:lockfile &&/);

  assert.doesNotMatch(workflow, /--prefer-offline/);
  assert.doesNotMatch(workflow, /fetch-retries/);
  assert.doesNotMatch(workflow, /scripts\/ci-npm-install\.sh/);
  assert.equal(fileExists('scripts/ci-npm-install.sh'), false);
});

test('committed lockfile contains only portable public registry tarball URLs', () => {
  const lock = readProjectJson('package-lock.json');

  for (const [packagePath, entry] of Object.entries(lock.packages ?? {})) {
    if (typeof entry.resolved !== 'string') {
      continue;
    }

    let resolvedUrl;
    try {
      resolvedUrl = new URL(entry.resolved);
    } catch {
      continue;
    }

    if (resolvedUrl.protocol === 'https:' || resolvedUrl.protocol === 'http:') {
      assert.equal(
        resolvedUrl.hostname,
        'registry.npmjs.org',
        `${packagePath || '<root>'} must not pin a private registry`,
      );
    }
  }
});
