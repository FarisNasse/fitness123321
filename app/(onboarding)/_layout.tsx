import { Redirect, Stack } from 'expo-router';

import { AuthLoadingState, useAuthSession } from '@/src/features/auth/auth-session-context';

export default function OnboardingLayout() {
  const { status } = useAuthSession();

  if (status === 'loading') {
    return <AuthLoadingState />;
  }

  if (status === 'signed-out') {
    return <Redirect href="/login" />;
  }

  if (status === 'onboarded') {
    return <Redirect href="/dashboard" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
