import { Redirect, Tabs } from 'expo-router';

import { AuthLoadingState, useAuthSession } from '@/src/features/auth/auth-session-context';

export default function TabsLayout() {
  const { status } = useAuthSession();

  if (status === 'loading') {
    return <AuthLoadingState />;
  }

  if (status === 'signed-out') {
    return <Redirect href="/login" />;
  }

  if (status === 'needs-onboarding') {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerTitleStyle: {
          fontWeight: '800',
        },
        tabBarLabelStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
        }}
      />
      <Tabs.Screen
        name="wellness"
        options={{
          title: 'Wellness',
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
        }}
      />
    </Tabs>
  );
}
