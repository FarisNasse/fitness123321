import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { ExerciseLibrary } from '@/src/features/workouts/ExerciseLibrary';
import {
  createLocalWorkoutSession,
  getCompletedWorkoutSessions,
  getLocalWorkoutSets,
  getWorkoutOwnerUserId,
  type LocalWorkoutSessionRow,
} from '@/src/features/workouts/workout-service';
import { USE_REMOTE_WORKOUT_SYNC } from '@/src/lib/runtime-flags';

export default function WorkoutsScreen() {
  const [recentSessions, setRecentSessions] = useState<LocalWorkoutSessionRow[]>([]);

  function refreshRecentSessions() {
    setRecentSessions(getCompletedWorkoutSessions(4));
  }

  useFocusEffect(
    useCallback(() => {
      refreshRecentSessions();
    }, [])
  );

  const completedCount = useMemo(
    () => recentSessions.filter((session) => Boolean(session.completed_at)).length,
    [recentSessions]
  );

  async function startWorkout() {
    try {
      const userId = await getWorkoutOwnerUserId();
      const sessionId = createLocalWorkoutSession(userId, 'Quick workout');
      refreshRecentSessions();
      router.push(`/workout/session/${sessionId}`);
    } catch (error) {
      Alert.alert(
        'Could not start workout',
        error instanceof Error ? error.message : 'Try signing in again.'
      );
    }
  }

  return (
    <Screen>
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
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 34, fontWeight: '900' }}>Workouts</Text>
              <Text style={{ marginTop: 8, color: '#64748b', lineHeight: 21 }}>
                Start a local workout, pick exercises, log sets, and finish the
                session without needing Supabase setup.
              </Text>
            </View>
            <StatusPill
              label={USE_REMOTE_WORKOUT_SYNC ? 'Cloud sync on' : 'Local mode'}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <MiniStat label="Sessions" value={String(recentSessions.length)} />
            <MiniStat label="Completed" value={String(completedCount)} />
            <MiniStat label="Sync" value={USE_REMOTE_WORKOUT_SYNC ? 'On' : 'Off'} />
          </View>
        </View>

        <Card>
          <View style={{ gap: 14 }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '900' }}>Quick start</Text>
              <Text style={{ color: '#64748b', marginTop: 6, lineHeight: 21 }}>
                This is now a terminal-testable vertical slice: press start, add
                real exercises, log sets, finish, and see local data persist.
              </Text>
            </View>
            <Button title="Start workout" onPress={startWorkout} />
          </View>
        </Card>

        <Card>
          <ExerciseLibrary scrollMode="page" />
        </Card>

        <Card>
          <View style={{ gap: 12 }}>
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '900' }}>Recent workouts</Text>
              <Pressable onPress={refreshRecentSessions}>
                <Text style={{ color: '#0f172a', fontWeight: '900' }}>Refresh</Text>
              </Pressable>
            </View>

            {recentSessions.length === 0 ? (
              <View
                style={{
                  backgroundColor: '#f8fafc',
                  borderColor: '#e2e8f0',
                  borderRadius: 16,
                  borderWidth: 1,
                  padding: 16,
                }}
              >
                <Text style={{ fontWeight: '900' }}>No completed workouts yet</Text>
                <Text style={{ color: '#64748b', marginTop: 6, lineHeight: 20 }}>
                  Start one above. Completed sessions will show here without a
                  remote database.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {recentSessions.map((session) => {
                  const setCount = getLocalWorkoutSets(session.local_id).length;

                  return (
                    <Pressable
                      key={session.local_id}
                      onPress={() => router.push(`/workout/history/${session.local_id}`)}
                      style={{
                        backgroundColor: '#f8fafc',
                        borderColor: '#e2e8f0',
                        borderRadius: 16,
                        borderWidth: 1,
                        padding: 14,
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
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '900' }}>{session.name}</Text>
                          <Text style={{ color: '#64748b', marginTop: 4 }}>
                            {formatDateTime(session.started_at)}
                          </Text>
                        </View>
                        <StatusPill label="Finished" />
                      </View>
                      <Text style={{ color: '#475569', fontWeight: '800', marginTop: 10 }}>
                        {formatDuration(session.duration_seconds)} / {setCount} set
                        {setCount === 1 ? '' : 's'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderRadius: 16,
        borderWidth: 1,
        flex: 1,
        padding: 12,
      }}
    >
      <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '800' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: '900', marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <View
      style={{
        backgroundColor: '#ecfeff',
        borderColor: '#a5f3fc',
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: '#155e75', fontSize: 12, fontWeight: '900' }}>
        {label}
      </Text>
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
