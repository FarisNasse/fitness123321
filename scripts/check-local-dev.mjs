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

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    errors.push(`Missing required local-dev file: ${file}`);
  }
}

const seedsPath = join(root, 'src/features/workouts/seed-exercises.json');
const exercises = JSON.parse(readFileSync(seedsPath, 'utf8'));

if (!Array.isArray(exercises) || exercises.length < 8) {
  errors.push('Expected at least 8 local seed exercises.');
}

const flags = readFileSync(join(root, 'src/lib/runtime-flags.ts'), 'utf8');

if (!flags.includes("EXPO_PUBLIC_WORKOUT_SYNC_SOURCE === 'supabase'")) {
  errors.push('Workout sync should default to local unless explicitly set to supabase.');
}

const workoutsScreen = readFileSync(join(root, 'app/(tabs)/workouts.tsx'), 'utf8');

if (workoutsScreen.includes('supabase.auth.getUser')) {
  errors.push('Workouts screen still blocks local testing behind Supabase auth.');
}

const sessionScreen = readFileSync(join(root, 'app/workout/session/[id].tsx'), 'utf8');

for (const expected of ['ExerciseLibrary', 'addLocalWorkoutSet', 'getLocalWorkoutSets']) {
  if (!sessionScreen.includes(expected)) {
    errors.push(`Live workout screen is missing ${expected}.`);
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
