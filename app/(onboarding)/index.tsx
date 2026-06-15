import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
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

  async function saveOnboarding() {
    setIsSubmitting(true);

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

    router.replace('/dashboard');
  }

  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontSize: 32, fontWeight: '800' }}>Set your starting point</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Keep this short. The app should be usable in under 3 minutes.
          </Text>
        </View>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 12 }}>
            Primary goal
          </Text>
          <View style={{ gap: 8 }}>
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

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 12 }}>
            Fitness level
          </Text>
          <View style={{ gap: 8 }}>
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
      style={{
        borderWidth: 1,
        borderColor: selected ? '#0f172a' : '#cbd5e1',
        backgroundColor: selected ? '#f1f5f9' : '#ffffff',
        padding: 12,
        borderRadius: 12,
      }}
    >
      <Text style={{ fontWeight: selected ? '800' : '500' }}>{label}</Text>
    </Pressable>
  );
}
