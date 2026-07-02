import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function projectPath(file) {
  return join(rootDir, file);
}

export function readProjectFile(file) {
  return readFileSync(projectPath(file), 'utf8');
}

export function readProjectJson(file) {
  return JSON.parse(readProjectFile(file));
}

export function fileExists(file) {
  return existsSync(projectPath(file));
}


const liveWorkoutUiFiles = [
  'src/features/workouts/live/components/LiveWorkoutScreenView.tsx',
  'src/features/workouts/live/components/LiveWorkoutHeader.tsx',
  'src/features/workouts/live/components/ExerciseSwitcher.tsx',
  'src/features/workouts/live/components/ActiveSetLogger.tsx',
  'src/features/workouts/live/components/SetValueStepper.tsx',
  'src/features/workouts/live/components/RecentSetList.tsx',
  'src/features/workouts/live/components/DockedLogSetAction.tsx',
  'src/features/workouts/live/components/NoExerciseState.tsx',
  'src/features/workouts/live/components/SavedSetNotice.tsx',
  'src/features/workouts/live/components/sheets/BaseSheet.tsx',
  'src/features/workouts/live/components/sheets/ExercisePickerSheet.tsx',
  'src/features/workouts/live/components/sheets/TargetSettingsSheet.tsx',
  'src/features/workouts/live/components/sheets/EditSetSheet.tsx',
  'src/features/workouts/live/components/sheets/ExerciseInstructionsSheet.tsx',
  'src/features/workouts/live/components/sheets/FinishWorkoutSheet.tsx',
];

export function readLiveWorkoutUiSource() {
  return liveWorkoutUiFiles.map((file) => readProjectFile(file)).join('\n');
}

export function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

export function runNodeScript(file) {
  return execFileSync(process.execPath, [projectPath(file)], {
    cwd: rootDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      EXPO_PUBLIC_WORKOUT_SYNC_SOURCE: '',
      EXPO_PUBLIC_EXERCISE_SOURCE: '',
    },
  });
}
