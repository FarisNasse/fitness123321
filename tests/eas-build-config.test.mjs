import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  configureEasProjectSource,
  inspectEasProjectConfig,
} from '../scripts/configure-eas-project.mjs';
import {
  buildDetailsUrl,
  normalizeBuildJson,
  renderReleaseEvidence,
} from '../scripts/create-release-evidence.mjs';
import { fileExists, readProjectFile, readProjectJson } from './helpers/project.mjs';

const APP_IDENTIFIER = 'com.farisnasse.allinonefitness';
const EXAMPLE_PROJECT_ID = '0d4f5c4d-e646-4e7f-a798-d832f1d31ee2';

function readPngMetadata(relativePath) {
  const png = readFileSync(new URL(`../${relativePath}`, import.meta.url));

  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG', `${relativePath} must be a PNG`);

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    colorType: png.readUInt8(25),
  };
}

test('Expo config uses final application identifiers and references every brand asset', () => {
  const appConfig = readProjectFile('app.config.ts');

  assert.doesNotMatch(appConfig, /com\.example/);
  assert.match(appConfig, new RegExp(`bundleIdentifier: '${APP_IDENTIFIER}'`));
  assert.match(appConfig, new RegExp(`package: '${APP_IDENTIFIER}'`));

  for (const asset of [
    'assets/icon.png',
    'assets/adaptive-icon.png',
    'assets/adaptive-icon-monochrome.png',
    'assets/splash-icon.png',
    'assets/favicon.png',
  ]) {
    assert.equal(fileExists(asset), true, `missing ${asset}`);
    assert.ok(appConfig.includes(`./${asset}`), `${asset} is not referenced by app.config.ts`);
  }

  assert.match(appConfig, /'expo-splash-screen'/);
  assert.match(appConfig, /backgroundColor: '#0d1117'/);
});

test('brand PNGs have valid platform dimensions and transparency', () => {
  const icon = readPngMetadata('assets/icon.png');
  const adaptive = readPngMetadata('assets/adaptive-icon.png');
  const monochrome = readPngMetadata('assets/adaptive-icon-monochrome.png');
  const splash = readPngMetadata('assets/splash-icon.png');
  const favicon = readPngMetadata('assets/favicon.png');

  assert.deepEqual(icon, { width: 1024, height: 1024, colorType: 2 });
  assert.deepEqual(adaptive, { width: 1024, height: 1024, colorType: 6 });
  assert.deepEqual(monochrome, { width: 1024, height: 1024, colorType: 4 });
  assert.deepEqual(splash, { width: 1024, height: 1024, colorType: 6 });
  assert.deepEqual(favicon, { width: 64, height: 64, colorType: 2 });
});

test('EAS profiles match the pinned runtime and produce a remotely signed Android APK', () => {
  const eas = readProjectJson('eas.json');
  const preview = eas.build.preview;
  const inheritedEnv = eas.build.base.env;
  const pinnedNode = readProjectFile('.nvmrc').trim();

  assert.equal(eas.build.base.node, pinnedNode);
  assert.equal(eas.build.production.node, pinnedNode);
  assert.equal(eas.build.development.developmentClient, true);
  assert.equal(eas.build.development.distribution, 'internal');
  assert.equal(preview.extends, 'base');
  assert.equal(preview.distribution, 'internal');
  assert.equal(preview.android.buildType, 'apk');
  assert.equal(preview.android.credentialsSource, 'remote');
  assert.equal(preview.ios.credentialsSource, 'remote');
  assert.equal(preview.env.EXPO_PUBLIC_APP_ENV, 'preview');
  assert.equal(eas.build.production.autoIncrement, true);

  for (const variable of [
    'EXPO_PUBLIC_AUTH_MODE',
    'EXPO_PUBLIC_WORKOUT_SYNC_SOURCE',
    'EXPO_PUBLIC_NUTRITION_SYNC_SOURCE',
    'EXPO_PUBLIC_WELLNESS_SYNC_SOURCE',
    'EXPO_PUBLIC_BODY_MEASUREMENT_SYNC_SOURCE',
    'EXPO_PUBLIC_EXERCISE_SOURCE',
    'EXPO_PUBLIC_FOOD_SOURCE',
  ]) {
    assert.equal(inheritedEnv[variable], 'local', `${variable} must be available to preview builds`);
  }
});

test('project-link helper commits a verified owner and EAS UUID without placeholders', () => {
  const source = readProjectFile('app.config.ts');
  const configured = configureEasProjectSource(source, {
    owner: 'verified-expo-owner',
    projectId: EXAMPLE_PROJECT_ID,
  });

  assert.deepEqual(inspectEasProjectConfig(configured), {
    owner: 'verified-expo-owner',
    projectId: EXAMPLE_PROJECT_ID,
  });
  assert.match(configured, /extra:\s*\{\s*eas:\s*\{/s);
  assert.throws(
    () => configureEasProjectSource(source, { owner: 'owner', projectId: 'placeholder' }),
    /UUID/,
  );
});

test('release evidence normalizes EAS JSON and records every acceptance field', () => {
  const build = normalizeBuildJson({
    id: '12345678-1234-1234-1234-123456789abc',
    buildDetailsPageUrl: 'https://expo.dev/accounts/example/projects/app/builds/12345678',
    artifacts: { buildUrl: 'https://example.test/preview.apk' },
    gitCommitHash: '0123456789abcdef0123456789abcdef01234567',
    platform: 'ANDROID',
    buildProfile: 'preview',
    status: 'FINISHED',
    appVersion: '0.1.0',
    appBuildVersion: '1',
  });

  const evidence = renderReleaseEvidence({
    build,
    owner: 'verified-expo-owner',
    projectId: EXAMPLE_PROJECT_ID,
    identifier: APP_IDENTIFIER,
    device: 'Pixel emulator',
    os: 'Android 16',
    tester: 'Release tester',
    result: 'pass',
    testedAt: '2026-07-12',
  });

  for (const expected of [
    build.id,
    build.url,
    build.artifactUrl,
    build.commitSha,
    'Pixel emulator',
    'Android 16',
    'Release tester',
    '**PASS**',
    'App icon is correct',
    'Bundled fonts render correctly',
    'Representative modals/sheets',
    'SQLite-backed record',
  ]) {
    assert.ok(evidence.includes(expected), `evidence is missing ${expected}`);
  }
  assert.match(evidence, /- \[x\] The record survives force-close and relaunch\./);

  const wrappedBuild = normalizeBuildJson({
    builds: [
      {
        id: 'wrapped-build-id',
        project: { slug: 'all-in-one-fitness', ownerAccount: { name: 'verified-owner' } },
        gitCommitHash: build.commitSha,
        platform: 'IOS',
        buildProfile: 'preview',
        status: 'FINISHED',
      },
    ],
  });
  assert.equal(
    wrappedBuild.url,
    'https://expo.dev/accounts/verified-owner/projects/all-in-one-fitness/builds/wrapped-build-id',
  );
  assert.equal(
    buildDetailsUrl({
      id: 'fallback-id',
      owner: 'verified-owner',
      slug: 'all-in-one-fitness',
    }),
    'https://expo.dev/accounts/verified-owner/projects/all-in-one-fitness/builds/fallback-id',
  );
});

test('release evidence template and storage guidance are committed', () => {
  const template = readProjectFile('docs/release-evidence-template.md');
  const releaseReadme = readProjectFile('docs/releases/README.md');

  for (const field of [
    'EAS build ID',
    'Build details URL',
    'Commit SHA',
    'Device or emulator',
    'OS and version',
    'Tester',
    'Result',
  ]) {
    assert.ok(template.includes(field), `release template is missing ${field}`);
  }
  assert.match(releaseReadme, /npm run record:preview/);
});

test('README documents the linked, signed, reproducible EAS preview workflow', () => {
  const readme = readProjectFile('README.md');

  for (const command of [
    'npx eas-cli@latest login',
    'npx eas-cli@latest project:init',
    'npx eas-cli@latest build:configure',
    'npm run configure:eas',
    'npm run check:eas-link',
    'npx eas-cli@latest credentials:configure-build --platform android --profile preview',
    'npm run check:preview',
    'npx eas-cli@latest build --platform android --profile preview --wait --json',
    'npx eas-cli@latest build:run --platform android --latest',
    'adb install -r ./all-in-one-fitness-preview.apk',
    'npm run record:preview',
  ]) {
    assert.ok(readme.includes(command), `README is missing: ${command}`);
  }

  assert.match(readme, /EXPO_PUBLIC_SUPABASE_URL/);
  assert.match(readme, /EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(readme, /physical device or emulator/i);
  assert.match(readme, /com\.farisnasse\.allinonefitness/);
});
