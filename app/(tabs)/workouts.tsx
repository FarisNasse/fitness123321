import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { WeekStrip } from '@/src/components/WeekStrip';
import { WorkoutHistoryCard } from '@/src/components/WorkoutHistoryCard';
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
  const [recentSessionsError, setRecentSessionsError] = useState<string | null>(null);
  const [isLoadingRecentSessions, setIsLoadingRecentSessions] = useState(true);
  const [syncingSessionIds, setSyncingSessionIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const refreshRecentSessions = useCallback(() => {
    setIsLoadingRecentSessions(true);
    setRecentSessionsError(null);

    try {
      setRecentSessions(getCompletedWorkoutSessions(4));
    } catch (error) {
      setRecentSessions([]);
      setRecentSessionsError(
        error instanceof Error ? error.message : 'Workout history could not be read.'
      );
    } finally {
      setIsLoadingRecentSessions(false);
    }
  }, []);

  const setsLoggedCount = recentSessions.reduce(
    (total, session) => total + getLocalWorkoutSets(session.local_id).length,
    0
  );

  function browseExercises() {
    router.push('/workout/exercises');
  }

  const retryWorkoutSync = useCallback(async (sessionLocalId?: string) => {
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
  }, [refreshRecentSessions]);

  useFocusEffect(
    useCallback(() => {
      refreshRecentSessions();

      if (USE_REMOTE_WORKOUT_SYNC) {
        void retryWorkoutSync();
      }
    }, [refreshRecentSessions, retryWorkoutSync])
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
          <View className="gap-2">
            <Text className="text-4xl font-display text-base-content">Train</Text>
            <Text className="text-sm font-body leading-6 text-base-muted">
              Start a workout, log your sets, and review what you completed.
            </Text>
          </View>

          <WeekStrip />

          <View className="flex-row flex-wrap gap-3">
            <MiniStat label="Recent sessions" value={String(recentSessions.length)} />
            <MiniStat label="Sets logged" value={String(setsLoggedCount)} />
          </View>
        </View>

        <Card variant="highlighted" className="gap-4">
          <Text className="text-2xl font-black text-base-content">Quick actions</Text>
          <View className="gap-3">
            <Button title="Start workout" onPress={startWorkout} size="lg" />
            <Button
              title="Browse exercises"
              onPress={browseExercises}
              size="lg"
              variant="outline"
            />
            {recentSessions.length > 0 ? (
              <Button
                title="Repeat Last Workout"
                onPress={repeatLastWorkout}
                size="lg"
                variant="outline"
              />
            ) : null}
          </View>
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

          {recentSessionsError ? (
            <ErrorState
              title="Could not load workout history"
              message="Your workout history could not be read. Try refreshing before starting a new workout."
              detail={recentSessionsError}
              onRetry={refreshRecentSessions}
            />
          ) : isLoadingRecentSessions ? (
            <LoadingState message="Loading recent workouts…" />
          ) : recentSessions.length === 0 ? (
            <EmptyState
              title="No completed workouts yet"
              message="Start one above. Completed sessions will show here when you finish them."
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


function LoadingState({ message }: { message: string }) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderRadius: 16,
        borderWidth: 1,
        gap: 10,
        padding: 18,
      }}
    >
      <ActivityIndicator />
      <Text style={{ color: '#64748b', fontWeight: '800' }}>{message}</Text>
    </View>
  );
}

function ErrorState({
  title,
  message,
  detail,
  onRetry,
}: {
  title: string;
  message: string;
  detail?: string | null;
  onRetry: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
        borderRadius: 16,
        borderWidth: 1,
        gap: 10,
        padding: 16,
      }}
    >
      <Text style={{ color: '#991b1b', fontSize: 16, fontWeight: '900' }}>
        {title}
      </Text>
      <Text style={{ color: '#64748b', lineHeight: 21 }}>{message}</Text>
      {detail ? (
        <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 18 }}>
          {detail}
        </Text>
      ) : null}
      <Pressable onPress={onRetry} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Text style={{ color: '#0f172a', fontWeight: '900' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-1 rounded-card border border-base-300 bg-base-200 p-3"
      style={{ minWidth: 96 }}
    >
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
