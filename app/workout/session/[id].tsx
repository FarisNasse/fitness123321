import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { Screen } from '@/src/components/Screen';
import { LiveWorkoutScreenView } from '@/src/features/workouts/live/components/LiveWorkoutScreenView';
import { useLiveWorkoutController } from '@/src/features/workouts/live/useLiveWorkoutController';
import { colors } from '@/src/lib/theme';

export default function LiveWorkoutRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const result = useLiveWorkoutController(id);

  if (result.status === 'loading') {
    return (
      <Screen>
        <Card>
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
            <ActivityIndicator />
            <Text style={{ color: colors.baseMuted, fontWeight: '800' }}>
              Loading workout session…
            </Text>
          </View>
        </Card>
      </Screen>
    );
  }

  if (result.status === 'error') {
    const { sessionLoadState } = result;

    return (
      <Screen>
        <Card>
          <EmptyState
            title={sessionLoadState.message}
            message={sessionLoadState.detail ?? 'Start a new local workout from the Train tab.'}
            action={
              <Button
                title="Back to workouts"
                onPress={() => router.replace('/workouts')}
                variant="outline"
              />
            }
          />
        </Card>
      </Screen>
    );
  }

  return <LiveWorkoutScreenView controller={result.controller} />;
}
