import { router } from 'expo-router';
import { Alert, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { createLocalWorkoutSession } from '@/src/features/workouts/workout-service';
import { supabase } from '@/src/lib/supabase';

export default function WorkoutsScreen() {
  async function startWorkout() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      Alert.alert('Sign in required', 'Please sign in before starting a workout.');
      router.push('/login');
      return;
    }

    const sessionId = createLocalWorkoutSession(user.id, 'Workout');
    router.push(`/workout/session/${sessionId}`);
  }

  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontSize: 32, fontWeight: '800' }}>Workouts</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Build routines, start live sessions, log sets, and track PRs.
          </Text>
        </View>

        <Button title="Start empty workout" onPress={startWorkout} />

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Exercise library</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Seeded exercises will appear here. Filters should support muscle,
            equipment, movement type, and difficulty.
          </Text>
        </Card>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Saved templates</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Users will be able to save and duplicate custom workout routines.
          </Text>
        </Card>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Recent workouts</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Completed sessions will be listed here after the live workout flow is finished.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
