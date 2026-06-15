import { useLocalSearchParams, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import {
  addLocalWorkoutSet,
  completeLocalWorkoutSession,
  syncPendingWorkoutSessions,
} from '@/src/features/workouts/workout-service';

const placeholderExerciseId = '00000000-0000-0000-0000-000000000001';

export default function LiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('135');
  const [setsAdded, setSetsAdded] = useState(0);

  const sessionId = useMemo(() => {
    if (Array.isArray(id)) return id[0];
    return id;
  }, [id]);

  function addSet() {
    if (!sessionId) return;

    const parsedReps = Number.parseInt(reps, 10);
    const parsedWeight = Number.parseFloat(weight);

    if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
      Alert.alert('Invalid reps', 'Enter a valid rep count.');
      return;
    }

    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) {
      Alert.alert('Invalid weight', 'Enter a valid weight.');
      return;
    }

    addLocalWorkoutSet({
      sessionLocalId: sessionId,
      exerciseId: placeholderExerciseId,
      setNumber: setsAdded + 1,
      reps: parsedReps,
      weight: parsedWeight,
    });

    setSetsAdded((value) => value + 1);
  }

  function finishWorkout() {
    if (!sessionId) return;
    completeLocalWorkoutSession(sessionId);
    void syncPendingWorkoutSessions().catch((error) => {
      console.warn('Failed to sync completed workout session.', error);
    });
    Alert.alert(
      'Workout complete',
      'The workout was saved locally and will sync automatically.'
    );
    router.replace('/workouts');
  }

  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontSize: 32, fontWeight: '800' }}>Live Workout</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Starter session screen. Next patch should replace the placeholder
            exercise with the exercise picker.
          </Text>
        </View>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Placeholder exercise</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Use this temporary set logger to prove local workout logging works.
          </Text>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', marginBottom: 6 }}>Reps</Text>
              <TextInput
                keyboardType="number-pad"
                value={reps}
                onChangeText={setReps}
                style={inputStyle}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', marginBottom: 6 }}>Weight</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
                style={inputStyle}
              />
            </View>
          </View>

          <View style={{ marginTop: 16, gap: 10 }}>
            <Button title="Add set" onPress={addSet} />
            <Text style={{ color: '#64748b' }}>Sets added: {setsAdded}</Text>
          </View>
        </Card>

        <Button title="Finish workout" onPress={finishWorkout} />
      </View>
    </Screen>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: '#cbd5e1',
  borderRadius: 12,
  padding: 12,
};
