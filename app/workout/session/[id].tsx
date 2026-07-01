import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { Screen } from '@/src/components/Screen';
import { colors } from '@/src/lib/theme';
import { ExerciseLibrary } from '@/src/features/workouts/ExerciseLibrary';
import {
  getExerciseById,
  getSeededExercises,
  rememberExercises,
} from '@/src/features/workouts/exercise-service';
import { estimatedOneRepMax } from '@/src/features/workouts/pr-service';
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
import type { ProgressionEffortFeedback } from '@/src/features/workouts/progression-service';
import type { LocalWorkoutSet } from '@/src/lib/local-db';
import type { Exercise } from '@/src/types/models';

type LocalWorkoutSetRow = ReturnType<typeof getLocalWorkoutSets>[number];
type WorkoutSessionForScreen = NonNullable<ReturnType<typeof getLocalWorkoutSession>>;
type SessionLoadState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string; detail?: string };

const REST_DURATION_SECONDS = 90;
const REP_STEP = 1;
const WEIGHT_STEP = 5;
const FALLBACK_WEIGHT_INCREMENT = WEIGHT_STEP;

type SetDraft = {
  reps: string;
  weight: string;
};

type DraftsByExerciseId = Record<string, SetDraft>;

const DEFAULT_SET_DRAFT: SetDraft = { reps: '8', weight: '0' };

function buildExerciseSetMap(sets: LocalWorkoutSetRow[]) {
  return sets.reduce((map, set) => {
    const exerciseSets = map.get(set.exercise_id) ?? [];
    map.set(set.exercise_id, [...exerciseSets, set]);
    return map;
  }, new Map<string, LocalWorkoutSetRow[]>());
}

function rgba(red: number, green: number, blue: number, alpha: number) {
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function formatWeightInput(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1).replace(/\.0$/, '');
}

function formatRepRange(min: number, max: number) {
  return min === max ? String(min) : `${min}-${max}`;
}

function getSmartSourceLabel(source?: SmartExerciseDefaults['source']) {
  switch (source) {
    case 'history':
      return 'Recent history';
    case 'target':
      return 'Saved target';
    case 'fallback':
      return 'Starter default';
    default:
      return 'Starter default';
  }
}

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
  };
}

function buildDraftFromLastSet(set: LocalWorkoutSetRow): SetDraft {
  return {
    reps: String(set.reps ?? DEFAULT_SET_DRAFT.reps),
    weight: formatWeightInput(Number(set.weight ?? DEFAULT_SET_DRAFT.weight)),
  };
}

function buildLogSetButtonLabel(setNumber: number, draft: SetDraft) {
  const reps = draft.reps.trim();
  const weight = draft.weight.trim();
  const parsedWeight = Number.parseFloat(weight);
  const repsLabel = reps ? `${reps} reps` : 'reps';

  if (weight && Number.isFinite(parsedWeight) && parsedWeight > 0) {
    return `Log set ${setNumber} — ${repsLabel} @ ${formatWeightInput(parsedWeight)} lb`;
  }

  return `Log set ${setNumber} — ${repsLabel}`;
}

function formatTargetSummary(defaults: SmartExerciseDefaults | null) {
  if (!defaults) {
    return 'Target 3 sets · 8-12 reps · 5 lb jumps';
  }

  return `Target ${defaults.targetSets} sets · ${formatRepRange(
    defaults.repMin,
    defaults.repMax
  )} reps · ${formatWeightInput(defaults.incrementSize)} lb jumps`;
}

function formatCollapsedExerciseStatus(
  exerciseSets: LocalWorkoutSetRow[],
  defaults: SmartExerciseDefaults | undefined
) {
  if (exerciseSets.length === 0) {
    return 'Not started · tap to begin';
  }

  const lastSet = exerciseSets[exerciseSets.length - 1];
  const nextSetNumber = exerciseSets.length + 1;
  const targetSuffix = defaults
    ? ` · target ${formatRepRange(defaults.repMin, defaults.repMax)} reps`
    : '';

  return `${exerciseSets.length} set${
    exerciseSets.length === 1 ? '' : 's'
  } · last ${lastSet.reps ?? 0} × ${lastSet.weight ?? 0} lb · next set ${nextSetNumber}${targetSuffix}`;
}


export default function LiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercises = useMemo(() => getSeededExercises(), []);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isTargetSheetOpen, setIsTargetSheetOpen] = useState(false);
  const [draftsByExerciseId, setDraftsByExerciseId] = useState<DraftsByExerciseId>({});
  const [sets, setSets] = useState<ReturnType<typeof getLocalWorkoutSets>>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
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
  const [targetSetsInput, setTargetSetsInput] = useState('3');
  const [repMinInput, setRepMinInput] = useState('8');
  const [repMaxInput, setRepMaxInput] = useState('12');
  const [incrementSizeInput, setIncrementSizeInput] = useState('5');
  const [deloadPercentageInput, setDeloadPercentageInput] = useState('10');
  const [effortFeedback, setEffortFeedback] = useState<ProgressionEffortFeedback | null>(null);

  // Inline editing state
  const [editingSet, setEditingSet] = useState<LocalWorkoutSet | null>(null);
  const [editReps, setEditReps] = useState('');
  const [editWeight, setEditWeight] = useState('');

  const sessionId = useMemo(() => {
    if (Array.isArray(id)) return id[0];
    return id;
  }, [id]);

  const [session, setSession] = useState<WorkoutSessionForScreen | null>(null);
  const [sessionLoadState, setSessionLoadState] = useState<SessionLoadState>({
    status: 'loading',
  });

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
          detail: 'This local workout was not found on this device. Start a new workout from the Train tab.',
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
        detail: error instanceof Error ? error.message : 'The local workout database could not be read.',
      });
    }
  }, [sessionId]);

  const selectedExerciseMetadata = useMemo(() => {
    if (!selectedExercise) return '';

    return [
      selectedExercise.muscleGroup,
      selectedExercise.equipment,
      selectedExercise.difficulty,
    ]
      .filter(Boolean)
      .join(' • ');
  }, [selectedExercise]);

  function rememberExerciseSelection(exercise: Exercise) {
    setSelectedExercises((current) => {
      if (current.some((selected) => selected.id === exercise.id)) {
        return current;
      }

      return [...current, exercise];
    });
  }

  function resolveExercise(exerciseId: string) {
    return exerciseLookup[exerciseId] ?? getExerciseById(exerciseId) ?? null;
  }

  function getDraftForExercise(
    exerciseId: string,
    source: DraftsByExerciseId = draftsByExerciseId
  ): SetDraft {
    return source[exerciseId] ?? DEFAULT_SET_DRAFT;
  }

  function updateExerciseDraft(exerciseId: string, patch: Partial<SetDraft>) {
    setDraftsByExerciseId((current) => ({
      ...current,
      [exerciseId]: {
        ...getDraftForExercise(exerciseId, current),
        ...patch,
      },
    }));
  }

  function getInitialDraftForExercise(
    exercise: Exercise,
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

  function ensureDraftForExercise(
    exercise: Exercise,
    defaults?: SmartExerciseDefaults,
    options: { replaceDraft?: boolean } = {}
  ) {
    setDraftsByExerciseId((current) => {
      if (!options.replaceDraft && current[exercise.id]) {
        return current;
      }

      return {
        ...current,
        [exercise.id]: getInitialDraftForExercise(exercise, defaults),
      };
    });
  }

  function setDraftFromSuggestedSet(
    exercise: Exercise,
    defaults: SmartExerciseDefaults,
    currentSetCount: number,
    options: { replaceDraft?: boolean } = {}
  ) {
    const nextDraft = buildDraftFromSuggestedSet(defaults, currentSetCount);

    setDraftsByExerciseId((current) => {
      if (!options.replaceDraft && current[exercise.id]) {
        return current;
      }

      return {
        ...current,
        [exercise.id]: nextDraft,
      };
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

  useEffect(() => {
    if (sessionLoadState.status !== 'ready') return;

    refreshSets();
  }, [sessionId, session?.local_id, sessionLoadState.status]);

  useEffect(() => {
    if (!selectedExercise) {
      return;
    }

    ensureDraftForExercise(
      selectedExercise,
      smartDefaultsByExerciseId[selectedExercise.id]
    );

    if (smartDefaultsByExerciseId[selectedExercise.id]) {
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

    return () => {
      clearInterval(timer);
    };
  }, [sessionLoadState.status]);

  useEffect(() => {
    if (restSeconds === null) return undefined;

    if (restSeconds <= 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRestSeconds(null);
      return undefined;
    }

    const timer = setTimeout(() => {
      setRestSeconds((current) => (current === null ? null : current - 1));
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [restSeconds]);

  const selectedExerciseSets = useMemo(() => {
    if (!selectedExercise) return [];
    return exerciseSetMap.get(selectedExercise.id) ?? [];
  }, [exerciseSetMap, selectedExercise]);

  const selectedExerciseSmartDefaults = selectedExercise
    ? smartDefaultsByExerciseId[selectedExercise.id]
    : null;
  const activeIncrementSize =
    selectedExerciseSmartDefaults?.incrementSize ?? FALLBACK_WEIGHT_INCREMENT;
  const selectedExerciseDraft = selectedExercise
    ? getDraftForExercise(selectedExercise.id)
    : DEFAULT_SET_DRAFT;

  const currentSetDraft = useMemo(
    () => ({
      exerciseName: selectedExercise?.name ?? 'Choose an exercise',
      setNumber: selectedExercise ? selectedExerciseSets.length + 1 : 1,
      suggestedReps: selectedExerciseDraft.reps,
      suggestedWeight: selectedExerciseDraft.weight,
      repRange: selectedExerciseSmartDefaults
        ? formatRepRange(
            selectedExerciseSmartDefaults.repMin,
            selectedExerciseSmartDefaults.repMax
          )
        : '8-12',
      sourceLabel: getSmartSourceLabel(selectedExerciseSmartDefaults?.source),
      targetSummary: formatTargetSummary(selectedExerciseSmartDefaults),
      logButtonLabel: buildLogSetButtonLabel(
        selectedExercise ? selectedExerciseSets.length + 1 : 1,
        selectedExerciseDraft
      ),
    }),
    [
      selectedExercise,
      selectedExerciseDraft.reps,
      selectedExerciseDraft.weight,
      selectedExerciseSets.length,
      selectedExerciseSmartDefaults,
    ]
  );

  const bestEstimatedMax = useMemo(() => {
    const estimates = sets
      .filter((set) => Number(set.weight) > 0 && Number(set.reps) > 0)
      .map((set) => estimatedOneRepMax(Number(set.weight), Number(set.reps)));

    return estimates.length > 0 ? Math.max(...estimates) : null;
  }, [sets]);

  function syncTargetInputs(defaults: SmartExerciseDefaults) {
    setTargetSetsInput(String(defaults.targetSets));
    setRepMinInput(String(defaults.repMin));
    setRepMaxInput(String(defaults.repMax));
    setIncrementSizeInput(formatWeightInput(defaults.incrementSize));
    setDeloadPercentageInput(formatWeightInput(defaults.deloadPercentage));
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
    syncTargetInputs(defaults);
    setDraftFromSuggestedSet(exercise, defaults, currentSetCount, options);
  }

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
    setIsPickerOpen(false);
    await applySmartDefaultsForExercise(
      exercise,
      exerciseSetMap.get(exercise.id)?.length ?? 0
    );
  }

  function queueWorkoutSync(reason: string) {
    void syncPendingWorkoutSessions().catch((error) => {
      console.warn(`Failed to sync workout after ${reason}.`, error);
    });
  }

  function adjustReps(delta: number) {
    if (!selectedExercise) return;

    const draft = getDraftForExercise(selectedExercise.id);
    const currentValue = Number.parseInt(draft.reps, 10);
    const nextValue = Math.max(
      1,
      (Number.isFinite(currentValue) ? currentValue : 0) + delta
    );

    updateExerciseDraft(selectedExercise.id, { reps: String(nextValue) });
  }

  function adjustWeight(delta: number) {
    if (!selectedExercise) return;

    const draft = getDraftForExercise(selectedExercise.id);
    const currentValue = Number.parseFloat(draft.weight);
    const nextValue = Math.max(
      0,
      (Number.isFinite(currentValue) ? currentValue : 0) + delta
    );

    updateExerciseDraft(selectedExercise.id, { weight: formatWeightInput(nextValue) });
  }

  function updateSelectedDraft(patch: Partial<SetDraft>) {
    if (!selectedExercise) return;

    updateExerciseDraft(selectedExercise.id, patch);
  }

  async function saveSelectedExerciseTarget() {
    if (!selectedExercise) return;

    const targetSets = Number.parseInt(targetSetsInput, 10);
    const repMin = Number.parseInt(repMinInput, 10);
    const repMax = Number.parseInt(repMaxInput, 10);
    const incrementSize = Number.parseFloat(incrementSizeInput);
    const deloadPercentage = Number.parseFloat(deloadPercentageInput);

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
      Alert.alert('Invalid rep range', 'Enter a rep max that is greater than or equal to the rep min.');
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
    await applySmartDefaultsForExercise(selectedExercise, selectedExerciseSets.length, { replaceDraft: true });
    setIsTargetSheetOpen(false);
    Alert.alert('Targets saved', 'This exercise will use these defaults next time.');
  }

  function parseSetInputs(exerciseId: string) {
    const draft = getDraftForExercise(exerciseId);
    const parsedReps = Number.parseInt(draft.reps, 10);
    const parsedWeight = Number.parseFloat(draft.weight || '0');

    if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
      Alert.alert('Invalid reps', 'Enter a valid rep count.');
      return null;
    }

    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) {
      Alert.alert('Invalid weight', 'Enter a valid weight.');
      return null;
    }

    return { parsedReps, parsedWeight };
  }

  function logSetForExercise(exercise: Exercise) {
    if (!sessionId) return;
    if (!session) return;

    const parsed = parseSetInputs(exercise.id);

    if (!parsed) return;

    const currentExerciseSets = exerciseSetMap.get(exercise.id) ?? [];

    addLocalWorkoutSet({
      sessionLocalId: sessionId,
      exerciseId: exercise.id,
      setNumber: currentExerciseSets.length + 1,
      reps: parsed.parsedReps,
      weight: parsed.parsedWeight,
    });

    setSelectedExercise(exercise);
    refreshSets();
    queueWorkoutSync('adding a set');
    setRestSeconds(REST_DURATION_SECONDS);
    void applySmartDefaultsForExercise(exercise, currentExerciseSets.length + 1, { replaceDraft: true });
  }

  function addSet() {
    if (!selectedExercise) return;

    logSetForExercise(selectedExercise);
  }


  function openEditModal(set: LocalWorkoutSet) {
    setEditingSet(set);
    setEditReps(String(set.reps ?? ''));
    setEditWeight(String(set.weight ?? ''));
  }

  function saveEditedSet() {
    if (!editingSet) return;

    const parsedReps = Number.parseInt(editReps, 10);
    const parsedWeight = Number.parseFloat(editWeight);

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
    refreshSets();
    queueWorkoutSync('editing a set');
  }

  function confirmDeleteSet(setLocalId: string) {
    Alert.alert('Remove set', 'Delete this set?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteLocalWorkoutSet(setLocalId);
          refreshSets();
          queueWorkoutSync('deleting a set');
        },
      },
    ]);
  }

  function finishWorkout() {
    if (!sessionId) return;
    if (!session) return;

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
    const completionMessage = [
      'The workout was saved locally.',
      progressionReasonText,
    ]
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

  if (sessionLoadState.status === 'loading') {
    return (
      <Screen>
        <Card>
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
            <ActivityIndicator />
            <Text style={{ color: colors.baseMuted, fontWeight: '800' }}>
              Loading workout session…
            </Text>
          </View>
        </Card>
      </Screen>
    );
  }

  if (sessionLoadState.status === 'error') {
    return (
      <Screen>
        <Card>
          <EmptyState
            title={sessionLoadState.message}
            message={sessionLoadState.detail ?? 'Start a new local workout from the Train tab.'}
            action={
              <Button
                title="Back to workouts"
                onPress={() => router.replace('/workouts')}
                variant="outline"
              />
            }
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 16, paddingBottom: 104 }}>
        <Card>
          <View style={{ gap: 14 }}>
            <View>
              <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900' }}>
                LIVE WORKOUT
              </Text>
              <Text style={{ color: colors.baseContent, fontSize: 30, fontWeight: '900', marginTop: 4 }}>
                {session?.name ?? 'Quick workout'}
              </Text>
              <Text style={{ color: colors.baseMuted, lineHeight: 21, marginTop: 4 }}>
                Pick an exercise, edit the next set, log it, then move to the next exercise.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <WorkoutStatusPill label="Elapsed" value={formatClock(elapsedSeconds)} />
              <WorkoutStatusPill
                label="Rest"
                value={restSeconds !== null ? formatClock(restSeconds).slice(3) : 'Ready'}
              />
              <WorkoutStatusPill label="Sets" value={String(sets.length)} />
              {bestEstimatedMax ? (
                <WorkoutStatusPill label="Best 1RM" value={`${Math.round(bestEstimatedMax)} lb`} />
              ) : null}
            </View>

            {restSeconds !== null ? (
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: rgba(163, 230, 53, 0.12),
                  borderColor: rgba(163, 230, 53, 0.22),
                  borderRadius: 18,
                  borderWidth: 1,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  padding: 14,
                }}
              >
                <Text style={{ color: colors.baseContent, fontSize: 18, fontWeight: '900' }}>
                  Rest {formatClock(restSeconds).slice(3)}
                </Text>
                <Pressable
                  onPress={() => setRestSeconds(null)}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? colors.base300 : colors.base100,
                    borderColor: colors.base300,
                    borderRadius: 12,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  })}
                >
                  <Text style={{ color: colors.primary, fontWeight: '900' }}>Skip</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </Card>

        {selectedExercise ? (
          <Card variant="highlighted">
            <View style={{ gap: 18 }}>
              <View style={{ gap: 12 }}>
                <View
                  style={{
                    alignItems: 'flex-start',
                    flexDirection: 'row',
                    gap: 12,
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1, minWidth: 96 }}>
                    <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900' }}>
                      ACTIVE EXERCISE
                    </Text>
                    <Text style={{ color: colors.baseContent, fontSize: 30, fontWeight: '900', marginTop: 4 }}>
                      {currentSetDraft.exerciseName}
                    </Text>
                    <Text style={{ color: colors.baseMuted, fontWeight: '800', lineHeight: 21, marginTop: 6 }}>
                      {currentSetDraft.targetSummary}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setIsTargetSheetOpen(true)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? colors.base300 : colors.base100,
                      borderColor: colors.base300,
                      borderRadius: 14,
                      borderWidth: 1,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    })}
                  >
                    <Text style={{ color: colors.baseContent, fontWeight: '900' }}>Edit targets</Text>
                  </Pressable>
                </View>

                {selectedExerciseMetadata ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {selectedExerciseMetadata.split(' • ').map((item) => (
                      <Badge key={item} label={item} variant="neutral" />
                    ))}
                  </View>
                ) : null}
              </View>

              <View
                style={{
                  backgroundColor: colors.base100,
                  borderColor: colors.base300,
                  borderRadius: 24,
                  borderWidth: 1,
                  gap: 18,
                  padding: 18,
                }}
              >
                <View
                  style={{
                    alignItems: 'flex-start',
                    flexDirection: 'row',
                    gap: 12,
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1, minWidth: 96 }}>
                    <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900' }}>
                      NEXT SET
                    </Text>
                    <Text style={{ color: colors.baseContent, fontSize: 34, fontWeight: '900', marginTop: 4 }}>
                      Set {currentSetDraft.setNumber}
                    </Text>
                    <Text style={{ color: colors.baseMuted, lineHeight: 21, marginTop: 4 }}>
                      {currentSetDraft.sourceLabel} • target {currentSetDraft.repRange} reps •{' '}
                      {formatWeightInput(activeIncrementSize)} lb jumps
                    </Text>
                  </View>
                  <Badge label="Ready" variant="primary" />
                </View>

                <SetDraftEditor
                  reps={currentSetDraft.suggestedReps}
                  weight={currentSetDraft.suggestedWeight}
                  incrementSize={activeIncrementSize}
                  onRepsChange={(value) => updateSelectedDraft({ reps: value })}
                  onWeightChange={(value) => updateSelectedDraft({ weight: value })}
                  onRepsDown={() => adjustReps(-REP_STEP)}
                  onRepsUp={() => adjustReps(REP_STEP)}
                  onWeightDown={() => adjustWeight(-activeIncrementSize)}
                  onWeightUp={() => adjustWeight(activeIncrementSize)}
                />

                <Pressable
                  disabled={!selectedExercise}
                  onPress={addSet}
                  style={({ pressed }) => ({
                    alignItems: 'center',
                    backgroundColor: selectedExercise ? colors.primary : colors.baseMuted,
                    borderRadius: 20,
                    opacity: pressed ? 0.82 : 1,
                    paddingVertical: 20,
                  })}
                >
                  <Text style={{ color: colors.primaryContent, fontSize: 21, fontWeight: '900' }}>
                    {currentSetDraft.logButtonLabel}
                  </Text>
                  <Text style={{ color: colors.primaryContent, fontWeight: '800', marginTop: 4 }}>
                    Save this set and start rest timer
                  </Text>
                </Pressable>
              </View>

              <View style={{ gap: 10 }}>
                <View
                  style={{
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ color: colors.baseContent, fontSize: 20, fontWeight: '900' }}>
                    Logged sets
                  </Text>
                  <Badge
                    label={`${selectedExerciseSets.length} set${selectedExerciseSets.length === 1 ? '' : 's'}`}
                    variant="neutral"
                  />
                </View>

                {selectedExerciseSets.length === 0 ? (
                  <View
                    style={{
                      backgroundColor: colors.base100,
                      borderColor: colors.base300,
                      borderRadius: 16,
                      borderWidth: 1,
                      padding: 14,
                    }}
                  >
                    <Text style={{ color: colors.baseMuted, fontWeight: '800' }}>
                      No sets yet. Enter your reps and weight, then log set {currentSetDraft.setNumber}.
                    </Text>
                  </View>
                ) : (
                  <LoggedSetList
                    sets={selectedExerciseSets}
                    onEdit={openEditModal}
                    onDelete={confirmDeleteSet}
                  />
                )}
              </View>

              {selectedExercise.instructions ? (
                <Pressable
                  onPress={() => Alert.alert(selectedExercise.name, selectedExercise.instructions ?? '')}
                  style={({ pressed }) => ({
                    alignItems: 'center',
                    backgroundColor: pressed ? colors.base300 : colors.base100,
                    borderColor: colors.base300,
                    borderRadius: 16,
                    borderWidth: 1,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    padding: 14,
                  })}
                >
                  <Text style={{ color: colors.baseContent, fontWeight: '900' }}>View instructions</Text>
                  <Text style={{ color: colors.primary, fontWeight: '900' }}>Open</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        ) : (
          <Card>
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900' }}>
                ACTIVE EXERCISE
              </Text>
              <Text style={{ color: colors.baseContent, fontSize: 24, fontWeight: '900' }}>
                Add an exercise to start logging
              </Text>
              <Text style={{ color: colors.baseMuted, lineHeight: 21 }}>
                Use the + Exercise action below. Once an exercise is active, its reps, weight, and logged sets stay together in one card.
              </Text>
            </View>
          </Card>
        )}

        <Card>
          <View style={{ gap: 14 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900' }}>
                OTHER EXERCISES
              </Text>
              <Text style={{ color: colors.baseContent, fontSize: 22, fontWeight: '900' }}>
                {selectedExercises.length === 0
                  ? 'No exercises added'
                  : `${selectedExercises.length} exercise${selectedExercises.length === 1 ? '' : 's'} in workout`}
              </Text>
            </View>

            {selectedExercises.length === 0 ? (
              <Text style={{ color: colors.baseMuted, lineHeight: 21 }}>
                Add an exercise to start logging this workout.
              </Text>
            ) : selectedExercises.filter((exercise) => exercise.id !== selectedExercise?.id).length === 0 ? (
              <Text style={{ color: colors.baseMuted, lineHeight: 21 }}>
                No other exercises yet. Add another movement when you are ready to switch.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {selectedExercises
                  .filter((exercise) => exercise.id !== selectedExercise?.id)
                  .map((exercise) => {
                    const exerciseSets = exerciseSetMap.get(exercise.id) ?? [];
                    const defaults = smartDefaultsByExerciseId[exercise.id];

                    return (
                      <CollapsedExerciseRow
                        key={exercise.id}
                        exercise={exercise}
                        status={formatCollapsedExerciseStatus(exerciseSets, defaults)}
                        onPress={() => void selectExerciseForLogging(exercise)}
                      />
                    );
                  })}
              </View>
            )}
          </View>
        </Card>

        {sets.length > 0 ? (
          <Card>
            <View style={{ gap: 12 }}>
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors.baseContent, fontSize: 18, fontWeight: '900' }}>
                  Workout feedback (optional)
                </Text>
                <Text style={{ color: colors.baseMuted, lineHeight: 21 }}>
                  Add this when you finish or when the whole workout feels clearly easy, good, or maximal.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {(['easy', 'good', 'max'] as const).map((feedback) => {
                  const selected = effortFeedback === feedback;
                  const label = feedback === 'easy' ? 'Easy' : feedback === 'good' ? 'Good' : 'Max';

                  return (
                    <Pressable
                      key={feedback}
                      onPress={() => setEffortFeedback(selected ? null : feedback)}
                      style={{
                        alignItems: 'center',
                        backgroundColor: selected ? colors.primary : colors.base100,
                        borderColor: selected ? colors.primary : colors.base300,
                        borderRadius: 14,
                        borderWidth: 1,
                        flex: 1,
                        padding: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? colors.primaryContent : colors.baseContent,
                          fontWeight: '900',
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Card>
        ) : null}

        <Card>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              title="+ Exercise"
              onPress={() => setIsPickerOpen(true)}
              variant="outline"
              className="flex-1"
            />
            <Button title="Finish workout" onPress={finishWorkout} className="flex-1" />
          </View>
        </Card>
      </View>

      {/* Exercise picker modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setIsPickerOpen(false)}
        transparent
        visible={isPickerOpen}
      >
        <Pressable
          onPress={() => setIsPickerOpen(false)}
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            flex: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="rounded-t-card border border-base-300 bg-base-200 p-4 pb-8"
            style={pickerSheetStyle}
          >
            <ExerciseLibrary
              onSelect={chooseExercise}
              selectButtonTitle="Use this exercise"
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Optional target settings modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setIsTargetSheetOpen(false)}
        transparent
        visible={isTargetSheetOpen && Boolean(selectedExercise)}
      >
        <Pressable
          onPress={() => setIsTargetSheetOpen(false)}
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            flex: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: colors.base200,
              borderColor: colors.base300,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderWidth: 1,
              gap: 18,
              padding: 24,
              paddingBottom: 36,
            }}
          >
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900' }}>
                OPTIONAL TARGETS
              </Text>
              <Text style={{ color: colors.baseContent, fontSize: 22, fontWeight: '900' }}>
                {selectedExercise?.name ?? 'Exercise'} targets
              </Text>
              <Text style={{ color: colors.baseMuted, lineHeight: 20 }}>
                Configure custom set counts, rep ranges, weight jumps, or deloads. Logging still works without changing these.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <TargetInput
                label="Sets"
                value={targetSetsInput}
                onChangeText={setTargetSetsInput}
              />
              <TargetInput
                label="Rep min"
                value={repMinInput}
                onChangeText={setRepMinInput}
              />
              <TargetInput
                label="Rep max"
                value={repMaxInput}
                onChangeText={setRepMaxInput}
              />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <TargetInput
                label="Increment"
                value={incrementSizeInput}
                onChangeText={setIncrementSizeInput}
              />
              <TargetInput
                label="Deload %"
                value={deloadPercentageInput}
                onChangeText={setDeloadPercentageInput}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button
                title="Cancel"
                onPress={() => setIsTargetSheetOpen(false)}
                variant="outline"
                className="flex-1"
              />
              <Button
                title="Save targets"
                onPress={saveSelectedExerciseTarget}
                className="flex-1"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Inline set-edit modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setEditingSet(null)}
        transparent
        visible={Boolean(editingSet)}
      >
        <Pressable
          onPress={() => setEditingSet(null)}
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            flex: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: colors.base200,
              borderColor: colors.base300,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderWidth: 1,
              gap: 20,
              padding: 24,
              paddingBottom: 36,
            }}
          >
            <Text style={{ color: colors.baseContent, fontSize: 20, fontWeight: '900' }}>
              Edit Set {editingSet?.set_number}
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 96 }}>
                <Text style={{ color: colors.baseContent, fontWeight: '800', marginBottom: 6 }}>Reps</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={editReps}
                  onChangeText={setEditReps}
                  placeholderTextColor={colors.baseMuted}
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1, minWidth: 96 }}>
                <Text style={{ color: colors.baseContent, fontWeight: '800', marginBottom: 6 }}>Weight</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={editWeight}
                  onChangeText={setEditWeight}
                  placeholderTextColor={colors.baseMuted}
                  style={inputStyle}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setEditingSet(null)}
                style={({ pressed }) => ({
                  borderColor: colors.base300,
                  borderRadius: 14,
                  borderWidth: 1,
                  flex: 1,
                  opacity: pressed ? 0.7 : 1,
                  padding: 16,
                  alignItems: 'center',
                })}
              >
                <Text style={{ color: colors.baseContent, fontWeight: '900' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveEditedSet}
                style={({ pressed }) => ({
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  flex: 1,
                  opacity: pressed ? 0.8 : 1,
                  padding: 16,
                  alignItems: 'center',
                })}
              >
                <Text style={{ color: colors.primaryContent, fontWeight: '900' }}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function TargetInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={{ flex: 1, minWidth: 96 }}>
      <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.baseMuted}
        style={inputStyle}
      />
    </View>
  );
}

function SetDraftEditor({
  reps,
  weight,
  incrementSize,
  onRepsChange,
  onWeightChange,
  onRepsDown,
  onRepsUp,
  onWeightDown,
  onWeightUp,
}: {
  reps: string;
  weight: string;
  incrementSize: number;
  onRepsChange: (value: string) => void;
  onWeightChange: (value: string) => void;
  onRepsDown: () => void;
  onRepsUp: () => void;
  onWeightDown: () => void;
  onWeightUp: () => void;
}) {
  return (
    <View style={{ gap: 14 }}>
      <DraftInput
        label="Reps"
        value={reps}
        keyboardType="number-pad"
        decrementLabel="−"
        incrementLabel="+"
        onChangeText={onRepsChange}
        onDecrement={onRepsDown}
        onIncrement={onRepsUp}
      />
      <DraftInput
        label="Weight"
        value={weight}
        keyboardType="decimal-pad"
        decrementLabel={`−${formatWeightInput(incrementSize)}`}
        incrementLabel={`+${formatWeightInput(incrementSize)}`}
        onChangeText={onWeightChange}
        onDecrement={onWeightDown}
        onIncrement={onWeightUp}
      />
    </View>
  );
}

function DraftInput({
  label,
  value,
  keyboardType,
  decrementLabel,
  incrementLabel,
  onChangeText,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: string;
  keyboardType: 'number-pad' | 'decimal-pad';
  decrementLabel: string;
  incrementLabel: string;
  onChangeText: (value: string) => void;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900' }}>
        {label}
      </Text>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
        <StepperButton label={decrementLabel} onPress={onDecrement} />
        <TextInput
          keyboardType={keyboardType}
          value={value}
          onChangeText={onChangeText}
          placeholder="0"
          placeholderTextColor={colors.baseMuted}
          style={draftInputStyle}
        />
        <StepperButton label={incrementLabel} onPress={onIncrement} />
      </View>
    </View>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? colors.base300 : colors.base200,
        borderColor: colors.base300,
        borderRadius: 16,
        borderWidth: 1,
        minWidth: 56,
        paddingVertical: 16,
      })}
    >
      <Text style={{ color: colors.baseContent, fontSize: 18, fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
}

function LoggedSetList({
  sets,
  onEdit,
  onDelete,
}: {
  sets: LocalWorkoutSetRow[];
  onEdit: (set: LocalWorkoutSet) => void;
  onDelete: (setLocalId: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      {sets.map((set) => (
        <Pressable
          key={set.local_id}
          onPress={() => onEdit(set)}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: pressed ? colors.base300 : colors.base100,
            borderColor: colors.base300,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            padding: 12,
          })}
        >
          <Text style={{ color: colors.baseContent, fontWeight: '900', minWidth: 52 }}>
            Set {set.set_number}
          </Text>

          <Text style={{ color: colors.baseMuted, flex: 1, fontWeight: '800' }}>
            {set.reps ?? 0} reps × {set.weight ?? 0} lb
          </Text>

          <Text style={{ color: colors.primary, fontWeight: '900', marginRight: 12 }}>
            Edit
          </Text>

          <Pressable
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              onDelete(set.local_id);
            }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? rgba(248, 113, 113, 0.22) : rgba(248, 113, 113, 0.14),
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 5,
            })}
          >
            <Text style={{ color: colors.error, fontSize: 15, fontWeight: '900' }}>
              ✕
            </Text>
          </Pressable>
        </Pressable>
      ))}
    </View>
  );
}

function CollapsedExerciseRow({
  exercise,
  status,
  onPress,
}: {
  exercise: Exercise;
  status: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? colors.base300 : colors.base100,
        borderColor: colors.base300,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
        padding: 14,
      })}
    >
      <View style={{ flex: 1, minWidth: 96 }}>
        <Text style={{ color: colors.baseContent, fontSize: 17, fontWeight: '900' }}>
          {exercise.name}
        </Text>
        <Text style={{ color: colors.baseMuted, fontWeight: '800', lineHeight: 20, marginTop: 3 }}>
          {status}
        </Text>
      </View>
      <Text style={{ color: colors.primary, fontWeight: '900' }}>Resume exercise</Text>
    </Pressable>
  );
}

function WorkoutStatusPill({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.base100,
        borderColor: colors.base300,
        borderRadius: 16,
        borderWidth: 1,
        flex: 1,
        minWidth: 104,
        padding: 12,
      }}
    >
      <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900' }}>
        {label}
      </Text>
      <Text style={{ color: colors.baseContent, fontSize: 20, fontWeight: '900', marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}


const pickerSheetStyle = {
  backgroundColor: colors.base200,
  borderColor: colors.base300,
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  borderWidth: 1,
  maxHeight: '88%' as const,
  overflow: 'hidden' as const,
  padding: 16,
  paddingBottom: 32,
};

const inputStyle = {
  backgroundColor: colors.base100,
  borderWidth: 1,
  borderColor: colors.base300,
  color: colors.baseContent,
  borderRadius: 14,
  fontSize: 18,
  fontWeight: '800' as const,
  padding: 14,
};

const draftInputStyle = {
  ...inputStyle,
  flex: 1,
  fontSize: 24,
  textAlign: 'center' as const,
};

function formatClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}
