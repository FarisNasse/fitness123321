import { Text, TextInput, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { colors } from '@/src/lib/theme';

import type { LiveWorkoutController } from '../../liveWorkoutState';
import { BaseSheet, sheetInputStyle } from './BaseSheet';

export function EditSetSheet({ controller }: { controller: LiveWorkoutController }) {
  return (
    <BaseSheet visible={controller.activeSheet === 'edit-set'} onClose={controller.closeSheet}>
      <View style={{ gap: 20 }}>
        <Text style={{ color: colors.baseContent, fontSize: 22, fontWeight: '900' }}>
          Edit set {controller.editingSet?.set_number}
        </Text>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 96 }}>
            <Text style={{ color: colors.baseContent, fontWeight: '800', marginBottom: 6 }}>Reps</Text>
            <TextInput
              keyboardType="number-pad"
              value={controller.editInputs.reps}
              onChangeText={(value) => controller.updateEditInput('reps', value)}
              placeholderTextColor={colors.baseMuted}
              style={sheetInputStyle}
            />
          </View>
          <View style={{ flex: 1, minWidth: 96 }}>
            <Text style={{ color: colors.baseContent, fontWeight: '800', marginBottom: 6 }}>Weight</Text>
            <TextInput
              keyboardType="decimal-pad"
              value={controller.editInputs.weight}
              onChangeText={(value) => controller.updateEditInput('weight', value)}
              placeholderTextColor={colors.baseMuted}
              style={sheetInputStyle}
            />
          </View>
        </View>

        {controller.editValidationMessage ? (
          <Text style={{ color: colors.error, fontWeight: '800' }}>
            {controller.editValidationMessage}
          </Text>
        ) : null}

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button title="Cancel" onPress={controller.closeSheet} variant="outline" className="flex-1" />
            <Button title="Save" onPress={controller.saveEditedSet} className="flex-1" />
          </View>
          <Button title="Delete set" onPress={controller.deleteEditingSet} variant="danger" />
        </View>
      </View>
    </BaseSheet>
  );
}
