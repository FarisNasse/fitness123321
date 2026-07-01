import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { Alert } from 'react-native';

import {
  getExerciseById,
  getSeededExercises,
  rememberExercises,
} from '@/src/features/workouts/exercise-service';
import {
  addLocalWorkoutSessionExercise,
  addLocalWorkoutSet,
  completeLocalWorkoutSession,
  deleteLocalWorkoutSet,
  getLocalWorkoutSession,
  getLocalWorkoutSessionExercises,
  getLocalWorkoutSets,
  getSmartExerciseDefaults,
  getWorkoutCompletionProgressionReasonText,
  syncPendingWorkoutSessions,
  updateLocalWorkoutSet,
  upsertLocalExerciseTarget,
  type SmartExerciseDefaults,
} from '@/src/features/workouts/workout-service';
import type { LocalWorkoutSet } from '@/src/lib/local-db';
import type { Exercise } from '@/src/types/models';

import {
  buildLogSetDetail,
  buildLogSetTitle,
  formatRepRange,
  formatWeightInput,
  getSmartSourceLabel,
  validateSetDraft,
} from './liveWorkoutFormatting';
import { liveWorkoutReducer } from './liveWorkoutReducer';
import {
  buildExerciseSetMap,
  formatExerciseProgressLabel,
  formatLastSetSummary,
  formatTargetSummary,
  getRecentSetsForExercise,
} from './liveWorkoutSelectors';
import {
  DEFAULT_EDIT_INPUTS,
  DEFAULT_SET_DRAFT,
  DEFAULT_TARGET_INPUTS,
  FALLBACK_WEIGHT_INCREMENT,
  INITIAL_LIVE_WORKOUT_UI_STATE,
  REP_STEP,
  REST_DURATION_SECONDS,
  type EditSetInputs,
  type LiveWorkoutController,
  type LocalWorkoutSetRow,
  type SessionLoadState,
  type SetDraft,
  type TargetInputs,
  type WorkoutSessionForScreen,
} from './liveWorkoutState';

function getSuggestedSetForIndex(
  defaults: SmartExerciseDefaults,
  currentSetCount: number
) {
  return (
    defaults.suggestedSets[currentSetCount] ??
    defaults.suggestedSets[defaults.suggestedSets.length - 1] ??
    { setNumber: currentSetCount + 1, reps: defaults.repMin, weight: 0 }
  );
}

function buildDraftFromSuggestedSet(
  defaults: SmartExerciseDefaults,
  currentSetCount: number
): SetDraft {
  const nextSet = getSuggestedSetForIndex(defaults, currentSetCount);

  return {
    reps: String(nextSet.reps),
    weight: formatWeightInput(nextSet.weight),
    source: 'suggested',
    dirty: false,
  };
}

function buildDraftFromLastSet(set: LocalWorkoutSetRow): SetDraft {
  return {
    reps: String(set.reps ?? DEFAULT_SET_DRAFT.reps),
    weight: formatWeightInput(Number(set.weight ?? DEFAULT_SET_DRAFT.weight)),
    source: 'last-set',
    dirty: false,
  };
}

function buildDraftFromLoggedValues(reps: number, weight: number): SetDraft {
  return {
    reps: String(reps),
    weight: formatWeightInput(weight),
    source: 'last-set',
    dirty: false,
  };
}

function parseSetInputs(draft: SetDraft) {
  const parsedReps = Number.parseInt(draft.reps, 10);
  const parsedWeight = Number.parseFloat(draft.weight || '0');

  if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
    return null;
  }

  if (!Number.isFinite(parsedWeight) || parsedWeight < 0) {
    return null;
  }

  return { parsedReps, parsedWeight };
}

function getInitialDraftForExercise(
  exercise: Exercise,
  exerciseSetMap: Map<string, LocalWorkoutSetRow[]>,
  defaults?: SmartExerciseDefaults
): SetDraft {
  const exerciseSets = exerciseSetMap.get(exercise.id) ?? [];
  const lastSet = exerciseSets[exerciseSets.length - 1];

  if (lastSet) {
    return buildDraftFromLastSet(lastSet);
  }

  if (defaults) {
    return buildDraftFromSuggestedSet(defaults, exerciseSets.length);
  }

  return DEFAULT_SET_DRAFT;
}

function resolveSessionId(id: string | string[] | undefined) {
  if (Array.isArray(id)) return id[0];
  return id;
}

export function useLiveWorkoutController(id: string | string[] | undefined) {
  const sessionId = useMemo(() => resolveSessionId(id), [id]);
  const exercises = useMemo(() => getSeededExercises(), []);
  const [uiState, dispatch] = useReducer(
    liveWorkoutReducer,
    INITIAL_LIVE_WORKOUT_UI_STATE
  );
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<ReturnType<typeof getLocalWorkoutSets>>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [exerciseSetMap, setExerciseSetMap] = useState<
    Map<string, LocalWorkoutSetRow[]>
  >(() => new Map());
  const [exerciseLookup, setExerciseLookup] = useState<Record<string, Exercise>>(
    () =>
      Object.fromEntries(
        exercises.map((exercise) => [exercise.id, exercise])
      ) as Record<string, Exercise>
  );
  const [smartDefaultsByExerciseId, setSmartDefaultsByExerciseId] = useState<
    Record<string, SmartExerciseDefaults>
  >({});
  const [targetInputs, setTargetInputs] = useState<TargetInputs>(DEFAULT_TARGET_INPUTS);
  const [effortFeedback, setEffortFeedbackState] = useState<
    LiveWorkoutController['effortFeedback']
  >(null);
  const [editingSet, setEditingSet] = useState<LocalWorkoutSet | null>(null);
  const [editInputs, setEditInputs] = useState<EditSetInputs>(DEFAULT_EDIT_INPUTS);
  const [session, setSession] = useState<WorkoutSessionForScreen | null>(null);
  const [sessionLoadState, setSessionLoadState] = useState<SessionLoadState>({
    status: 'loading',
  });

  function resolveExercise(exerciseId: string) {
    return exerciseLookup[exerciseId] ?? getExerciseById(exerciseId) ?? null;
  }

  function getDraftForExercise(exerciseId: string) {
    return uiState.draftsByExerciseId[exerciseId] ?? DEFAULT_SET_DRAFT;
  }

  function syncTargetInputs(defaults: SmartExerciseDefaults) {
    setTargetInputs({
      targetSets: String(defaults.targetSets),
      repMin: String(defaults.repMin),
      repMax: String(defaults.repMax),
      incrementSize: formatWeightInput(defaults.incrementSize),
      deloadPercentage: formatWeightInput(defaults.deloadPercentage),
    });
  }

  function ensureDraftForExercise(
    exercise: Exercise,
    defaults?: SmartExerciseDefaults,
    options: { replaceDraft?: boolean } = {}
  ) {
    dispatch({
      type: 'draft.initialized',
      exerciseId: exercise.id,
      draft: getInitialDraftForExercise(exercise, exerciseSetMap, defaults),
      replaceDraft: options.replaceDraft,
    });
  }

  async function applySmartDefaultsForExercise(
    exercise: Exercise,
    currentSetCount: number,
    options: { replaceDraft?: boolean } = {}
  ) {
    const defaults = await getSmartExerciseDefaults(exercise.id);

    setSmartDefaultsByExerciseId((current) => ({
      ...current,
      [exercise.id]: defaults,
    }));

    if (selectedExercise?.id === exercise.id || options.replaceDraft) {
      syncTargetInputs(defaults);
    }

    dispatch({
      type: 'draft.initialized',
      exerciseId: exercise.id,
      draft: buildDraftFromSuggestedSet(defaults, currentSetCount),
      replaceDraft: options.replaceDraft,
    });
  }

  function rememberExerciseSelection(exercise: Exercise) {
    setSelectedExercises((current) => {
      if (current.some((selected) => selected.id === exercise.id)) {
        return current;
      }

      return [...current, exercise];
    });
  }

  function refreshSets() {
    if (!sessionId || !session) return;

    const nextSets = getLocalWorkoutSets(sessionId);
    const nextMap = buildExerciseSetMap(nextSets);

    setSets(nextSets);
    setExerciseSetMap(nextMap);

    const savedExerciseRows = getLocalWorkoutSessionExercises(sessionId);
    const orderedSessionExercises = savedExerciseRows
      .map((row) => resolveExercise(row.exercise_id))
      .filter((exercise): exercise is Exercise => Boolean(exercise));
    const savedExerciseIds = new Set(
      orderedSessionExercises.map((exercise) => exercise.id)
    );
    const exercisesFromLoggedSets = Array.from(nextMap.keys())
      .map((exerciseId) => resolveExercise(exerciseId))
      .filter((exercise): exercise is Exercise => Boolean(exercise))
      .filter((exercise) => !savedExerciseIds.has(exercise.id));
    const nextExercises = [...orderedSessionExercises, ...exercisesFromLoggedSets];

    if (nextExercises.length > 0) {
      setSelectedExercises((current) => {
        const nextIds = new Set(nextExercises.map((exercise) => exercise.id));
        const currentOnly = current.filter((exercise) => !nextIds.has(exercise.id));

        return [...nextExercises, ...currentOnly];
      });
      setSelectedExercise((current) => current ?? nextExercises[0]);
    }
  }

  function queueWorkoutSync(reason: string) {
    void syncPendingWorkoutSessions().catch((error) => {
      console.warn(`Failed to sync workout after ${reason}.`, error);
    });
  }

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setSessionLoadState({
        status: 'error',
        message: 'Workout session unavailable',
        detail: 'No workout session id was provided.',
      });
      return;
    }

    try {
      const nextSession = getLocalWorkoutSession(sessionId);

      if (!nextSession) {
        setSession(null);
        setSessionLoadState({
          status: 'error',
          message: 'Workout session unavailable',
          detail:
            'This local workout was not found on this device. Start a new workout from the Train tab.',
        });
        return;
      }

      setSession(nextSession);
      setSessionLoadState({ status: 'ready' });
    } catch (error) {
      setSession(null);
      setSessionLoadState({
        status: 'error',
        message: 'Could not load this workout',
        detail:
          error instanceof Error
            ? error.message
            : 'The local workout database could not be read.',
      });
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionLoadState.status !== 'ready') return;

    refreshSets();
  }, [sessionId, session?.local_id, sessionLoadState.status]);

  useEffect(() => {
    if (!selectedExercise) return;

    ensureDraftForExercise(
      selectedExercise,
      smartDefaultsByExerciseId[selectedExercise.id]
    );

    if (smartDefaultsByExerciseId[selectedExercise.id]) {
      syncTargetInputs(smartDefaultsByExerciseId[selectedExercise.id]);
      return;
    }

    void applySmartDefaultsForExercise(
      selectedExercise,
      exerciseSetMap.get(selectedExercise.id)?.length ?? 0
    );
  }, [selectedExercise?.id]);

  useEffect(() => {
    if (sessionLoadState.status !== 'ready') return undefined;

    const timer = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionLoadState.status]);

  useEffect(() => {
    if (uiState.restSeconds === null) return undefined;

    if (uiState.restSeconds <= 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dispatch({ type: 'rest.skipped' });
      return undefined;
    }

    const timer = setTimeout(() => {
      dispatch({ type: 'rest.ticked' });
    }, 1000);

    return () => clearTimeout(timer);
  }, [uiState.restSeconds]);

  useEffect(() => {
    if (!uiState.savedNotice) return undefined;

    const timer = setTimeout(() => {
      dispatch({ type: 'notice.cleared' });
    }, 2400);

    return () => clearTimeout(timer);
  }, [uiState.savedNotice]);

  const selectedExerciseSets = useMemo(() => {
    if (!selectedExercise) return [];
    return exerciseSetMap.get(selectedExercise.id) ?? [];
  }, [exerciseSetMap, selectedExercise]);

  const selectedExerciseSmartDefaults = selectedExercise
    ? smartDefaultsByExerciseId[selectedExercise.id]
    : null;
  const activeDraft = selectedExercise
    ? getDraftForExercise(selectedExercise.id)
    : DEFAULT_SET_DRAFT;
  const activeIncrementSize =
    selectedExerciseSmartDefaults?.incrementSize ?? FALLBACK_WEIGHT_INCREMENT;
  const lastSet = selectedExerciseSets[selectedExerciseSets.length - 1] ?? null;
  const recentSets = getRecentSetsForExercise(selectedExerciseSets);
  const validationMessage = validateSetDraft(activeDraft);

  const currentSetDraft = {
    exerciseName: selectedExercise?.name ?? 'Choose an exercise',
    setNumber: selectedExercise ? selectedExerciseSets.length + 1 : 1,
    reps: activeDraft.reps,
    weight: activeDraft.weight,
    repRange: selectedExerciseSmartDefaults
      ? formatRepRange(
          selectedExerciseSmartDefaults.repMin,
          selectedExerciseSmartDefaults.repMax
        )
      : '8-12',
    sourceLabel: getSmartSourceLabel(selectedExerciseSmartDefaults?.source),
    targetSummary: formatTargetSummary(selectedExerciseSmartDefaults),
    logButtonTitle: buildLogSetTitle(selectedExercise ? selectedExerciseSets.length + 1 : 1),
    logButtonDetail: buildLogSetDetail(activeDraft),
    incrementSize: activeIncrementSize,
    validationMessage,
  };

  async function selectExerciseForLogging(exercise: Exercise) {
    setSelectedExercise(exercise);
    ensureDraftForExercise(exercise, smartDefaultsByExerciseId[exercise.id]);
    await applySmartDefaultsForExercise(
      exercise,
      exerciseSetMap.get(exercise.id)?.length ?? 0
    );
  }

  async function chooseExercise(exercise: Exercise) {
    if (sessionId) {
      addLocalWorkoutSessionExercise(sessionId, exercise.id);
    }

    rememberExercises([exercise]);
    setExerciseLookup((current) => ({
      ...current,
      [exercise.id]: exercise,
    }));
    setExerciseSetMap((current) => {
      const nextMap = new Map(current);

      if (!nextMap.has(exercise.id)) {
        nextMap.set(exercise.id, []);
      }

      return nextMap;
    });
    rememberExerciseSelection(exercise);
    setSelectedExercise(exercise);
    dispatch({ type: 'sheet.closed' });
    await applySmartDefaultsForExercise(
      exercise,
      exerciseSetMap.get(exercise.id)?.length ?? 0
    );
  }

  function updateSelectedDraft(patch: Partial<Pick<SetDraft, 'reps' | 'weight'>>) {
    if (!selectedExercise) return;

    dispatch({ type: 'draft.changed', exerciseId: selectedExercise.id, patch });
  }

  function adjustReps(delta: number) {
    if (!selectedExercise) return;

    const draft = getDraftForExercise(selectedExercise.id);
    const currentValue = Number.parseInt(draft.reps, 10);
    const nextValue = Math.max(
      1,
      (Number.isFinite(currentValue) ? currentValue : 0) + delta
    );

    updateSelectedDraft({ reps: String(nextValue) });
  }

  function adjustWeight(delta: number) {
    if (!selectedExercise) return;

    const draft = getDraftForExercise(selectedExercise.id);
    const currentValue = Number.parseFloat(draft.weight);
    const nextValue = Math.max(
      0,
      (Number.isFinite(currentValue) ? currentValue : 0) + delta
    );

    updateSelectedDraft({ weight: formatWeightInput(nextValue) });
  }

  function addSet() {
    if (!selectedExercise || !sessionId || !session) return;

    const parsed = parseSetInputs(activeDraft);

    if (!parsed) {
      Alert.alert('Set not ready', validationMessage ?? 'Enter reps and weight first.');
      return;
    }

    const currentExerciseSets = exerciseSetMap.get(selectedExercise.id) ?? [];
    const setNumber = currentExerciseSets.length + 1;

    addLocalWorkoutSet({
      sessionLocalId: sessionId,
      exerciseId: selectedExercise.id,
      setNumber,
      reps: parsed.parsedReps,
      weight: parsed.parsedWeight,
    });

    const notice = `Saved set ${setNumber}: ${parsed.parsedReps} × ${formatWeightInput(
      parsed.parsedWeight
    )}`;

    dispatch({
      type: 'set.logged',
      exerciseId: selectedExercise.id,
      nextDraft: buildDraftFromLoggedValues(parsed.parsedReps, parsed.parsedWeight),
      notice,
    });
    refreshSets();
    queueWorkoutSync('adding a set');
    dispatch({ type: 'rest.started', seconds: REST_DURATION_SECONDS });
    void applySmartDefaultsForExercise(selectedExercise, currentExerciseSets.length + 1, {
      replaceDraft: true,
    });
  }

  async function saveSelectedExerciseTarget() {
    if (!selectedExercise) return;

    const targetSets = Number.parseInt(targetInputs.targetSets, 10);
    const repMin = Number.parseInt(targetInputs.repMin, 10);
    const repMax = Number.parseInt(targetInputs.repMax, 10);
    const incrementSize = Number.parseFloat(targetInputs.incrementSize);
    const deloadPercentage = Number.parseFloat(targetInputs.deloadPercentage);

    if (!Number.isFinite(targetSets) || targetSets <= 0) {
      Alert.alert('Invalid target', 'Enter at least one target set.');
      return;
    }

    if (
      !Number.isFinite(repMin) ||
      !Number.isFinite(repMax) ||
      repMin <= 0 ||
      repMax < repMin
    ) {
      Alert.alert(
        'Invalid rep range',
        'Enter a rep max that is greater than or equal to the rep min.'
      );
      return;
    }

    if (!Number.isFinite(incrementSize) || incrementSize <= 0) {
      Alert.alert('Invalid increment', 'Enter an increment greater than zero.');
      return;
    }

    if (!Number.isFinite(deloadPercentage) || deloadPercentage <= 0) {
      Alert.alert('Invalid deload', 'Enter a deload percentage greater than zero.');
      return;
    }

    upsertLocalExerciseTarget({
      exerciseId: selectedExercise.id,
      targetSets,
      repMin,
      repMax,
      incrementSize,
      deloadPercentage,
    });
    await applySmartDefaultsForExercise(selectedExercise, selectedExerciseSets.length, {
      replaceDraft: true,
    });
    dispatch({ type: 'sheet.closed' });
  }

  function openEditSheet(set: LocalWorkoutSet) {
    setEditingSet(set);
    setEditInputs({
      reps: String(set.reps ?? ''),
      weight: String(set.weight ?? ''),
    });
    dispatch({ type: 'sheet.opened', sheet: 'edit-set' });
  }

  function saveEditedSet() {
    if (!editingSet) return;

    const parsedReps = Number.parseInt(editInputs.reps, 10);
    const parsedWeight = Number.parseFloat(editInputs.weight);

    if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
      Alert.alert('Invalid reps', 'Enter a valid rep count.');
      return;
    }

    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) {
      Alert.alert('Invalid weight', 'Enter a valid weight.');
      return;
    }

    updateLocalWorkoutSet(editingSet.local_id, parsedReps, parsedWeight);
    setEditingSet(null);
    setEditInputs(DEFAULT_EDIT_INPUTS);
    dispatch({ type: 'sheet.closed' });
    refreshSets();
    queueWorkoutSync('editing a set');
  }

  function deleteEditingSet() {
    if (!editingSet) return;

    const setLocalId = editingSet.local_id;
    deleteLocalWorkoutSet(setLocalId);
    setEditingSet(null);
    setEditInputs(DEFAULT_EDIT_INPUTS);
    dispatch({ type: 'sheet.closed' });
    refreshSets();
    queueWorkoutSync('deleting a set');
  }

  function completeWorkout() {
    if (!sessionId || !session) return;

    const exerciseNamesById = Object.fromEntries(
      Array.from(exerciseSetMap.keys()).map((exerciseId) => [
        exerciseId,
        resolveExercise(exerciseId)?.name ?? 'This exercise',
      ])
    );
    const progressionReasonText = getWorkoutCompletionProgressionReasonText(
      sessionId,
      { effortFeedback, exerciseNamesById }
    );
    const completionMessage = ['Workout saved locally.', progressionReasonText]
      .filter(Boolean)
      .join('\n\n');

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeLocalWorkoutSession(sessionId);
    void syncPendingWorkoutSessions().catch((error) => {
      console.warn('Failed to sync completed workout session.', error);
    });

    Alert.alert('Workout complete', completionMessage);
    router.replace('/workouts');
  }

  function closeSheet() {
    setEditingSet(null);
    dispatch({ type: 'sheet.closed' });
  }

  if (sessionLoadState.status !== 'ready' || !session) {
    return { status: sessionLoadState.status, sessionLoadState } as const;
  }

  const controller: LiveWorkoutController = {
    session,
    exercises,
    selectedExercises,
    selectedExercise,
    selectedExerciseSets,
    sets,
    elapsedSeconds,
    restSeconds: uiState.restSeconds,
    savedNotice: uiState.savedNotice,
    activeSheet: uiState.activeSheet,
    currentSetDraft,
    lastSet,
    recentSets,
    targetInputs,
    effortFeedback,
    editingSet,
    editInputs,
    hasDirtyActiveDraft: Boolean(selectedExercise && activeDraft.dirty),
    exerciseProgressLabel: (exercise) =>
      formatExerciseProgressLabel(
        exercise,
        exerciseSetMap.get(exercise.id) ?? [],
        smartDefaultsByExerciseId[exercise.id]
      ),
    chooseExercise,
    selectExerciseForLogging,
    openExercisePicker: () => dispatch({ type: 'sheet.opened', sheet: 'exercise-picker' }),
    openTargetSheet: () => dispatch({ type: 'sheet.opened', sheet: 'targets' }),
    openInstructionsSheet: () => dispatch({ type: 'sheet.opened', sheet: 'instructions' }),
    openFinishSheet: () => dispatch({ type: 'sheet.opened', sheet: 'finish' }),
    closeSheet,
    updateSelectedDraft,
    adjustReps: (delta) => adjustReps(delta),
    adjustWeight: (delta) => adjustWeight(delta),
    addSet,
    skipRest: () => dispatch({ type: 'rest.skipped' }),
    updateTargetInput: (key, value) => {
      setTargetInputs((current) => ({ ...current, [key]: value }));
    },
    saveSelectedExerciseTarget,
    setEffortFeedback: setEffortFeedbackState,
    openEditSheet,
    updateEditInput: (key, value) => {
      setEditInputs((current) => ({ ...current, [key]: value }));
    },
    saveEditedSet,
    deleteEditingSet,
    completeWorkout,
  };

  return { status: 'ready', controller } as const;
}
