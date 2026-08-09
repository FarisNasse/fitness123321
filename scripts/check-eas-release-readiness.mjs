import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { inspectEasProjectConfig } from './configure-eas-project.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const readText = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(readText(relativePath));
const errors = [];

const appConfig = readText('app.config.js');
const eas = readJson('eas.json');
const packageJson = readJson('package.json');
const pinnedNode = readText('.nvmrc').trim();
const { owner, projectId } = inspectEasProjectConfig(appConfig);

if (!owner) {
  errors.push('app.config.js is missing the final Expo `owner`.');
}
if (!projectId) {
  errors.push('app.config.js is missing `extra.eas.projectId`.');
}
if (projectId && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(projectId)) {
  errors.push('extra.eas.projectId is not a valid UUID.');
}
if (eas.build?.base?.node !== pinnedNode) {
  errors.push(`eas.json base.node must match .nvmrc (${pinnedNode}).`);
}
if (eas.build?.production?.node !== pinnedNode) {
  errors.push(`eas.json production.node must match .nvmrc (${pinnedNode}).`);
}
if (eas.build?.preview?.distribution !== 'internal') {
  errors.push('The preview profile must use internal distribution.');
}
if (eas.build?.preview?.android?.buildType !== 'apk') {
  errors.push('The Android preview profile must produce an APK.');
}
if (eas.build?.preview?.android?.credentialsSource !== 'remote') {
  errors.push('The Android preview profile must use remote EAS credentials.');
}
if (eas.build?.preview?.ios?.credentialsSource !== 'remote') {
  errors.push('The iOS preview profile must use remote EAS credentials.');
}
if (!appConfig.includes("bundleIdentifier: 'com.farisnasse.allinonefitness'")) {
  errors.push('The final iOS bundle identifier changed unexpectedly.');
}
if (!appConfig.includes("package: 'com.farisnasse.allinonefitness'")) {
  errors.push('The final Android package changed unexpectedly.');
}
if (!fs.existsSync(path.join(projectRoot, 'docs/release-evidence-template.md'))) {
  errors.push('docs/release-evidence-template.md is missing.');
}
if (!packageJson.scripts?.['record:preview']) {
  errors.push('package.json is missing the record:preview command.');
}

if (errors.length > 0) {
  console.error('EAS release readiness is incomplete:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error(
    '\nAuthenticate with the final Expo account, run `eas project:init`, then use `npm run configure:eas` with the real owner and UUID.',
  );
  process.exit(1);
}

console.log(`EAS project link is committed for ${owner}/${projectId}.`);
console.log(`Preview builds use Node ${pinnedNode}, remote credentials, and an Android APK.`);
