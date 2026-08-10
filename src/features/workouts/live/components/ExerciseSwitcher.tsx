import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors } from '@/src/lib/theme';

import type { LiveWorkoutController } from '../liveWorkoutState';

export function ExerciseSwitcher({ controller }: { controller: LiveWorkoutController }) {
  return (
    <View
      style={{
        borderBottomColor: colors.base300,
        borderBottomWidth: 1,
        paddingVertical: 12,
      }}
    >
      <ScrollView
        horizontal
        contentContainerStyle={{ gap: 10, paddingHorizontal: 18 }}
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {controller.selectedExercises.map((exercise) => {
          const active = exercise.id === controller.selectedExercise?.id;

          return (
            <Pressable
              key={exercise.id}
              onPress={() => void controller.selectExerciseForLogging(exercise)}
              accessibilityRole="button"
              accessibilityLabel={`${controller.exerciseProgressLabel(exercise)} exercise`}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                alignItems: 'center',
                backgroundColor: active ? colors.primary : pressed ? colors.base300 : colors.base200,
                borderColor: active ? colors.primary : colors.base300,
                borderRadius: 999,
                borderWidth: 1,
                minHeight: 48,
                justifyContent: 'center',
                paddingHorizontal: 16,
              })}
            >
              <Text
                style={{
                  color: active ? colors.primaryContent : colors.baseContent,
                  fontWeight: '900',
                }}
              >
                {controller.exerciseProgressLabel(exercise)}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          accessibilityLabel="Add exercise"
          accessibilityRole="button"
          onPress={controller.openExercisePicker}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: pressed ? colors.base300 : colors.base200,
            borderColor: colors.base300,
            borderRadius: 999,
            borderWidth: 1,
            minHeight: 48,
            minWidth: 48,
            justifyContent: 'center',
          })}
        >
          <Text style={{ color: colors.primary, fontSize: 22, fontWeight: '900' }}>+</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
