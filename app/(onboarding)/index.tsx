import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { ProgressBar } from '@/src/components/ProgressBar';
import { Screen } from '@/src/components/Screen';
import { useAuthSession } from '@/src/features/auth/auth-session-context';
import { USE_DEV_AUTH } from '@/src/lib/runtime-flags';
import { supabase } from '@/src/lib/supabase';

const goals = [
  'Lose weight',
  'Build muscle',
  'Improve endurance',
  'Get healthier',
  'Track performance',
];

const levels = ['beginner', 'intermediate', 'advanced', 'athlete'] as const;

export default function OnboardingScreen() {
  const [goal, setGoal] = useState(goals[0]);
  const [level, setLevel] = useState<(typeof levels)[number]>('beginner');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refreshProfile } = useAuthSession();

  async function saveOnboarding() {
    setIsSubmitting(true);

    if (USE_DEV_AUTH) {
      await refreshProfile();
      setIsSubmitting(false);
      router.replace('/dashboard');
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsSubmitting(false);
      Alert.alert('Session expired', 'Please sign in again.');
      router.replace('/login');
      return;
    }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      primary_goal: goal,
      fitness_level: level,
    });

    setIsSubmitting(false);

    if (error) {
      Alert.alert('Unable to save onboarding', error.message);
      return;
    }

    await refreshProfile();
    router.replace('/dashboard');
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-3">
          <View className="items-start">
            <Badge label="Step 1 of 1" variant="primary" />
          </View>
          <Text className="text-4xl font-display text-base-content">
            Set your starting point
          </Text>
          <Text className="text-sm font-body leading-6 text-base-muted">
            Keep this short. The app should be usable in under 3 minutes.
          </Text>
          <ProgressBar value={1} />
        </View>

        <Card className="gap-3">
          <Text className="text-xl font-bold text-base-content">Primary goal</Text>
          <View className="gap-2">
            {goals.map((item) => (
              <Option
                key={item}
                label={item}
                selected={goal === item}
                onPress={() => setGoal(item)}
              />
            ))}
          </View>
        </Card>

        <Card className="gap-3">
          <Text className="text-xl font-bold text-base-content">Fitness level</Text>
          <View className="gap-2">
            {levels.map((item) => (
              <Option
                key={item}
                label={item}
                selected={level === item}
                onPress={() => setLevel(item)}
              />
            ))}
          </View>
        </Card>

        <Button
          title={isSubmitting ? 'Saving...' : 'Finish onboarding'}
          onPress={saveOnboarding}
          disabled={isSubmitting}
          loading={isSubmitting}
          size="lg"
        />
      </View>
    </Screen>
  );
}

function Option({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-input border p-4 active:opacity-75 ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-base-300 bg-base-100'
      }`}
    >
      <Text className={`font-bold ${selected ? 'text-primary' : 'text-base-content'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
