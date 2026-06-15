import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { initializeLocalDb } from '@/src/lib/local-db';

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    initializeLocalDb();
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
