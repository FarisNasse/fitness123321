import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { fileExists, readProjectFile, readProjectJson } from './helpers/project.mjs';

const APP_IDENTIFIER = 'com.farisnasse.allinonefitness';

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

test('EAS profiles produce a self-contained installable Android preview', () => {
  const eas = readProjectJson('eas.json');
  const preview = eas.build.preview;
  const inheritedEnv = eas.build.base.env;

  assert.equal(eas.build.development.developmentClient, true);
  assert.equal(eas.build.development.distribution, 'internal');
  assert.equal(preview.extends, 'base');
  assert.equal(preview.distribution, 'internal');
  assert.equal(preview.android.buildType, 'apk');
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

test('README documents the reproducible EAS preview workflow', () => {
  const readme = readProjectFile('README.md');

  for (const command of [
    'npx eas-cli@latest login',
    'npx eas-cli@latest build:configure',
    'npm run check:preview',
    'npx eas-cli@latest build --platform android --profile preview',
    'npx eas-cli@latest build:run --platform android --latest',
    'adb install -r ./all-in-one-fitness-preview.apk',
  ]) {
    assert.ok(readme.includes(command), `README is missing: ${command}`);
  }

  assert.match(readme, /EXPO_PUBLIC_SUPABASE_URL/);
  assert.match(readme, /EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(readme, /physical device or emulator/i);
});
