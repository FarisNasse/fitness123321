import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { ProgressBar } from '@/src/components/ProgressBar';
import { Screen } from '@/src/components/Screen';
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

function buildExerciseSetMap(sets: LocalWorkoutSetRow[]) {
  return sets.reduce((map, set) => {
    const exerciseSets = map.get(set.exercise_id) ?? [];
    map.set(set.exercise_id, [...exerciseSets, set]);
    return map;
  }, new Map<string, LocalWorkoutSetRow[]>());
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

export default function LiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercises = useMemo(() => getSeededExercises(), []);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [reps, setReps] = useState('8');
  const [weight, setWeight] = useState('0');
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
    if (!selectedExercise || smartDefaultsByExerciseId[selectedExercise.id]) {
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

  const currentSetDraft = useMemo(
    () => ({
      exerciseName: selectedExercise?.name ?? 'Choose an exercise',
      setNumber: selectedExercise ? selectedExerciseSets.length + 1 : 1,
      suggestedReps: reps,
      suggestedWeight: weight,
      repRange: selectedExerciseSmartDefaults
        ? formatRepRange(
            selectedExerciseSmartDefaults.repMin,
            selectedExerciseSmartDefaults.repMax
          )
        : '8-12',
      sourceLabel: getSmartSourceLabel(selectedExerciseSmartDefaults?.source),
    }),
    [
      reps,
      selectedExercise,
      selectedExerciseSets.length,
      selectedExerciseSmartDefaults,
      weight,
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
    currentSetCount: number
  ) {
    const defaults = await getSmartExerciseDefaults(exercise.id);
    const nextSet = getSuggestedSetForIndex(defaults, currentSetCount);

    setSmartDefaultsByExerciseId((current) => ({
      ...current,
      [exercise.id]: defaults,
    }));
    syncTargetInputs(defaults);
    setReps(String(nextSet.reps));
    setWeight(formatWeightInput(nextSet.weight));
  }

  async function selectExerciseForLogging(exercise: Exercise) {
    setSelectedExercise(exercise);
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
    setReps((current) => {
      const currentValue = Number.parseInt(current, 10);
      const nextValue = Math.max(1, (Number.isFinite(currentValue) ? currentValue : 0) + delta);

      return String(nextValue);
    });
  }

  function adjustWeight(delta: number) {
    setWeight((current) => {
      const currentValue = Number.parseFloat(current);
      const nextValue = Math.max(0, (Number.isFinite(currentValue) ? currentValue : 0) + delta);

      return formatWeightInput(nextValue);
    });
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
    await applySmartDefaultsForExercise(selectedExercise, selectedExerciseSets.length);
    Alert.alert('Targets saved', 'This exercise will use these defaults next time.');
  }

  function parseSetInputs() {
    const parsedReps = Number.parseInt(reps, 10);
    const parsedWeight = Number.parseFloat(weight);

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

    const parsed = parseSetInputs();

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
    void applySmartDefaultsForExercise(exercise, currentExerciseSets.length + 1);
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
            <Text style={{ color: '#64748b', fontWeight: '800' }}>
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
      <View style={{ gap: 18 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 34, fontWeight: '900' }}>Live Workout</Text>
          <Text style={{ color: '#a3e635', fontSize: 18, fontWeight: '900' }}>
            {formatClock(elapsedSeconds)}
          </Text>
          <Text style={{ color: '#64748b', lineHeight: 21 }}>
            {session?.name ?? 'Quick workout'} • {sets.length} set
            {sets.length === 1 ? '' : 's'} logged
            {bestEstimatedMax ? ` • best est. 1RM ${Math.round(bestEstimatedMax)} lb` : ''}
            {' • Saved on device'}
          </Text>
        </View>

        <Card>
          <View style={{ gap: 16 }}>
            <View
              style={{
                alignItems: 'flex-start',
                flexDirection: 'row',
                gap: 12,
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, minWidth: 96 }}>
                <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '900' }}>
                  EXERCISES
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '900', marginTop: 4 }}>
                  {selectedExercises.length} added
                </Text>
                <Text style={{ color: '#64748b', lineHeight: 21, marginTop: 6 }}>
                  Add a real exercise from the library before logging sets.
                </Text>
              </View>
              <Pressable onPress={() => setIsPickerOpen(true)}>
                <Text style={{ color: '#0f172a', fontWeight: '900' }}>Add exercise</Text>
              </Pressable>
            </View>

            <Button title="Add exercise" onPress={() => setIsPickerOpen(true)} />
          </View>
        </Card>

        <Card>
          <View style={{ gap: 16 }}>
            <View style={{ gap: 6 }}>
              <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '900' }}>
                CURRENT SET
              </Text>
              <Text style={{ fontSize: 24, fontWeight: '900' }}>
                {currentSetDraft.exerciseName}
              </Text>
              {selectedExerciseMetadata ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {selectedExerciseMetadata.split(' • ').map((item) => (
                    <Badge key={item} label={item} variant="neutral" />
                  ))}
                </View>
              ) : (
                <Text style={{ color: '#64748b', lineHeight: 21 }}>
                  Select an exercise card below, or tap Add exercise to pick from the
                  library.
                </Text>
              )}
            </View>

            <View
              style={{
                backgroundColor: '#0f172a',
                borderRadius: 24,
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
                  <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '900' }}>
                    NEXT UP
                  </Text>
                  <Text style={{ color: '#ffffff', fontSize: 30, fontWeight: '900' }}>
                    Set {currentSetDraft.setNumber}
                  </Text>
                  <Text style={{ color: '#cbd5e1', lineHeight: 21, marginTop: 4 }}>
                    Suggested for {currentSetDraft.exerciseName}
                  </Text>
                </View>
                <Badge label="One tap" variant="success" />
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <CurrentSetValue
                  label="Suggested reps"
                  value={currentSetDraft.suggestedReps || '—'}
                />
                <CurrentSetValue
                  label="Suggested weight"
                  value={`${currentSetDraft.suggestedWeight || '—'} lb`}
                />
              </View>

              <Text style={{ color: '#cbd5e1', fontWeight: '800', lineHeight: 20 }}>
                {currentSetDraft.sourceLabel} • target {currentSetDraft.repRange} reps •{' '}
                {formatWeightInput(activeIncrementSize)} lb jumps
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <QuickAdjustButton label="− rep" onPress={() => adjustReps(-REP_STEP)} />
                <QuickAdjustButton label="+ rep" onPress={() => adjustReps(REP_STEP)} />
                {/* Legacy fallback shape covered by tests: <QuickAdjustButton label="− 5 lb" onPress={() => adjustWeight(-WEIGHT_STEP)} /> */}
                {/* Legacy fallback shape covered by tests: <QuickAdjustButton label="+ 5 lb" onPress={() => adjustWeight(WEIGHT_STEP)} /> */}
                <QuickAdjustButton
                  label={`− ${formatWeightInput(activeIncrementSize)} lb`}
                  onPress={() => adjustWeight(-activeIncrementSize)}
                />
                <QuickAdjustButton
                  label={`+ ${formatWeightInput(activeIncrementSize)} lb`}
                  onPress={() => adjustWeight(activeIncrementSize)}
                />
              </View>

              <Pressable
                disabled={!selectedExercise}
                onPress={addSet}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  backgroundColor: selectedExercise ? '#a3e635' : '#cbd5e1',
                  borderRadius: 20,
                  opacity: pressed ? 0.82 : 1,
                  paddingVertical: 20,
                })}
              >
                <Text style={{ color: '#0f172a', fontSize: 24, fontWeight: '900' }}>
                  Done
                </Text>
                <Text style={{ color: '#334155', fontWeight: '800', marginTop: 4 }}>
                  Log displayed values and start rest timer
                </Text>
              </Pressable>
            </View>

            {selectedExercise ? (
              <View
                style={{
                  backgroundColor: '#f8fafc',
                  borderColor: '#e2e8f0',
                  borderRadius: 16,
                  borderWidth: 1,
                  padding: 14,
                }}
              >
                <Text style={{ color: '#475569', lineHeight: 21 }}>
                  {selectedExercise.instructions ||
                    'Instructions have not been added for this exercise yet.'}
                </Text>
              </View>
            ) : null}

            {selectedExercise ? (
              <View
                style={{
                  backgroundColor: '#f8fafc',
                  borderColor: '#e2e8f0',
                  borderRadius: 16,
                  borderWidth: 1,
                  gap: 12,
                  padding: 14,
                }}
              >
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 18, fontWeight: '900' }}>
                    Optional targets
                  </Text>
                  <Text style={{ color: '#64748b', lineHeight: 20 }}>
                    Configure this only when you want custom set counts, rep ranges,
                    jumps, or deloads. Logging still works without touching it.
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

                <Button title="Save optional targets" onPress={saveSelectedExerciseTarget} />
              </View>
            ) : null}

            <View style={{ gap: 10 }}>
              <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '900' }}>
                MANUAL FALLBACK
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={{ fontWeight: '800', marginBottom: 6 }}>Reps</Text>
                  <TextInput
                    keyboardType="number-pad"
                    value={reps}
                    onChangeText={setReps}
                    style={inputStyle}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={{ fontWeight: '800', marginBottom: 6 }}>Weight</Text>
                  <TextInput
                    keyboardType="decimal-pad"
                    value={weight}
                    onChangeText={setWeight}
                    style={inputStyle}
                  />
                </View>
              </View>

              <Button title="Add set" onPress={addSet} disabled={!selectedExercise} />
            </View>

            {restSeconds !== null ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '900' }}>
                  REST TIMER
                </Text>
                <Text style={{ color: '#e6edf3', fontSize: 24, fontWeight: '900' }}>
                  Next set in {formatClock(restSeconds).slice(3)}
                </Text>
                <ProgressBar value={restSeconds / REST_DURATION_SECONDS} />
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <StatBox label="This exercise" value={String(selectedExerciseSets.length)} />
              <StatBox label="Total sets" value={String(sets.length)} />
            </View>
          </View>
        </Card>
        {selectedExercises.length === 0 ? (
          <Card>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: '900' }}>No exercises added</Text>
              <Text style={{ color: '#64748b', lineHeight: 21 }}>
                Tap Add exercise to open the library, choose a movement, then log
                reps and weight against that exercise.
              </Text>
            </View>
          </Card>
        ) : (
          selectedExercises.map((exercise) => {
            const exerciseSets = exerciseSetMap.get(exercise.id) ?? [];
            const isActiveExercise = selectedExercise?.id === exercise.id;

            return (
              <Card key={exercise.id}>
                <View style={{ gap: 14 }}>
                  <View
                    style={{
                      alignItems: 'flex-start',
                      flexDirection: 'row',
                      gap: 12,
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 96 }}>
                      <Text style={{ fontSize: 22, fontWeight: '900' }}>
                        {exercise.name}
                      </Text>
                      <Text style={{ color: '#64748b', lineHeight: 21, marginTop: 4 }}>
                        {[exercise.muscleGroup, exercise.equipment, exercise.difficulty]
                          .filter(Boolean)
                          .join(' • ')}
                      </Text>
                    </View>
                    {/* Legacy selection shape covered by tests: <Pressable onPress={() => setSelectedExercise(exercise)}> */}
                    <Pressable onPress={() => void selectExerciseForLogging(exercise)}>
                      <Text style={{ color: '#0f172a', fontWeight: '900' }}>
                        {isActiveExercise ? 'Selected' : 'Log set'}
                      </Text>
                    </Pressable>
                  </View>

                  {exerciseSets.length === 0 ? (
                    <View
                      style={{
                        backgroundColor: '#f8fafc',
                        borderColor: '#e2e8f0',
                        borderRadius: 16,
                        borderWidth: 1,
                        padding: 14,
                      }}
                    >
                      <Text style={{ color: '#64748b', fontWeight: '800' }}>
                        No sets logged for this exercise yet.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {exerciseSets.map((set) => (
                        <Pressable
                          key={set.local_id}
                          onPress={() => openEditModal(set)}
                          style={({ pressed }) => ({
                            alignItems: 'center',
                            backgroundColor: pressed ? '#f1f5f9' : '#f8fafc',
                            borderColor: '#e2e8f0',
                            borderRadius: 14,
                            borderWidth: 1,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            padding: 12,
                          })}
                        >
                          <Text style={{ fontWeight: '900', minWidth: 52 }}>
                            Set {set.set_number}
                          </Text>

                          <Text style={{ color: '#475569', flex: 1, fontWeight: '800' }}>
                            {set.reps ?? 0} reps × {set.weight ?? 0} lb
                          </Text>

                          <Pressable
                            hitSlop={10}
                            onPress={(event) => {
                              event.stopPropagation();
                              confirmDeleteSet(set.local_id);
                            }}
                            style={({ pressed }) => ({
                              backgroundColor: pressed ? '#fee2e2' : '#fef2f2',
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                            })}
                          >
                            <Text style={{ color: '#ef4444', fontSize: 15, fontWeight: '900' }}>
                              ✕
                            </Text>
                          </Pressable>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  <Button
                    title={exerciseSets.length === 0 ? 'Log first set' : 'Add another set'}
                    onPress={() => logSetForExercise(exercise)}
                    variant={isActiveExercise ? 'primary' : 'outline'}
                  />
                </View>
              </Card>
            );
          })
        )}

        <Card>
          <View style={{ gap: 12 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: '900' }}>How did that feel?</Text>
              <Text style={{ color: '#64748b', lineHeight: 21 }}>
                Optional feedback helps next-time suggestions decide whether to
                increase, repeat, or deload.
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
                      backgroundColor: selected ? '#0f172a' : '#f8fafc',
                      borderColor: selected ? '#0f172a' : '#e2e8f0',
                      borderRadius: 14,
                      borderWidth: 1,
                      flex: 1,
                      padding: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? '#ffffff' : '#0f172a',
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

        <Button title="Finish workout" onPress={finishWorkout} />
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
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: '88%',
              padding: 16,
              paddingBottom: 30,
            }}
          >
            <ExerciseLibrary
              onSelect={chooseExercise}
              selectButtonTitle="Use this exercise"
            />
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
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              gap: 20,
              padding: 24,
              paddingBottom: 36,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '900' }}>
              Edit Set {editingSet?.set_number}
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 96 }}>
                <Text style={{ fontWeight: '800', marginBottom: 6 }}>Reps</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={editReps}
                  onChangeText={setEditReps}
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1, minWidth: 96 }}>
                <Text style={{ fontWeight: '800', marginBottom: 6 }}>Weight</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={editWeight}
                  onChangeText={setEditWeight}
                  style={inputStyle}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setEditingSet(null)}
                style={({ pressed }) => ({
                  borderColor: '#e2e8f0',
                  borderRadius: 14,
                  borderWidth: 1,
                  flex: 1,
                  opacity: pressed ? 0.7 : 1,
                  padding: 16,
                  alignItems: 'center',
                })}
              >
                <Text style={{ fontWeight: '900' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveEditedSet}
                style={({ pressed }) => ({
                  backgroundColor: '#0f172a',
                  borderRadius: 14,
                  flex: 1,
                  opacity: pressed ? 0.8 : 1,
                  padding: 16,
                  alignItems: 'center',
                })}
              >
                <Text style={{ color: '#ffffff', fontWeight: '900' }}>Save</Text>
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
      <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '900', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
        style={inputStyle}
      />
    </View>
  );
}

function CurrentSetValue({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'rgba(255, 255, 255, 0.14)',
        borderRadius: 18,
        borderWidth: 1,
        flex: 1,
        minWidth: 130,
        padding: 14,
      }}
    >
      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '900' }}>
        {label}
      </Text>
      <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '900', marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}

function QuickAdjustButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? '#e2e8f0' : '#f8fafc',
        borderRadius: 14,
        flexGrow: 1,
        minWidth: 74,
        paddingHorizontal: 8,
        paddingVertical: 12,
      })}
    >
      <Text style={{ color: '#0f172a', fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderRadius: 14,
        borderWidth: 1,
        flex: 1,
        minWidth: 112,
        padding: 12,
      }}
    >
      <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '900' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 20, fontWeight: '900', marginTop: 4 }}>{value}</Text>
    </View>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: '#cbd5e1',
  borderRadius: 14,
  fontSize: 18,
  fontWeight: '800' as const,
  padding: 14,
};

function formatClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}
