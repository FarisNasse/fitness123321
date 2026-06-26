export type ProgressionDecision = 'increase' | 'repeat' | 'deload';
export type ProgressionEffortFeedback = 'easy' | 'good' | 'max';

export type ProgressionSetInput = {
  setNumber?: number;
  reps?: number | null;
  weight?: number | null;
};

export type ProgressionRecommendationInput = {
  exerciseId: string;
  exerciseName?: string;
  currentSets: ProgressionSetInput[];
  previousSets?: ProgressionSetInput[];
  targetSets: number;
  repMin: number;
  repMax: number;
  incrementSize: number;
  deloadPercentage: number;
  effortFeedback?: ProgressionEffortFeedback | null;
};

export type ProgressionRecommendation = {
  exerciseId: string;
  exerciseName?: string;
  decision: ProgressionDecision;
  nextReps: number;
  nextWeight: number;
  reason: string;
  estimatedOneRepMax: number | null;
  previousEstimatedOneRepMax: number | null;
  oneRepMaxInsight: string | null;
};

type NormalizedSet = {
  reps: number;
  weight: number;
};

const ONE_REP_MAX_DROP_RATIO = 0.93;

function normalizePositiveInteger(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function normalizePositiveNumber(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampRepRange(repMin: number, repMax: number) {
  const normalizedMin = normalizePositiveInteger(repMin, 8);
  const normalizedMax = Math.max(normalizedMin, normalizePositiveInteger(repMax, 12));

  return { repMin: normalizedMin, repMax: normalizedMax };
}

function normalizeSets(sets: ProgressionSetInput[]) {
  return sets
    .map((set) => ({
      reps: Number(set.reps ?? 0),
      weight: Number(set.weight ?? 0),
    }))
    .filter((set): set is NormalizedSet => {
      return Number.isFinite(set.reps) && set.reps > 0 && Number.isFinite(set.weight) && set.weight >= 0;
    });
}

function roundToNearestIncrement(value: number, incrementSize: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(incrementSize) || incrementSize <= 0) return Math.max(0, Math.round(value));

  return Math.max(0, Math.round(value / incrementSize) * incrementSize);
}

export function estimatedProgressionOneRepMax(weight: number, reps: number) {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) {
    return null;
  }

  if (reps <= 1) {
    return weight;
  }

  return weight * (1 + reps / 30);
}

function bestEstimatedOneRepMax(sets: NormalizedSet[]) {
  const estimates = sets
    .map((set) => estimatedProgressionOneRepMax(set.weight, set.reps))
    .filter((estimate): estimate is number => estimate !== null);

  return estimates.length > 0 ? Math.max(...estimates) : null;
}

function averageReps(sets: NormalizedSet[]) {
  if (sets.length === 0) return 0;

  return sets.reduce((total, set) => total + set.reps, 0) / sets.length;
}

function representativeWeight(sets: NormalizedSet[]) {
  return sets.reduce((maxWeight, set) => Math.max(maxWeight, set.weight), 0);
}

function buildOneRepMaxInsight(current: number | null, previous: number | null) {
  if (current === null) return null;

  const roundedCurrent = Math.round(current);

  if (previous === null) {
    return `Estimated 1RM: about ${roundedCurrent} lb. Use this as a progress clue, not the main rule.`;
  }

  const roundedPrevious = Math.round(previous);

  if (current > previous * 1.02) {
    return `Estimated 1RM rose from about ${roundedPrevious} to ${roundedCurrent} lb. Nice secondary progress sign.`;
  }

  if (current < previous * 0.98) {
    return `Estimated 1RM dipped from about ${roundedPrevious} to ${roundedCurrent} lb. Treat it as a clue, not a command.`;
  }

  return `Estimated 1RM stayed around ${roundedCurrent} lb. The rep-range rule still drives the recommendation.`;
}

function exerciseLabel(input: ProgressionRecommendationInput) {
  return input.exerciseName?.trim() || 'This exercise';
}

function buildIncreaseReason(input: ProgressionRecommendationInput, repMax: number, incrementSize: number) {
  const targetSets = normalizePositiveInteger(input.targetSets, 3);
  const feedbackNote = input.effortFeedback === 'easy' ? ' It felt easy, which supports the bump.' : '';

  return `${exerciseLabel(input)}: you hit ${repMax} reps on all ${targetSets} target sets. Add ${incrementSize} lb next time and start back near the low end of the range.${feedbackNote}`;
}

function buildRepeatReason(input: ProgressionRecommendationInput, repMin: number, repMax: number) {
  if (input.effortFeedback === 'max') {
    return `${exerciseLabel(input)}: that felt like a max effort, so keep the same weight next time instead of forcing a jump.`;
  }

  return `${exerciseLabel(input)}: keep the same weight until every target set reaches ${repMax} reps. Staying in the ${repMin}-${repMax} rep range is still progress.`;
}

function buildDeloadReason(input: ProgressionRecommendationInput, repMin: number, deloadPercentage: number) {
  if (input.effortFeedback === 'max') {
    return `${exerciseLabel(input)}: reps fell below ${repMin} at max effort. Drop about ${deloadPercentage}% next time so the sets are cleaner.`;
  }

  return `${exerciseLabel(input)}: performance dropped below the rep floor compared with recent history. Deload about ${deloadPercentage}% and rebuild.`;
}

export function buildProgressionRecommendation(
  input: ProgressionRecommendationInput
): ProgressionRecommendation {
  const { repMin, repMax } = clampRepRange(input.repMin, input.repMax);
  const targetSets = normalizePositiveInteger(input.targetSets, 3);
  const incrementSize = normalizePositiveNumber(input.incrementSize, 5);
  const deloadPercentage = normalizePositiveNumber(input.deloadPercentage, 10);
  const currentSets = normalizeSets(input.currentSets);
  const previousSets = normalizeSets(input.previousSets ?? []);
  const currentWeight = representativeWeight(currentSets);
  const nextRepeatWeight = currentWeight;
  const currentEstimatedOneRepMax = bestEstimatedOneRepMax(currentSets);
  const previousEstimatedOneRepMax = bestEstimatedOneRepMax(previousSets);
  const oneRepMaxInsight = buildOneRepMaxInsight(
    currentEstimatedOneRepMax,
    previousEstimatedOneRepMax
  );

  if (currentSets.length === 0) {
    return {
      exerciseId: input.exerciseId,
      exerciseName: input.exerciseName,
      decision: 'repeat',
      nextReps: repMin,
      nextWeight: 0,
      reason: `${exerciseLabel(input)}: no completed sets were found, so start with a comfortable weight in the ${repMin}-${repMax} rep range.`,
      estimatedOneRepMax: null,
      previousEstimatedOneRepMax,
      oneRepMaxInsight,
    };
  }

  const targetWorkingSets = currentSets.slice(0, targetSets);
  const completedEnoughSets = currentSets.length >= targetSets;
  const allTargetSetsAtRepMax =
    completedEnoughSets && targetWorkingSets.every((set) => set.reps >= repMax);
  const anyTargetSetBelowRepMin = targetWorkingSets.some((set) => set.reps < repMin);
  const currentAverageReps = averageReps(targetWorkingSets);
  const previousAverageReps = averageReps(previousSets.slice(0, targetSets));
  const oneRepMaxDropped =
    previousEstimatedOneRepMax !== null &&
    currentEstimatedOneRepMax !== null &&
    currentEstimatedOneRepMax < previousEstimatedOneRepMax * ONE_REP_MAX_DROP_RATIO;

  if (allTargetSetsAtRepMax && input.effortFeedback !== 'max') {
    const nextWeight = roundToNearestIncrement(currentWeight + incrementSize, incrementSize);

    return {
      exerciseId: input.exerciseId,
      exerciseName: input.exerciseName,
      decision: 'increase',
      nextReps: repMin,
      nextWeight,
      reason: buildIncreaseReason(input, repMax, incrementSize),
      estimatedOneRepMax: currentEstimatedOneRepMax,
      previousEstimatedOneRepMax,
      oneRepMaxInsight,
    };
  }

  if (
    (input.effortFeedback === 'max' && anyTargetSetBelowRepMin) ||
    (anyTargetSetBelowRepMin && oneRepMaxDropped && currentAverageReps < previousAverageReps)
  ) {
    const deloadMultiplier = Math.max(0, 1 - deloadPercentage / 100);
    const nextWeight = roundToNearestIncrement(currentWeight * deloadMultiplier, incrementSize);

    return {
      exerciseId: input.exerciseId,
      exerciseName: input.exerciseName,
      decision: 'deload',
      nextReps: repMin,
      nextWeight,
      reason: buildDeloadReason(input, repMin, deloadPercentage),
      estimatedOneRepMax: currentEstimatedOneRepMax,
      previousEstimatedOneRepMax,
      oneRepMaxInsight,
    };
  }

  return {
    exerciseId: input.exerciseId,
    exerciseName: input.exerciseName,
    decision: 'repeat',
    nextReps: Math.min(repMax, Math.max(repMin, Math.round(currentAverageReps))),
    nextWeight: nextRepeatWeight,
    reason: buildRepeatReason(input, repMin, repMax),
    estimatedOneRepMax: currentEstimatedOneRepMax,
    previousEstimatedOneRepMax,
    oneRepMaxInsight,
  };
}

export function formatProgressionDecisionLabel(decision: ProgressionDecision) {
  switch (decision) {
    case 'increase':
      return 'Increase';
    case 'repeat':
      return 'Repeat';
    case 'deload':
      return 'Deload';
  }
}

export function buildProgressionSummaryLines(
  recommendations: ProgressionRecommendation[],
  limit = 3
) {
  return recommendations.slice(0, limit).map((recommendation) => {
    const label = formatProgressionDecisionLabel(recommendation.decision);
    const weightText = recommendation.nextWeight > 0 ? ` at ${recommendation.nextWeight} lb` : '';

    return `${label}: ${recommendation.reason} Next target: ${recommendation.nextReps} reps${weightText}.`;
  });
}
