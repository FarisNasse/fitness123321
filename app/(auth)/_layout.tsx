import { Redirect, Stack } from 'expo-router';

import { AuthLoadingState, useAuthSession } from '@/src/features/auth/auth-session-context';

export default function AuthLayout() {
  const { status } = useAuthSession();

  if (status === 'loading') {
    return <AuthLoadingState />;
  }

  if (status === 'needs-onboarding') {
    return <Redirect href="/onboarding" />;
  }

  if (status === 'onboarded') {
    return <Redirect href="/dashboard" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
