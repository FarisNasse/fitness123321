import { Pressable, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { colors } from '@/src/lib/theme';

import { formatClock } from '../../liveWorkoutFormatting';
import type { LiveWorkoutController } from '../../liveWorkoutState';
import { BaseSheet } from './BaseSheet';

export function FinishWorkoutSheet({ controller }: { controller: LiveWorkoutController }) {
  return (
    <BaseSheet visible={controller.activeSheet === 'finish'} onClose={controller.closeSheet}>
      <View style={{ gap: 18 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.baseContent, fontSize: 24, fontWeight: '900' }}>
            Finish workout
          </Text>
          <Text style={{ color: colors.baseMuted, fontWeight: '800' }}>
            Logged: {controller.sets.length} set{controller.sets.length === 1 ? '' : 's'} · Duration: {formatClock(controller.elapsedSeconds)}
          </Text>
        </View>

        {controller.hasDirtyActiveDraft ? (
          <View
            style={{
              backgroundColor: 'rgba(251, 191, 36, 0.12)',
              borderColor: 'rgba(251, 191, 36, 0.3)',
              borderRadius: 16,
              borderWidth: 1,
              padding: 12,
            }}
          >
            <Text style={{ color: colors.baseContent, fontWeight: '900' }}>Unsaved current set</Text>
            <Text style={{ color: colors.baseMuted, fontWeight: '800', marginTop: 2 }}>
              Log the set first, or complete without saving the draft.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.baseContent, fontWeight: '900' }}>How did this workout feel?</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['easy', 'good', 'max'] as const).map((feedback) => {
              const selected = controller.effortFeedback === feedback;
              const label = feedback === 'easy' ? 'Easy' : feedback === 'good' ? 'Good' : 'Max';

              return (
                <Pressable
                  key={feedback}
                  onPress={() => controller.setEffortFeedback(selected ? null : feedback)}
                  style={{
                    alignItems: 'center',
                    backgroundColor: selected ? colors.primary : colors.base100,
                    borderColor: selected ? colors.primary : colors.base300,
                    borderRadius: 14,
                    borderWidth: 1,
                    flex: 1,
                    minHeight: 48,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.primaryContent : colors.baseContent,
                      fontWeight: '900',
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {controller.completionSummary ? (
          <Text style={{ color: colors.baseMuted, lineHeight: 20 }}>{controller.completionSummary}</Text>
        ) : null}

        <View style={{ gap: 10 }}>
          {controller.hasDirtyActiveDraft ? (
            <Button title="Log set first" onPress={controller.addSet} variant="outline" />
          ) : null}
          <Button title="Complete workout" onPress={controller.completeWorkout} />
          <Button title="Cancel" onPress={controller.closeSheet} variant="ghost" />
        </View>
      </View>
    </BaseSheet>
  );
}
