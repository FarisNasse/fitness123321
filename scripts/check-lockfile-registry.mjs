import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const lockfilePath = path.join(projectRoot, 'package-lock.json');
const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
const invalidEntries = [];

for (const [packagePath, entry] of Object.entries(lockfile.packages ?? {})) {
  if (typeof entry.resolved !== 'string') {
    continue;
  }

  let resolvedUrl;
  try {
    resolvedUrl = new URL(entry.resolved);
  } catch {
    // Git, file, and other non-URL dependency specifiers are validated by npm.
    continue;
  }

  if (
    (resolvedUrl.protocol === 'https:' || resolvedUrl.protocol === 'http:') &&
    resolvedUrl.hostname !== 'registry.npmjs.org'
  ) {
    invalidEntries.push({ packagePath, resolved: entry.resolved });
  }
}

if (invalidEntries.length > 0) {
  console.error('package-lock.json contains non-portable registry URLs:');
  for (const entry of invalidEntries) {
    console.error(`- ${entry.packagePath || '<root>'}: ${entry.resolved}`);
  }
  console.error(
    'Regenerate or normalize the lockfile so public registry packages use https://registry.npmjs.org/.',
  );
  process.exit(1);
}

console.log('package-lock.json uses portable npm registry URLs.');
