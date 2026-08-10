import { Text, TextInput, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { colors } from '@/src/lib/theme';

import type { LiveWorkoutController } from '../../liveWorkoutState';
import { BaseSheet, sheetInputStyle } from './BaseSheet';

export function TargetSettingsSheet({ controller }: { controller: LiveWorkoutController }) {
  return (
    <BaseSheet accessibilityLabel="Exercise targets" visible={controller.activeSheet === 'targets'} onClose={controller.closeSheet}>
      <View style={{ gap: 18 }}>
        <Text style={{ color: colors.baseContent, fontSize: 22, fontWeight: '900' }}>
          {controller.selectedExercise?.name ?? 'Exercise'} targets
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <TargetInput
            label="Sets"
            value={controller.targetInputs.targetSets}
            onChangeText={(value) => controller.updateTargetInput('targetSets', value)}
          />
          <TargetInput
            label="Rep min"
            value={controller.targetInputs.repMin}
            onChangeText={(value) => controller.updateTargetInput('repMin', value)}
          />
          <TargetInput
            label="Rep max"
            value={controller.targetInputs.repMax}
            onChangeText={(value) => controller.updateTargetInput('repMax', value)}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <TargetInput
            label="Increment"
            value={controller.targetInputs.incrementSize}
            onChangeText={(value) => controller.updateTargetInput('incrementSize', value)}
          />
          <TargetInput
            label="Deload %"
            value={controller.targetInputs.deloadPercentage}
            onChangeText={(value) => controller.updateTargetInput('deloadPercentage', value)}
          />
        </View>

        {controller.targetValidationMessage ? (
          <Text style={{ color: colors.error, fontWeight: '800' }}>
            {controller.targetValidationMessage}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button title="Cancel" onPress={controller.closeSheet} variant="outline" className="flex-1" />
          <Button title="Save targets" onPress={controller.saveSelectedExerciseTarget} className="flex-1" />
        </View>
      </View>
    </BaseSheet>
  );
}

function TargetInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={{ flex: 1, minWidth: 96 }}>
      <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.baseMuted}
        style={sheetInputStyle}
      />
    </View>
  );
}
