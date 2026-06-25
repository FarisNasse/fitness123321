import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { WeekStrip } from '@/src/components/WeekStrip';
import { WorkoutHistoryCard } from '@/src/components/WorkoutHistoryCard';
import { ExerciseLibrary } from '@/src/features/workouts/ExerciseLibrary';
import {
  createLocalWorkoutSession,
  getCompletedWorkoutSessions,
  getLocalWorkoutSets,
  getWorkoutOwnerUserId,
  getWorkoutSyncStatusLabel,
  repeatLastCompletedWorkout,
  getWorkoutSyncUiStatus,
  syncPendingWorkoutSessions,
  type LocalWorkoutSessionRow,
  type WorkoutSyncUiStatus,
} from '@/src/features/workouts/workout-service';
import { USE_REMOTE_WORKOUT_SYNC } from '@/src/lib/runtime-flags';

export default function WorkoutsScreen() {
  const [recentSessions, setRecentSessions] = useState<LocalWorkoutSessionRow[]>([]);
  const [syncingSessionIds, setSyncingSessionIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  function refreshRecentSessions() {
    setRecentSessions(getCompletedWorkoutSessions(4));
  }

  useFocusEffect(
    useCallback(() => {
      refreshRecentSessions();

      if (USE_REMOTE_WORKOUT_SYNC) {
        void retryWorkoutSync();
      }
    }, [])
  );

  const completedCount = useMemo(
    () => recentSessions.filter((session) => Boolean(session.completed_at)).length,
    [recentSessions]
  );

  async function retryWorkoutSync(sessionLocalId?: string) {
    if (!USE_REMOTE_WORKOUT_SYNC) return;

    if (sessionLocalId) {
      setSyncingSessionIds((current) => new Set(current).add(sessionLocalId));
    } else {
      setIsSyncingAll(true);
    }

    try {
      await syncPendingWorkoutSessions();
    } catch (error) {
      console.warn('Manual workout sync retry failed.', error);
    } finally {
      if (sessionLocalId) {
        setSyncingSessionIds((current) => {
          const next = new Set(current);
          next.delete(sessionLocalId);
          return next;
        });
      } else {
        setIsSyncingAll(false);
      }
      refreshRecentSessions();
    }
  }

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

  async function repeatLastWorkout() {
    try {
      const userId = await getWorkoutOwnerUserId();
      const repeatedWorkout = repeatLastCompletedWorkout(userId);

      if (!repeatedWorkout) {
        Alert.alert(
          'No completed workout yet',
          'Finish a workout once, then Repeat Last Workout can preload those exercises.'
        );
        return;
      }

      refreshRecentSessions();
      router.push(`/workout/session/${repeatedWorkout.sessionLocalId}`);
    } catch (error) {
      Alert.alert(
        'Could not repeat workout',
        error instanceof Error ? error.message : 'Try signing in again.'
      );
    }
  }

  return (
    <Screen>
      <View className="gap-5">
        <View className="gap-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-2">
              <Text className="text-4xl font-display text-base-content">Train</Text>
              <Text className="text-sm font-body leading-6 text-base-muted">
                Start a local workout, pick real exercises, log sets, and finish
                without needing Supabase setup.
              </Text>
            </View>
            <Badge
              label={USE_REMOTE_WORKOUT_SYNC ? 'Cloud sync on' : 'Local mode'}
              variant={USE_REMOTE_WORKOUT_SYNC ? 'info' : 'primary'}
            />
          </View>

          <WeekStrip />

          <View className="flex-row gap-3">
            <MiniStat label="Sessions" value={String(recentSessions.length)} />
            <MiniStat label="Completed" value={String(completedCount)} />
            <MiniStat label="Sync" value={USE_REMOTE_WORKOUT_SYNC ? 'On' : 'Off'} />
          </View>
        </View>

        <Card variant="highlighted" className="gap-4">
          <View className="gap-2">
            <Text className="text-2xl font-black text-base-content">Quick start</Text>
            <Text className="text-sm font-body leading-6 text-base-muted">
              Press start, add exercises, log sets, finish, and see local data persist.
            </Text>
          </View>
          <View className="gap-3">
            <Button title="Start workout" onPress={startWorkout} size="lg" />
            {recentSessions.length > 0 ? (
              <Button
                title="Repeat Last Workout"
                onPress={repeatLastWorkout}
                size="lg"
                variant="outline"
              />
            ) : (
              <EmptyState
                title="Nothing to repeat yet"
                message="Finish a workout once, then Repeat Last Workout will open a new session with those exercises already loaded."
              />
            )}
          </View>
        </Card>

        <Card className="gap-4">
          <ExerciseLibrary scrollMode="page" />
        </Card>

        <Card className="gap-4">
          <SectionHeader
            title="Recent workouts"
            action={
              <Pressable onPress={refreshRecentSessions}>
                <Text className="text-sm font-bold text-primary">Refresh</Text>
              </Pressable>
            }
          />

          {recentSessions.length === 0 ? (
            <EmptyState
              title="No completed workouts yet"
              message="Start one above. Completed sessions will show here without a remote database."
            />
          ) : (
            <View className="gap-3">
              {recentSessions.map((session) => {
                const setCount = getLocalWorkoutSets(session.local_id).length;
                const syncUiStatus = getWorkoutSyncUiStatus(
                  session,
                  isSyncingAll || syncingSessionIds.has(session.local_id)
                );

                return (
                  <WorkoutHistoryCard
                    key={session.local_id}
                    name={session.name}
                    startedAt={formatDateTime(session.started_at)}
                    durationLabel={formatDuration(session.duration_seconds)}
                    setCount={setCount}
                    syncStatusLabel={getWorkoutSyncStatusLabel(syncUiStatus)}
                    syncStatusVariant={getSyncStatusBadgeVariant(syncUiStatus)}
                    onRetrySync={
                      syncUiStatus === 'failed'
                        ? () => retryWorkoutSync(session.local_id)
                        : undefined
                    }
                    retrying={syncingSessionIds.has(session.local_id)}
                    onPress={() => router.push(`/workout/history/${session.local_id}`)}
                  />
                );
              })}
            </View>
          )}
        </Card>
      </View>
    </Screen>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-card border border-base-300 bg-base-200 p-3">
      <Text className="text-xs font-bold uppercase tracking-widest text-base-muted">
        {label}
      </Text>
      <Text className="mt-1 text-xl font-black text-base-content">{value}</Text>
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

function getSyncStatusBadgeVariant(status: WorkoutSyncUiStatus) {
  switch (status) {
    case 'pending':
      return 'warning' as const;
    case 'syncing':
      return 'info' as const;
    case 'synced':
      return 'success' as const;
    case 'failed':
      return 'error' as const;
  }
}
