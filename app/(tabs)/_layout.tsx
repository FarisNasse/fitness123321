import { Tabs } from 'expo-router';

export default function TabsLayout() {
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
