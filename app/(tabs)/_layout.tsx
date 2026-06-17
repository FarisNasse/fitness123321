import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { AuthLoadingState, useAuthSession } from '@/src/features/auth/auth-session-context';
import { colors } from '@/src/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <Ionicons
      name={name}
      size={24}
      color={focused ? colors.primary : colors.baseMuted}
    />
  );
}

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
        headerStyle: {
          backgroundColor: colors.base100,
        },
        headerTitleStyle: {
          color: colors.baseContent,
          fontFamily: 'SpaceGrotesk_700Bold',
          fontSize: 18,
        },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.baseMuted,
        tabBarStyle: {
          backgroundColor: colors.base100,
          borderTopColor: colors.base300,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_700Bold',
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Train',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'barbell' : 'barbell-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Eat',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'restaurant' : 'restaurant-outline'}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wellness"
        options={{
          title: 'Rest',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'heart' : 'heart-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Growth',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'trending-up' : 'trending-up-outline'}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
