import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..');
const defaultOutputDirectory = path.join(projectRoot, 'docs', 'releases');

function firstDefined(...values) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? null;
}

export function buildDetailsUrl({ id, owner, slug }) {
  if (!id || !owner || !slug) {
    return null;
  }
  return `https://expo.dev/accounts/${encodeURIComponent(owner)}/projects/${encodeURIComponent(slug)}/builds/${encodeURIComponent(id)}`;
}

export function normalizeBuildJson(rawBuild, overrides = {}) {
  const build = Array.isArray(rawBuild)
    ? rawBuild[0]
    : Array.isArray(rawBuild?.builds)
      ? rawBuild.builds[0]
      : rawBuild;
  if (!build || typeof build !== 'object') {
    throw new Error('The EAS build JSON must contain a build object.');
  }

  const id = firstDefined(overrides.buildId, build.id);
  const projectOwner = firstDefined(
    build.project?.ownerAccount?.name,
    build.project?.ownerAccount?.username,
    build.project?.owner,
  );
  const projectSlug = firstDefined(build.project?.slug, build.projectSlug);
  const derivedUrl = buildDetailsUrl({ id, owner: projectOwner, slug: projectSlug });

  return {
    id,
    url: firstDefined(
      overrides.url,
      build.buildDetailsPageUrl,
      build.buildDetailsUrl,
      build.detailsUrl,
      build.url,
      derivedUrl,
    ),
    artifactUrl: firstDefined(
      overrides.artifactUrl,
      build.artifacts?.buildUrl,
      build.artifacts?.applicationArchiveUrl,
      build.artifactUrl,
    ),
    commitSha: firstDefined(
      overrides.commitSha,
      build.gitCommitHash,
      build.gitCommit?.hash,
      build.metadata?.gitCommitHash,
    ),
    platform: firstDefined(overrides.platform, build.platform)?.toLowerCase() ?? null,
    profile: firstDefined(overrides.profile, build.buildProfile, build.profile),
    status: firstDefined(build.status, overrides.status) ?? 'unknown',
    appVersion: firstDefined(build.appVersion, build.runtimeVersion) ?? 'not reported',
    buildVersion: firstDefined(build.appBuildVersion, build.buildNumber) ?? 'not reported',
  };
}

export function renderReleaseEvidence({
  build,
  owner,
  projectId,
  identifier,
  device,
  os,
  tester,
  result,
  testedAt,
  notes = '',
}) {
  const normalizedResult = result.toUpperCase();
  const passed = normalizedResult === 'PASS';
  const checkbox = passed ? '[x]' : '[ ]';

  return `# Preview release evidence — ${testedAt}

## Build

| Field | Value |
| --- | --- |
| EAS build ID | \`${build.id}\` |
| Build details URL | ${build.url} |
| Artifact URL | ${build.artifactUrl ?? 'Not reported'} |
| Commit SHA | \`${build.commitSha}\` |
| Platform | ${build.platform} |
| Build profile | ${build.profile} |
| EAS status | ${build.status} |
| App version | ${build.appVersion} |
| Native build version | ${build.buildVersion} |
| Expo owner | \`${owner}\` |
| EAS project ID | \`${projectId}\` |
| Native identifier | \`${identifier}\` |
| Signing credentials | Remote EAS-managed credentials |

## Installation target

| Field | Value |
| --- | --- |
| Device or emulator | ${device} |
| OS and version | ${os} |
| Tester | ${tester} |
| Test date | ${testedAt} |

## Binary smoke verification

- ${checkbox} APK/IPA installed without Metro or Expo Go.
- ${checkbox} App icon is correct on the launcher or home screen.
- ${checkbox} Branded splash screen appears on a cold launch.
- ${checkbox} Bundled fonts render correctly.
- ${checkbox} Every tab opens and navigation remains responsive.
- ${checkbox} Representative modals/sheets open, close, and accept input.
- ${checkbox} A SQLite-backed record can be created.
- ${checkbox} The record survives force-close and relaunch.

## Result

**${normalizedResult}**

${notes.trim() || 'No additional notes.'}
`;
}

function parseArguments(argv) {
  const options = {};
  const valueArguments = new Set([
    '--build-json',
    '--build-id',
    '--url',
    '--artifact-url',
    '--commit-sha',
    '--platform',
    '--profile',
    '--device',
    '--os',
    '--tester',
    '--result',
    '--date',
    '--notes',
    '--output-dir',
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!valueArguments.has(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${argument} requires a value.`);
    }
    options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    index += 1;
  }

  for (const required of ['buildJson', 'device', 'os', 'tester', 'result']) {
    if (!options[required]) {
      throw new Error(
        'Usage: npm run record:preview -- --build-json FILE --device DEVICE --os OS --tester NAME --result pass|fail|blocked [--notes TEXT]',
      );
    }
  }

  const result = options.result.toLowerCase();
  if (!['pass', 'fail', 'blocked'].includes(result)) {
    throw new Error('--result must be pass, fail, or blocked.');
  }
  options.result = result;
  return options;
}

function readLinkedProjectMetadata() {
  const appConfig = fs.readFileSync(path.join(projectRoot, 'app.config.js'), 'utf8');
  const owner = appConfig.match(/\bowner:\s*'([^']+)'/)?.[1];
  const projectId = appConfig.match(/\bprojectId:\s*'([^']+)'/)?.[1];
  const androidIdentifier = appConfig.match(/\bpackage:\s*'([^']+)'/)?.[1];
  const iosIdentifier = appConfig.match(/\bbundleIdentifier:\s*'([^']+)'/)?.[1];
  const slug = appConfig.match(/\bslug:\s*'([^']+)'/)?.[1];

  if (!owner || !projectId) {
    throw new Error('Commit owner and extra.eas.projectId before recording release evidence.');
  }

  return { owner, projectId, androidIdentifier, iosIdentifier, slug };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const buildJsonPath = path.resolve(process.cwd(), options.buildJson);
  const rawBuild = JSON.parse(fs.readFileSync(buildJsonPath, 'utf8'));
  const build = normalizeBuildJson(rawBuild, options);
  const metadata = readLinkedProjectMetadata();
  build.url ??= buildDetailsUrl({ id: build.id, owner: metadata.owner, slug: metadata.slug });

  for (const [field, value] of Object.entries({
    'build ID': build.id,
    'build details URL': build.url,
    'commit SHA': build.commitSha,
    platform: build.platform,
    profile: build.profile,
  })) {
    if (!value) {
      throw new Error(`EAS build JSON is missing ${field}; provide the corresponding command-line override.`);
    }
  }

  if (build.status.toLowerCase() !== 'finished') {
    throw new Error(`Build ${build.id} has status ${build.status}; evidence can only be recorded for a finished build.`);
  }
  if (!['android', 'ios'].includes(build.platform)) {
    throw new Error(`Unsupported platform: ${build.platform}`);
  }

  const testedAt = options.date ?? new Date().toISOString().slice(0, 10);
  const identifier =
    build.platform === 'android' ? metadata.androidIdentifier : metadata.iosIdentifier;
  const document = renderReleaseEvidence({
    build,
    ...metadata,
    identifier,
    device: options.device,
    os: options.os,
    tester: options.tester,
    result: options.result,
    testedAt,
    notes: options.notes,
  });

  const outputDirectory = path.resolve(options.outputDir ?? defaultOutputDirectory);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const safeId = build.id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12);
  const outputPath = path.join(outputDirectory, `${testedAt}-${build.platform}-${safeId}.md`);

  if (fs.existsSync(outputPath)) {
    throw new Error(`Evidence already exists: ${path.relative(projectRoot, outputPath)}`);
  }

  fs.writeFileSync(outputPath, document);
  console.log(`Wrote ${path.relative(projectRoot, outputPath)}`);
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
