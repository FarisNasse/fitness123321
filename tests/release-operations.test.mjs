import assert from 'node:assert/strict';
import test from 'node:test';

import { fileExists, readProjectFile, readProjectJson } from './helpers/project.mjs';

test('fresh Supabase behavioral integration is wired into CI', () => {
  const workflow = readProjectFile('.github/workflows/supabase-integration.yml');
  const integration = readProjectFile('tests/integration/supabase-sync.integration.test.mjs');

  assert.match(workflow, /supabase\/setup-cli@v2/);
  assert.match(workflow, /supabase db reset --local --no-seed/);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(workflow, /tests\/integration\/supabase-sync\.integration\.test\.mjs/);
  assert.match(integration, /RLS must hide all A-owned parent and child domain rows from B/);
  assert.match(integration, /Duplicate replay is idempotent/);
  assert.match(integration, /tombstoning frees the date/);
  assert.match(integration, /Deleting auth\.users cascades owned data/);
});

test('Android device E2E flow covers persistence, offline replay, all core domains, and cloud restoration', () => {
  const workflow = readProjectFile('.github/workflows/e2e-android.yml');
  const flow = readProjectFile('.maestro/critical-smoke.yaml');
  const runbook = readProjectFile('docs/e2e-runbook.md');

  assert.match(workflow, /mobile-dev-inc\/action-maestro-cloud@v3\.0\.1/);
  assert.match(workflow, /MAESTRO_CLOUD_API_KEY/);
  assert.match(flow, /clearState: true/);
  assert.match(flow, /setAirplaneMode: enabled/);
  assert.match(flow, /setAirplaneMode: disabled/);
  for (const phrase of ['Start workout', '250 ml logged today', "today's check-in", 'Log measurement', 'Sign out']) {
    assert.match(flow, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(runbook, /iOS manual smoke/);
  assert.match(runbook, /sign out\/in/i);
});

test('release gate requires automated checks and complete manual evidence', () => {
  const workflow = readProjectFile('.github/workflows/release-gate.yml');
  const checker = readProjectFile('scripts/verify-release-candidate.mjs');
  const pkg = readProjectJson('package.json');

  assert.match(workflow, /npm ci --no-audit --no-fund/);
  assert.match(workflow, /npm run test:all/);
  assert.match(workflow, /npm run check:expo/);
  assert.match(workflow, /npm run bundle:android/);
  assert.match(workflow, /npm run bundle:ios/);
  assert.match(workflow, /release-blocker/);
  assert.match(checker, /talkBack/);
  assert.match(checker, /voiceOver/);
  assert.match(checker, /accountLifecycle/);
  assert.match(checker, /releaseBlockingIssues/);
  assert.equal(pkg.scripts['check:release-evidence'], 'node scripts/verify-release-candidate.mjs');
});

test('release documentation includes accessibility, legal/support, brand, and rollback gates', () => {
  for (const path of [
    'docs/accessibility-checklist.md',
    'docs/e2e-runbook.md',
    'docs/privacy-policy.md',
    'docs/terms-of-use.md',
    'docs/support.md',
    'docs/brand-release-readiness.md',
    'docs/release-checklist.md',
    'docs/release-candidate.example.json',
  ]) {
    assert.ok(fileExists(path), `${path} should exist`);
  }

  const checklist = readProjectFile('docs/release-checklist.md');
  assert.match(checklist, /VoiceOver and TalkBack/);
  assert.match(checklist, /Data export and account deletion/);
  assert.match(checklist, /Release notes and rollback plan/);
});
