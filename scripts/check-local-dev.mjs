import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/features/workouts/seed-exercises.json',
  'src/features/workouts/exercise-service.ts',
  'src/features/workouts/workout-service.ts',
  'src/lib/runtime-flags.ts',
  'app/(tabs)/workouts.tsx',
  'app/workout/session/[id].tsx',
];

const errors = [];

function resolveProjectPath(file) {
  return join(root, file);
}

function readRequiredText(file) {
  const fullPath = resolveProjectPath(file);

  if (!existsSync(fullPath)) {
    errors.push(`Missing required local-dev file: ${file}`);
    return null;
  }

  return readFileSync(fullPath, 'utf8');
}

function readRequiredJson(file) {
  const contents = readRequiredText(file);

  if (!contents) return null;

  try {
    return JSON.parse(contents);
  } catch (error) {
    errors.push(
      `Could not parse ${file}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

const exercises = readRequiredJson('src/features/workouts/seed-exercises.json');

if (!Array.isArray(exercises) || exercises.length < 8) {
  errors.push('Expected at least 8 local seed exercises.');
}

const flags = readRequiredText('src/lib/runtime-flags.ts');

if (flags && !flags.includes("EXPO_PUBLIC_WORKOUT_SYNC_SOURCE === 'supabase'")) {
  errors.push('Workout sync should default to local unless explicitly set to supabase.');
}

const workoutsScreen = readRequiredText('app/(tabs)/workouts.tsx');

if (workoutsScreen?.includes('supabase.auth.getUser')) {
  errors.push('Workouts screen still blocks local testing behind Supabase auth.');
}

const sessionScreen = readRequiredText('app/workout/session/[id].tsx');

if (sessionScreen) {
  for (const expected of ['ExerciseLibrary', 'addLocalWorkoutSet', 'getLocalWorkoutSets']) {
    if (!sessionScreen.includes(expected)) {
      errors.push(`Live workout screen is missing ${expected}.`);
    }
  }
}

if (errors.length > 0) {
  console.error('Local MVP check failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Local MVP check passed.');
console.log(`Seed exercises: ${exercises.length}`);
console.log('Workout start: local user, no Supabase auth required.');
console.log('Workout session: exercise picker + set logging wired locally.');
console.log('Remote sync: off by default; enable with EXPO_PUBLIC_WORKOUT_SYNC_SOURCE=supabase.');
