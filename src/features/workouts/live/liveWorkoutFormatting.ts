import type { SmartExerciseDefaults } from '@/src/features/workouts/workout-service';

import type { SetDraft } from './liveWorkoutState';

export function formatWeightInput(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1).replace(/\.0$/, '');
}

export function formatRepRange(min: number, max: number) {
  return min === max ? String(min) : `${min}-${max}`;
}

export function formatClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function formatShortClock(totalSeconds: number) {
  return formatClock(totalSeconds).slice(3);
}

export function getSmartSourceLabel(source?: SmartExerciseDefaults['source']) {
  switch (source) {
    case 'history':
      return 'Based on recent history';
    case 'target':
      return 'Based on saved target';
    case 'fallback':
      return 'Starter default';
    default:
      return 'Starter default';
  }
}

export function buildLogSetDetail(draft: SetDraft) {
  const reps = draft.reps.trim();
  const weight = draft.weight.trim();
  const parsedWeight = Number.parseFloat(weight);
  const repsLabel = reps ? `${reps} reps` : 'reps';

  if (weight && Number.isFinite(parsedWeight) && parsedWeight > 0) {
    return `${repsLabel} @ ${formatWeightInput(parsedWeight)} lb`;
  }

  return repsLabel;
}

export function buildLogSetTitle(setNumber: number) {
  return `Log set ${setNumber}`;
}

export function validateSetDraft(draft: SetDraft) {
  const parsedReps = Number.parseInt(draft.reps, 10);
  const parsedWeight = Number.parseFloat(draft.weight || '0');

  if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
    return 'Enter a valid rep count.';
  }

  if (!Number.isFinite(parsedWeight) || parsedWeight < 0) {
    return 'Enter a valid weight.';
  }

  return null;
}

export function rgba(red: number, green: number, blue: number, alpha: number) {
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
