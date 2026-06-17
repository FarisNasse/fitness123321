import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import {
  getExerciseById,
  getSeededExercises,
} from '@/src/features/workouts/exercise-service';
import {
  getLocalWorkoutSession,
  getLocalWorkoutSets,
} from '@/src/features/workouts/workout-service';
import type { Exercise } from '@/src/types/models';

export default function WorkoutHistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercises = useMemo(() => getSeededExercises(), []);
  const exerciseLookup = useMemo(
    () =>
      Object.fromEntries(
        exercises.map((exercise) => [exercise.id, exercise])
      ) as Record<string, Exercise>,
    [exercises]
  );

  const sessionId = useMemo(() => {
    if (Array.isArray(id)) return id[0];
    return id;
  }, [id]);

  const session = useMemo(
    () => (sessionId ? getLocalWorkoutSession(sessionId) : null),
    [sessionId]
  );
  const sets = useMemo(
    () => (sessionId ? getLocalWorkoutSets(sessionId) : []),
    [sessionId]
  );

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

  if (!session) {
    return (
      <Screen>
        <Card>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: '900' }}>Workout not found</Text>
            <Text style={{ color: '#64748b', lineHeight: 21 }}>
              This local workout session is not available on this device.
            </Text>
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 18 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 34, fontWeight: '900' }}>{session.name}</Text>
          <Text style={{ color: '#64748b', lineHeight: 21 }}>
            {formatDateTime(session.started_at)} / {formatDuration(session.duration_seconds)} /{' '}
            {sets.length} set{sets.length === 1 ? '' : 's'}
          </Text>
        </View>

        <Card>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatBox label="Duration" value={formatDuration(session.duration_seconds)} />
            <StatBox label="Total sets" value={String(sets.length)} />
          </View>
        </Card>

        <Card>
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '900' }}>Exercises</Text>
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
                <Text style={{ fontWeight: '900' }}>No sets logged</Text>
                <Text style={{ color: '#64748b', marginTop: 6 }}>
                  This completed workout does not have any saved sets.
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
                          {set.reps ?? 0} reps x {set.weight ?? 0} lb
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        </Card>
      </View>
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

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds) {
    return 'Under 1 min';
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}
