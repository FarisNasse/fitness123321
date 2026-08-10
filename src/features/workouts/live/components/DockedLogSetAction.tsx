import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import { colors } from '@/src/lib/theme';

import type { LiveWorkoutController } from '../liveWorkoutState';

type DockedLogSetActionProps = {
  controller: LiveWorkoutController;
  bottomInset?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export function DockedLogSetAction({
  controller,
  bottomInset = 0,
  onLayout,
}: DockedLogSetActionProps) {
  if (!controller.selectedExercise) return null;

  const disabled = Boolean(controller.currentSetDraft.validationMessage);
  const disabledTextColor = colors.baseContent;

  return (
    <View
      onLayout={onLayout}
      style={{
        backgroundColor: colors.base100,
        borderTopColor: colors.base300,
        borderTopWidth: 1,
        bottom: 0,
        left: 0,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: Math.max(16, bottomInset + 16),
        position: 'absolute',
        right: 0,
      }}
    >
      <Pressable
        disabled={disabled}
        onPress={controller.addSet}
        accessibilityRole="button"
        accessibilityLabel={controller.currentSetDraft.logButtonTitle}
        accessibilityHint={controller.currentSetDraft.logButtonDetail}
        accessibilityState={{ disabled }}
        style={({ pressed }) => ({
          alignItems: 'center',
          backgroundColor: disabled ? colors.base300 : colors.primary,
          borderRadius: 20,
          justifyContent: 'center',
          minHeight: 64,
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <Text
          style={{
            color: disabled ? disabledTextColor : colors.primaryContent,
            fontSize: 20,
            fontWeight: '900',
            opacity: disabled ? 0.72 : 1,
          }}
        >
          {controller.currentSetDraft.logButtonTitle}
        </Text>
        <Text
          style={{
            color: disabled ? disabledTextColor : colors.primaryContent,
            fontWeight: '800',
            marginTop: 2,
            opacity: disabled ? 0.7 : 1,
          }}
        >
          {controller.currentSetDraft.logButtonDetail}
        </Text>
      </Pressable>
    </View>
  );
}
