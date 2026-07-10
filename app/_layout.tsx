import '../global.css';

import { Inter_400Regular, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { SpaceGrotesk_700Bold, useFonts } from '@expo-google-fonts/space-grotesk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthSessionContext, type AuthProfile, type AuthStatus } from '@/src/features/auth/auth-session-context';
import { LOCAL_DEV_PROFILE, LOCAL_DEV_SESSION } from '@/src/features/auth/dev-auth';
import { syncPendingNutritionLogs } from '@/src/features/nutrition/nutrition-service';
import { syncPendingBodyMeasurements } from '@/src/features/progress/body-measurements-service';
import { syncPendingWellnessCheckIns } from '@/src/features/wellness/wellness-service';
import { syncPendingWorkoutSessions } from '@/src/features/workouts/workout-service';
import { initializeLocalDb } from '@/src/lib/local-db';
import { USE_DEV_AUTH } from '@/src/lib/runtime-flags';
import { supabase } from '@/src/lib/supabase';
import { ThemeProvider } from '@/src/lib/theme-context';

const queryClient = new QueryClient();

void SplashScreen.preventAutoHideAsync();

async function syncPendingRecords() {
  await Promise.all([
    syncPendingWorkoutSessions().catch((error) => {
      console.warn('Failed to sync pending workout sessions.', error);
    }),
    syncPendingNutritionLogs().catch((error) => {
      console.warn('Failed to sync pending nutrition logs.', error);
    }),
    syncPendingWellnessCheckIns().catch((error) => {
      console.warn('Failed to sync pending wellness check-ins.', error);
    }),
    syncPendingBodyMeasurements().catch((error) => {
      console.warn('Failed to sync pending body measurements.', error);
    }),
  ]);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_700Bold,
    Inter_900Black,
  });
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const sessionRef = useRef<Session | null>(null);
  const profileRequestRef = useRef(0);

  const loadLocalDevSession = useCallback(() => {
    sessionRef.current = LOCAL_DEV_SESSION;
    setSession(LOCAL_DEV_SESSION);
    setProfile(LOCAL_DEV_PROFILE);
    setStatus('onboarded');
  }, []);

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
    if (USE_DEV_AUTH) {
      loadLocalDevSession();
      return;
    }

    await loadProfile(sessionRef.current);
  }, [loadLocalDevSession, loadProfile]);

  useEffect(() => {
    initializeLocalDb();

    const subscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          if (USE_DEV_AUTH || sessionRef.current?.user) {
            void syncPendingRecords();
          }
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    void syncPendingRecords();
  }, [session?.user.id]);

  useEffect(() => {
    if (USE_DEV_AUTH) {
      loadLocalDevSession();
      return;
    }

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
  }, [loadLocalDevSession, loadProfile]);

  const authContextValue = useMemo(
    () => ({ session, profile, status, refreshProfile }),
    [profile, refreshProfile, session, status]
  );

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthSessionContext.Provider value={authContextValue}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="reset-password" options={{ headerShown: false }} />
              <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="workout/exercises"
                options={{
                  title: 'Exercise Browser',
                  headerStyle: { backgroundColor: '#0d1117' },
                  headerTintColor: '#a3e635',
                  headerTitleStyle: {
                    color: '#e6edf3',
                    fontFamily: 'SpaceGrotesk_700Bold',
                  },
                  headerShadowVisible: false,
                }}
              />
              <Stack.Screen
                name="workout/session/[id]"
                options={{
                  title: 'Live Workout',
                  headerStyle: { backgroundColor: '#0d1117' },
                  headerTintColor: '#a3e635',
                  headerTitleStyle: {
                    color: '#e6edf3',
                    fontFamily: 'SpaceGrotesk_700Bold',
                  },
                  headerShadowVisible: false,
                }}
              />
              <Stack.Screen
                name="workout/history/[id]"
                options={{
                  title: 'Workout History',
                  headerStyle: { backgroundColor: '#0d1117' },
                  headerTintColor: '#a3e635',
                  headerTitleStyle: {
                    color: '#e6edf3',
                    fontFamily: 'SpaceGrotesk_700Bold',
                  },
                  headerShadowVisible: false,
                }}
              />
            </Stack>
          </AuthSessionContext.Provider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
