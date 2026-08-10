import { Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { colors } from '@/src/lib/theme';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  inputClassName?: string;
};

export function Input({
  label,
  error,
  hint,
  containerClassName = '',
  inputClassName = '',
  ...props
}: InputProps) {
  return (
    <View className={`gap-2 ${containerClassName}`}>
      {label ? (
        <Text className="text-sm font-bold text-base-content">{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.baseMuted}
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label ?? props.placeholder}
        accessibilityHint={props.accessibilityHint ?? hint}
        className={`
          rounded-input border bg-base-100 px-4 py-3 text-base font-body text-base-content
          ${error ? 'border-error' : 'border-base-300'}
          ${inputClassName}
        `}
      />
      {error ? (
        <Text className="text-xs font-bold text-error">{error}</Text>
      ) : hint ? (
        <Text className="text-xs font-body text-base-muted">{hint}</Text>
      ) : null}
    </View>
  );
}
