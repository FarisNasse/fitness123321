import { Pressable, Text, TextInput, View } from 'react-native';

import { colors } from '@/src/lib/theme';

export function SetValueStepper({
  label,
  value,
  keyboardType,
  decrementLabel,
  incrementLabel,
  onChangeText,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: string;
  keyboardType: 'number-pad' | 'decimal-pad';
  decrementLabel: string;
  incrementLabel: string;
  onChangeText: (value: string) => void;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900' }}>{label}</Text>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
        <StepperButton label={decrementLabel} onPress={onDecrement} />
        <TextInput
          keyboardType={keyboardType}
          value={value}
          onChangeText={onChangeText}
          placeholder="0"
          placeholderTextColor={colors.baseMuted}
          style={valueInputStyle}
        />
        <StepperButton label={incrementLabel} onPress={onIncrement} />
      </View>
    </View>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? colors.base300 : colors.base100,
        borderColor: colors.base300,
        borderRadius: 16,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 56,
        minWidth: 58,
      })}
    >
      <Text style={{ color: colors.baseContent, fontSize: 18, fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
}

const valueInputStyle = {
  backgroundColor: colors.base100,
  borderWidth: 1,
  borderColor: colors.base300,
  color: colors.baseContent,
  borderRadius: 14,
  flex: 1,
  fontSize: 24,
  fontWeight: '800' as const,
  minHeight: 56,
  padding: 14,
  textAlign: 'center' as const,
};
