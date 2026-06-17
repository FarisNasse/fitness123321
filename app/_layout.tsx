import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { AuthSessionContext, type AuthProfile, type AuthStatus } from '@/src/features/auth/auth-session-context';
import { syncPendingNutritionLogs } from '@/src/features/nutrition/nutrition-service';
import { syncPendingWorkoutSessions } from '@/src/features/workouts/workout-service';
import { initializeLocalDb } from '@/src/lib/local-db';
import { supabase } from '@/src/lib/supabase';

const queryClient = new QueryClient();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const sessionRef = useRef<Session | null>(null);
  const profileRequestRef = useRef(0);

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    const requestId = profileRequestRef.current + 1;
    profileRequestRef.current = requestId;
    sessionRef.current = nextSession;
    setSession(nextSession);

    if (!nextSession?.user) {
      setProfile(null);
      setStatus('signed-out');
      return;
    }

    setStatus('loading');

    const { data, error } = await supabase
      .from('profiles')
      .select('id, primary_goal')
      .eq('id', nextSession.user.id)
      .maybeSingle();

    if (profileRequestRef.current !== requestId) {
      return;
    }

    if (error) {
      console.warn('Failed to load auth profile.', error);
    }

    const nextProfile = (data ?? null) as AuthProfile | null;
    setProfile(nextProfile);
    setStatus(nextProfile?.primary_goal ? 'onboarded' : 'needs-onboarding');
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(sessionRef.current);
  }, [loadProfile]);

  useEffect(() => {
    initializeLocalDb();

    void syncPendingWorkoutSessions().catch((error) => {
      console.warn('Failed to sync pending workout sessions.', error);
    });

    void syncPendingNutritionLogs().catch((error) => {
      console.warn('Failed to sync pending nutrition logs.', error);
    });

    const subscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          void syncPendingWorkoutSessions().catch((error) => {
            console.warn('Failed to sync pending workout sessions.', error);
          });

          void syncPendingNutritionLogs().catch((error) => {
            console.warn('Failed to sync pending nutrition logs.', error);
          });
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isSubscribed) return;

      if (error) {
        console.warn('Failed to resolve auth session.', error);
      }

      void loadProfile(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isSubscribed) return;
      setTimeout(() => {
        if (isSubscribed) {
          void loadProfile(nextSession);
        }
      }, 0);
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const authContextValue = useMemo(
    () => ({ session, profile, status, refreshProfile }),
    [profile, refreshProfile, session, status]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionContext.Provider value={authContextValue}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="workout/session/[id]"
            options={{ title: 'Live Workout' }}
          />
          <Stack.Screen
            name="workout/history/[id]"
            options={{ title: 'Workout History' }}
          />
        </Stack>
      </AuthSessionContext.Provider>
    </QueryClientProvider>
  );
}
