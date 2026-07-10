import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
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

if (flags && !flags.includes("EXPO_PUBLIC_AUTH_MODE ?? 'local'")) {
  errors.push('Auth should default to local dev mode unless explicitly set to supabase.');
}

if (flags && !flags.includes("EXPO_PUBLIC_WORKOUT_SYNC_SOURCE === 'supabase'")) {
  errors.push('Workout sync should default to local unless explicitly set to supabase.');
}


const devAuth = readRequiredText('src/features/auth/dev-auth.ts');

if (devAuth) {
  if (!devAuth.includes('LOCAL_DEV_SESSION')) {
    errors.push('Local dev auth should provide a synthetic session.');
  }

  if (!devAuth.includes('primary_goal')) {
    errors.push('Local dev auth should provide an onboarded profile.');
  }
}

const workoutsScreen = readRequiredText('app/(tabs)/workouts.tsx');

if (workoutsScreen?.includes('supabase.auth.getUser')) {
  errors.push('Workouts screen still blocks local testing behind Supabase auth.');
}

const workoutService = readRequiredText('src/features/workouts/workout-service.ts');

if (workoutService) {
  if (!workoutService.includes('and user_id != ?')) {
    errors.push(
      'Remote workout sync should exclude LOCAL_DEV_USER_ID sessions from the sync queue.'
    );
  }

  if (!workoutService.includes('[LOCAL_DEV_USER_ID]')) {
    errors.push('Remote workout sync should pass LOCAL_DEV_USER_ID as the excluded owner.');
  }
}

const sessionScreen = readRequiredText('app/workout/session/[id].tsx');
const liveController = readRequiredText('src/features/workouts/live/useLiveWorkoutController.ts');
const liveView = [
  readRequiredText('src/features/workouts/live/components/LiveWorkoutScreenView.tsx'),
  readRequiredText('src/features/workouts/live/components/sheets/ExercisePickerSheet.tsx'),
].filter(Boolean).join('\n');

if (sessionScreen && !sessionScreen.includes('useLiveWorkoutController')) {
  errors.push('Live workout route should delegate behavior to useLiveWorkoutController.');
}

if (liveController) {
  for (const expected of ['addLocalWorkoutSet', 'getLocalWorkoutSets', 'syncPendingWorkoutSessions']) {
    if (!liveController.includes(expected)) {
      errors.push(`Live workout controller is missing ${expected}.`);
    }
  }
}

if (liveView && !liveView.includes('ExerciseLibrary')) {
  errors.push('Live workout view is missing the ExerciseLibrary picker sheet.');
}

if (errors.length > 0) {
  console.error('Local MVP check failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Local MVP check passed.');
console.log(`Seed exercises: ${exercises.length}`);
console.log('Auth: local dev user signs in automatically unless EXPO_PUBLIC_AUTH_MODE=supabase.');
console.log('Workout start: local user, no Supabase auth required.');
console.log('Workout session: controller + exercise picker + docked set logging wired locally.');
console.log('Remote sync: off by default; enable with EXPO_PUBLIC_WORKOUT_SYNC_SOURCE=supabase.');
