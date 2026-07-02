import { Text, View } from 'react-native';

import { colors } from '@/src/lib/theme';

import { formatLastSetSummary } from '../liveWorkoutSelectors';
import type { LiveWorkoutController } from '../liveWorkoutState';
import { SetValueStepper } from './SetValueStepper';

export function ActiveSetLogger({ controller }: { controller: LiveWorkoutController }) {
  const draft = controller.currentSetDraft;

  return (
    <View
      style={{
        backgroundColor: colors.base200,
        borderColor: colors.base300,
        borderRadius: 24,
        borderWidth: 1,
        gap: 16,
        padding: 18,
      }}
    >
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.baseContent, fontSize: 30, fontWeight: '900' }}>
          {draft.exerciseName}
        </Text>
        <Text style={{ color: colors.baseMuted, fontWeight: '800' }}>{draft.targetSummary}</Text>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900' }}>Last</Text>
        <Text style={{ color: colors.baseContent, fontSize: 20, fontWeight: '900' }}>
          {formatLastSetSummary(controller.lastSet)}
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <Text style={{ color: colors.baseContent, fontSize: 28, fontWeight: '900' }}>
          Set {draft.setNumber}
        </Text>
        <SetValueStepper
          label="Reps"
          value={draft.reps}
          keyboardType="number-pad"
          decrementLabel="−"
          incrementLabel="+"
          onChangeText={(value) => controller.updateSelectedDraft({ reps: value })}
          onDecrement={() => controller.adjustReps(-1)}
          onIncrement={() => controller.adjustReps(1)}
        />
        <SetValueStepper
          label="Weight"
          value={draft.weight}
          keyboardType="decimal-pad"
          decrementLabel={`−${draft.incrementSize}`}
          incrementLabel={`+${draft.incrementSize}`}
          onChangeText={(value) => controller.updateSelectedDraft({ weight: value })}
          onDecrement={() => controller.adjustWeight(-draft.incrementSize)}
          onIncrement={() => controller.adjustWeight(draft.incrementSize)}
        />
        {draft.validationMessage ? (
          <Text style={{ color: colors.error, fontWeight: '800' }}>{draft.validationMessage}</Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <LoggerLink label="Targets" onPress={controller.openTargetSheet} />
        {controller.selectedExercise?.instructions ? (
          <LoggerLink label="Instructions" onPress={controller.openInstructionsSheet} />
        ) : null}
      </View>
    </View>
  );
}

function LoggerLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Text
      accessibilityRole="button"
      onPress={onPress}
      style={{ color: colors.primary, fontWeight: '900', paddingVertical: 6 }}
    >
      {label}
    </Text>
  );
}
