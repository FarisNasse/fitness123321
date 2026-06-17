import { View } from 'react-native';
import type { DimensionValue } from 'react-native';

type ProgressBarProps = {
  value: number;
  className?: string;
  fillClassName?: string;
};

export function ProgressBar({
  value,
  className = '',
  fillClassName = 'bg-primary',
}: ProgressBarProps) {
  const width = `${Math.max(0, Math.min(1, value)) * 100}%` as DimensionValue;

  return (
    <View className={`h-2 overflow-hidden rounded-pill bg-base-300 ${className}`}>
      <View className={`h-full rounded-pill ${fillClassName}`} style={{ width }} />
    </View>
  );
}
