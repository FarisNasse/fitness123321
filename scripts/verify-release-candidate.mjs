import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function fail(message) {
  console.error(`Release gate failed: ${message}`);
  process.exitCode = 1;
}

const evidencePath = process.argv[2] ?? process.env.RELEASE_EVIDENCE;
if (!evidencePath) {
  fail('provide a release evidence JSON path as the first argument or RELEASE_EVIDENCE');
  process.exit();
}

let evidence;
try {
  evidence = JSON.parse(readFileSync(resolve(evidencePath), 'utf8'));
} catch (error) {
  fail(`could not read ${evidencePath}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit();
}

const expectedCommit = process.env.GITHUB_SHA?.trim();
const pass = (value) => value === 'pass';
const nonPlaceholder = (value) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  !/REPLACE|TODO|TBD/i.test(value);

if (!pass(evidence.status)) fail('overall status must be pass');
if (!nonPlaceholder(evidence.commitSha) || !/^[0-9a-f]{40}$/i.test(evidence.commitSha)) {
  fail('commitSha must be a full 40-character commit SHA');
} else if (expectedCommit && evidence.commitSha.toLowerCase() !== expectedCommit.toLowerCase()) {
  fail(`evidence commit ${evidence.commitSha} does not match workflow commit ${expectedCommit}`);
}

for (const key of ['tests', 'expo', 'supabaseIntegration', 'androidE2E']) {
  if (!pass(evidence.automated?.[key])) fail(`automated.${key} must be pass`);
}
if (!nonPlaceholder(evidence.automated?.androidE2eUrl)) fail('android E2E evidence URL is required');

for (const platform of ['android', 'ios']) {
  if (!pass(evidence.devices?.[platform]?.result)) fail(`${platform} preview result must be pass`);
  if (!nonPlaceholder(evidence.devices?.[platform]?.device)) fail(`${platform} device is required`);
  if (!nonPlaceholder(evidence.devices?.[platform]?.os)) fail(`${platform} OS is required`);
}

for (const key of ['talkBack', 'voiceOver', 'keyboardWeb']) {
  if (!pass(evidence.accessibility?.[key])) fail(`accessibility.${key} must be pass`);
}
for (const key of ['export', 'deletion']) {
  if (!pass(evidence.accountLifecycle?.[key])) fail(`accountLifecycle.${key} must be pass`);
}

if (evidence.releaseBlockingIssues !== 0) fail('releaseBlockingIssues must be 0');
for (const key of ['privacyPolicy', 'terms', 'support', 'brandAvailabilityReview']) {
  if (!nonPlaceholder(evidence.legal?.[key])) fail(`legal.${key} is required`);
}
if (!nonPlaceholder(evidence.releaseNotes)) fail('releaseNotes are required');
if (!nonPlaceholder(evidence.rollbackPlan)) fail('rollbackPlan is required');

if (!process.exitCode) {
  console.log(`Release evidence passed: ${evidencePath}`);
}
