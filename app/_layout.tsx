import '../global.css';

import { Inter_400Regular, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { SpaceGrotesk_700Bold, useFonts } from '@expo-google-fonts/space-grotesk';
import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppErrorBoundary } from '@/src/components/AppErrorBoundary';
import { RuntimeStatusBanner } from '@/src/components/RuntimeStatusBanner';
import { AuthSessionContext, type AuthProfile, type AuthStatus } from '@/src/features/auth/auth-session-context';
import { LOCAL_DEV_PROFILE, LOCAL_DEV_SESSION } from '@/src/features/auth/dev-auth';
import { reportError } from '@/src/lib/error-reporting';
import { initializeLocalDb } from '@/src/lib/local-db';
import { NetworkStateProvider } from '@/src/lib/network-state';
import { USE_DEV_AUTH } from '@/src/lib/runtime-flags';
import { supabase } from '@/src/lib/supabase';
import { SyncStateProvider } from '@/src/lib/sync-state';
import { ThemeProvider } from '@/src/lib/theme-context';

const queryClient = new QueryClient();

void SplashScreen.preventAutoHideAsync();

function RootRuntime() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_700Bold,
    Inter_900Black,
  });
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);
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
      reportError(error, {
        source: 'root-runtime',
        operation: 'load-auth-profile',
        domain: 'auth',
      });
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
    try {
      initializeLocalDb();
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('Local database initialization failed.');
      reportError(normalized, {
        source: 'root-runtime',
        operation: 'initialize-local-database',
        domain: 'storage',
      });
      setRuntimeError(normalized);
    }
  }, []);

  useEffect(() => {
    if (USE_DEV_AUTH) {
      loadLocalDevSession();
      return;
    }

    let isSubscribed = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isSubscribed) return;

      if (error) {
        reportError(error, {
          source: 'root-runtime',
          operation: 'resolve-auth-session',
          domain: 'auth',
        });
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
    queryClient.clear();
  }, [session?.user.id]);

  useEffect(() => {
    if (fontError) {
      reportError(fontError, {
        source: 'root-runtime',
        operation: 'load-brand-fonts',
        domain: 'ui',
      });
    }
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (runtimeError) {
    throw runtimeError;
  }

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <NetworkStateProvider>
            <AuthSessionContext.Provider value={authContextValue}>
              <SyncStateProvider
                canSync={USE_DEV_AUTH || Boolean(session?.user)}
                ownerId={session?.user.id ?? null}
              >
                <View className="flex-1 bg-base-100">
                  <RuntimeStatusBanner />
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
                </View>
              </SyncStateProvider>
            </AuthSessionContext.Provider>
          </NetworkStateProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootLayout() {
  return (
    <AppErrorBoundary>
      <RootRuntime />
    </AppErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
