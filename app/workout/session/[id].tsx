import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
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
  getLocalWorkoutSession,
  getLocalWorkoutSets,
  syncPendingWorkoutSessions,
} from '@/src/features/workouts/workout-service';
import type { Exercise } from '@/src/types/models';

export default function LiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercises = useMemo(() => getSeededExercises(), []);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    exercises[0] ?? null
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('135');
  const [sets, setSets] = useState<ReturnType<typeof getLocalWorkoutSets>>([]);
  const [exerciseLookup, setExerciseLookup] = useState<Record<string, Exercise>>(
    () =>
      Object.fromEntries(
        exercises.map((exercise) => [exercise.id, exercise])
      ) as Record<string, Exercise>
  );

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

  function refreshSets() {
    if (!sessionId) return;
    setSets(getLocalWorkoutSets(sessionId));
  }

  useEffect(() => {
    refreshSets();
  }, [sessionId]);

  const selectedExerciseSets = useMemo(() => {
    if (!selectedExercise) return [];
    return sets.filter((set) => set.exercise_id === selectedExercise.id);
  }, [selectedExercise, sets]);

  const groupedSets = useMemo(() => {
    return sets.reduce(
      (groups, set) => {
        const exercise = exerciseLookup[set.exercise_id] ?? getExerciseById(set.exercise_id);
        const key = set.exercise_id;

        if (!groups[key]) {
          groups[key] = {
            exerciseName: exercise?.name ?? 'Unknown exercise',
            sets: [],
          };
        }

        groups[key].sets.push(set);
        return groups;
      },
      {} as Record<
        string,
        { exerciseName: string; sets: ReturnType<typeof getLocalWorkoutSets> }
      >
    );
  }, [exerciseLookup, sets]);

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
    setSelectedExercise(exercise);
    setIsPickerOpen(false);
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
  }

  function finishWorkout() {
    if (!sessionId) return;

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
          <Text style={{ color: '#64748b', lineHeight: 21 }}>
            {session?.name ?? 'Quick workout'} • {sets.length} set
            {sets.length === 1 ? '' : 's'} logged
            {bestEstimatedMax ? ` • best est. 1RM ${Math.round(bestEstimatedMax)} lb` : ''}
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
                  CURRENT EXERCISE
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '900', marginTop: 4 }}>
                  {selectedExercise?.name ?? 'Choose exercise'}
                </Text>
                {selectedExerciseMetadata ? (
                  <Text style={{ color: '#64748b', marginTop: 6 }}>
                    {selectedExerciseMetadata}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => setIsPickerOpen(true)}>
                <Text style={{ color: '#0f172a', fontWeight: '900' }}>Change</Text>
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

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatBox label="This exercise" value={String(selectedExerciseSets.length)} />
              <StatBox label="Total sets" value={String(sets.length)} />
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '900' }}>Logged sets</Text>
            {sets.length === 0 ? (
              <View
                style={{
                  backgroundColor: '#f8fafc',
                  borderColor: '#e2e8f0',
                  borderRadius: 16,
                  borderWidth: 1,
                  padding: 16,
                }}
              >
                <Text style={{ fontWeight: '900' }}>No sets yet</Text>
                <Text style={{ color: '#64748b', marginTop: 6 }}>
                  Pick an exercise, enter reps/weight, then add your first set.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {Object.entries(groupedSets).map(([exerciseId, group]) => (
                  <View key={exerciseId} style={{ gap: 8 }}>
                    <Text style={{ color: '#0f172a', fontWeight: '900' }}>
                      {group.exerciseName}
                    </Text>
                    {group.sets.map((set) => (
                      <View
                        key={set.local_id}
                        style={{
                          alignItems: 'center',
                          backgroundColor: '#f8fafc',
                          borderColor: '#e2e8f0',
                          borderRadius: 14,
                          borderWidth: 1,
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          padding: 12,
                        }}
                      >
                        <Text style={{ fontWeight: '900' }}>Set {set.set_number}</Text>
                        <Text style={{ color: '#475569', fontWeight: '800' }}>
                          {set.reps ?? 0} reps × {set.weight ?? 0} lb
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        </Card>

        <Button title="Finish workout" onPress={finishWorkout} />
      </View>

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
