import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
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
  addLocalWorkoutSet,
  completeLocalWorkoutSession,
  deleteLocalWorkoutSet,
  getLocalWorkoutSession,
  getLocalWorkoutSets,
  syncPendingWorkoutSessions,
  updateLocalWorkoutSet,
} from '@/src/features/workouts/workout-service';
import type { LocalWorkoutSet } from '@/src/lib/local-db';
import type { Exercise } from '@/src/types/models';

type LocalWorkoutSetRow = ReturnType<typeof getLocalWorkoutSets>[number];

const REST_DURATION_SECONDS = 90;

function buildExerciseSetMap(sets: LocalWorkoutSetRow[]) {
  return sets.reduce((map, set) => {
    const exerciseSets = map.get(set.exercise_id) ?? [];
    map.set(set.exercise_id, [...exerciseSets, set]);
    return map;
  }, new Map<string, LocalWorkoutSetRow[]>());
}

export default function LiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercises = useMemo(() => getSeededExercises(), []);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('135');
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

  // Inline editing state
  const [editingSet, setEditingSet] = useState<LocalWorkoutSet | null>(null);
  const [editReps, setEditReps] = useState('');
  const [editWeight, setEditWeight] = useState('');

  const sessionId = useMemo(() => {
    if (Array.isArray(id)) return id[0];
    return id;
  }, [id]);

  const session = useMemo(
    () => (sessionId ? getLocalWorkoutSession(sessionId) : null),
    [sessionId]
  );

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
    if (!sessionId) return;

    const nextSets = getLocalWorkoutSets(sessionId);
    const nextMap = buildExerciseSetMap(nextSets);

    setSets(nextSets);
    setExerciseSetMap(nextMap);

    const exercisesFromLoggedSets = Array.from(nextMap.keys())
      .map((exerciseId) => resolveExercise(exerciseId))
      .filter((exercise): exercise is Exercise => Boolean(exercise));

    if (exercisesFromLoggedSets.length > 0) {
      setSelectedExercises((current) => {
        const existingIds = new Set(current.map((exercise) => exercise.id));
        const missingExercises = exercisesFromLoggedSets.filter(
          (exercise) => !existingIds.has(exercise.id)
        );

        return missingExercises.length > 0
          ? [...current, ...missingExercises]
          : current;
      });
    }
  }

  useEffect(() => {
    refreshSets();
  }, [sessionId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

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

  const bestEstimatedMax = useMemo(() => {
    const estimates = sets
      .filter((set) => Number(set.weight) > 0 && Number(set.reps) > 0)
      .map((set) => estimatedOneRepMax(Number(set.weight), Number(set.reps)));

    return estimates.length > 0 ? Math.max(...estimates) : null;
  }, [sets]);

  function chooseExercise(exercise: Exercise) {
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
  }

  function queueWorkoutSync(reason: string) {
    void syncPendingWorkoutSessions().catch((error) => {
      console.warn(`Failed to sync workout after ${reason}.`, error);
    });
  }

  function addSet() {
    if (!sessionId || !selectedExercise) return;

    const parsedReps = Number.parseInt(reps, 10);
    const parsedWeight = Number.parseFloat(weight);

    if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
      Alert.alert('Invalid reps', 'Enter a valid rep count.');
      return;
    }

    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) {
      Alert.alert('Invalid weight', 'Enter a valid weight.');
      return;
    }

    addLocalWorkoutSet({
      sessionLocalId: sessionId,
      exerciseId: selectedExercise.id,
      setNumber: selectedExerciseSets.length + 1,
      reps: parsedReps,
      weight: parsedWeight,
    });

    refreshSets();
    queueWorkoutSync('adding a set');
    setRestSeconds(REST_DURATION_SECONDS);
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

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeLocalWorkoutSession(sessionId);
    void syncPendingWorkoutSessions().catch((error) => {
      console.warn('Failed to sync completed workout session.', error);
    });

    Alert.alert('Workout complete', 'The workout was saved locally.');
    router.replace('/workouts');
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
              <View style={{ flex: 1 }}>
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
                LOG SET
              </Text>
              <Text style={{ fontSize: 24, fontWeight: '900' }}>
                {selectedExercise?.name ?? 'Choose an exercise'}
              </Text>
              {selectedExerciseMetadata ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {selectedExerciseMetadata.split(' â€¢ ').map((item) => (
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

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', marginBottom: 6 }}>Reps</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={reps}
                  onChangeText={setReps}
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1 }}>
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

            <View style={{ flexDirection: 'row', gap: 10 }}>
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
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 22, fontWeight: '900' }}>
                        {exercise.name}
                      </Text>
                      <Text style={{ color: '#64748b', lineHeight: 21, marginTop: 4 }}>
                        {[exercise.muscleGroup, exercise.equipment, exercise.difficulty]
                          .filter(Boolean)
                          .join(' • ')}
                      </Text>
                    </View>
                    <Pressable onPress={() => setSelectedExercise(exercise)}>
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
                </View>
              </Card>
            );
          })
        )}

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
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', marginBottom: 6 }}>Reps</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={editReps}
                  onChangeText={setEditReps}
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1 }}>
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderRadius: 14,
        borderWidth: 1,
        flex: 1,
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
