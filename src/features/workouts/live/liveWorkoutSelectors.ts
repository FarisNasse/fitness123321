import type { SmartExerciseDefaults } from '@/src/features/workouts/workout-service';
import type { Exercise } from '@/src/types/models';

import type { LocalWorkoutSetRow } from './liveWorkoutState';
import { formatRepRange, formatWeightInput } from './liveWorkoutFormatting';

export function buildExerciseSetMap(sets: LocalWorkoutSetRow[]) {
  return sets.reduce((map, set) => {
    const exerciseSets = map.get(set.exercise_id) ?? [];
    map.set(set.exercise_id, [...exerciseSets, set]);
    return map;
  }, new Map<string, LocalWorkoutSetRow[]>());
}

export function getRecentSetsForExercise(sets: LocalWorkoutSetRow[]) {
  return [...sets].sort((a, b) => Number(b.set_number) - Number(a.set_number));
}

export function formatExerciseProgressLabel(
  exercise: Exercise,
  exerciseSets: LocalWorkoutSetRow[],
  defaults?: SmartExerciseDefaults
) {
  const completed = exerciseSets.length;
  const target = defaults?.targetSets;
  const targetPart = target ? `/${target}` : '';

  if (completed === 0) {
    return `${exercise.name} 0${targetPart}`;
  }

  return `${exercise.name} ${completed}${targetPart}`;
}

export function formatLastSetSummary(set: LocalWorkoutSetRow | null) {
  if (!set) return 'No sets logged yet';

  return `${set.reps ?? 0} reps @ ${formatWeightInput(Number(set.weight ?? 0))} lb`;
}

export function formatRecentSetLine(set: LocalWorkoutSetRow) {
  return `${set.set_number}   ${set.reps ?? 0} × ${formatWeightInput(Number(set.weight ?? 0))}`;
}

export function formatTargetSummary(defaults: SmartExerciseDefaults | null) {
  if (!defaults) {
    return 'Target: 3 sets · 8-12 reps';
  }

  return `Target: ${defaults.targetSets} sets · ${formatRepRange(
    defaults.repMin,
    defaults.repMax
  )} reps`;
}
