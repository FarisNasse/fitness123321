import { Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { colors } from '@/src/lib/theme';

import type { LiveWorkoutController } from '../../liveWorkoutState';
import { BaseSheet } from './BaseSheet';

export function ExerciseInstructionsSheet({ controller }: { controller: LiveWorkoutController }) {
  return (
    <BaseSheet visible={controller.activeSheet === 'instructions'} onClose={controller.closeSheet}>
      <View style={{ gap: 14 }}>
        <Text style={{ color: colors.baseContent, fontSize: 22, fontWeight: '900' }}>
          {controller.selectedExercise?.name ?? 'Exercise'} instructions
        </Text>
        <Text style={{ color: colors.baseMuted, fontSize: 16, lineHeight: 24 }}>
          {controller.selectedExercise?.instructions ?? 'No instructions saved for this exercise.'}
        </Text>
        <Button title="Close" onPress={controller.closeSheet} />
      </View>
    </BaseSheet>
  );
}
