import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';

export type AuthProfile = {
  id: string;
  primary_goal: string | null;
};

export type AuthStatus = 'loading' | 'signed-out' | 'needs-onboarding' | 'onboarded';

export type AuthSessionContextValue = {
  session: Session | null;
  profile: AuthProfile | null;
  status: AuthStatus;
  refreshProfile: () => Promise<void>;
};

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function useAuthSession() {
  const value = useContext(AuthSessionContext);

  if (!value) {
    throw new Error('useAuthSession must be used inside AuthSessionContext.Provider');
  }

  return value;
}

export function routeForAuthStatus(status: AuthStatus) {
  if (status === 'signed-out') return '/login';
  if (status === 'needs-onboarding') return '/onboarding';
  if (status === 'onboarded') return '/dashboard';

  return null;
}

export function AuthLoadingState({ children }: PropsWithChildren) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        backgroundColor: '#f8fafc',
      }}
    >
      <ActivityIndicator />
      <Text style={{ color: '#64748b', fontWeight: '700' }}>
        {children ?? 'Checking your session...'}
      </Text>
    </View>
  );
}
