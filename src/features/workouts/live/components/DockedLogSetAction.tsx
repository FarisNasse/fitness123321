import { Pressable, Text, View } from 'react-native';

import { colors } from '@/src/lib/theme';

import type { LiveWorkoutController } from '../liveWorkoutState';

export function DockedLogSetAction({ controller }: { controller: LiveWorkoutController }) {
  if (!controller.selectedExercise) return null;

  return (
    <View
      style={{
        backgroundColor: colors.base100,
        borderTopColor: colors.base300,
        borderTopWidth: 1,
        bottom: 0,
        left: 0,
        padding: 16,
        position: 'absolute',
        right: 0,
      }}
    >
      <Pressable
        disabled={Boolean(controller.currentSetDraft.validationMessage)}
        onPress={controller.addSet}
        style={({ pressed }) => ({
          alignItems: 'center',
          backgroundColor: controller.currentSetDraft.validationMessage ? colors.baseMuted : colors.primary,
          borderRadius: 20,
          justifyContent: 'center',
          minHeight: 64,
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <Text style={{ color: colors.primaryContent, fontSize: 20, fontWeight: '900' }}>
          {controller.currentSetDraft.logButtonTitle}
        </Text>
        <Text style={{ color: colors.primaryContent, fontWeight: '800', marginTop: 2 }}>
          {controller.currentSetDraft.logButtonDetail}
        </Text>
      </Pressable>
    </View>
  );
}
