import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..');
const appConfigPath = path.join(projectRoot, 'app.config.js');

const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function inspectEasProjectConfig(source) {
  return {
    owner: source.match(/\bowner:\s*'([^']+)'/)?.[1] ?? null,
    projectId: source.match(/\bprojectId:\s*'([^']+)'/)?.[1] ?? null,
  };
}

export function configureEasProjectSource(source, { owner, projectId, force = false }) {
  if (!OWNER_PATTERN.test(owner)) {
    throw new Error('Expo owner must be a valid account or organization name.');
  }
  if (!UUID_PATTERN.test(projectId)) {
    throw new Error('EAS project ID must be the UUID reported by `eas project:init` or `eas project:info`.');
  }

  const current = inspectEasProjectConfig(source);
  let next = source;

  if (current.owner && current.owner !== owner && !force) {
    throw new Error(
      `app.config.js is already owned by ${current.owner}. Re-run with --force only after verifying the EAS project.`,
    );
  }

  if (current.projectId && current.projectId !== projectId && !force) {
    throw new Error(
      `app.config.js is already linked to ${current.projectId}. Re-run with --force only after verifying the EAS project.`,
    );
  }

  if (current.owner) {
    next = next.replace(/\bowner:\s*'[^']+'/, `owner: '${owner}'`);
  } else {
    const slugLine = "  slug: 'all-in-one-fitness',";
    if (!next.includes(slugLine)) {
      throw new Error('Could not find the expected Expo slug in app.config.js.');
    }
    next = next.replace(slugLine, `${slugLine}\n  owner: '${owner}',`);
  }

  if (current.projectId) {
    next = next.replace(/\bprojectId:\s*'[^']+'/, `projectId: '${projectId}'`);
  } else {
    if (/\bextra:\s*\{/.test(next)) {
      throw new Error(
        'app.config.js already contains an extra block. Add extra.eas.projectId manually to avoid overwriting it.',
      );
    }

    const assetPatternLine = "  assetBundlePatterns: ['**/*'],";
    if (!next.includes(assetPatternLine)) {
      throw new Error('Could not find assetBundlePatterns in app.config.js.');
    }

    const easExtra = [
      assetPatternLine,
      '  extra: {',
      '    eas: {',
      `      projectId: '${projectId}',`,
      '    },',
      '  },',
    ].join('\n');
    next = next.replace(assetPatternLine, easExtra);
  }

  return next;
}

function parseArguments(argv) {
  const options = { force: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--force') {
      options.force = true;
      continue;
    }

    if (argument === '--owner' || argument === '--project-id') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value.`);
      }
      options[argument === '--owner' ? 'owner' : 'projectId'] = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!options.owner || !options.projectId) {
    throw new Error(
      'Usage: npm run configure:eas -- --owner EXPO_ACCOUNT --project-id EAS_PROJECT_UUID [--force]',
    );
  }

  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const source = fs.readFileSync(appConfigPath, 'utf8');
  const next = configureEasProjectSource(source, options);
  fs.writeFileSync(appConfigPath, next);

  console.log(`Linked app.config.js to Expo owner ${options.owner}.`);
  console.log(`Committed EAS project ID: ${options.projectId}`);
  console.log('Next: npm run check:eas-link');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
