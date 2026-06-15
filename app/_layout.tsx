import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { syncPendingWorkoutSessions } from '@/src/features/workouts/workout-service';
import { initializeLocalDb } from '@/src/lib/local-db';

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    initializeLocalDb();

    void syncPendingWorkoutSessions().catch((error) => {
      console.warn('Failed to sync pending workout sessions.', error);
    });

    const subscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          void syncPendingWorkoutSessions().catch((error) => {
            console.warn('Failed to sync pending workout sessions.', error);
          });
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="workout/session/[id]"
          options={{ title: 'Live Workout' }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
