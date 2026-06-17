import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

type SectionHeaderProps = {
  title: string;
  action?: ReactNode;
  eyebrow?: string;
  className?: string;
};

export function SectionHeader({
  title,
  action,
  eyebrow,
  className = '',
}: SectionHeaderProps) {
  return (
    <View className={`flex-row items-end justify-between gap-3 ${className}`}>
      <View className="flex-1">
        {eyebrow ? (
          <Text className="text-xs font-bold uppercase tracking-widest text-base-muted">
            {eyebrow}
          </Text>
        ) : null}
        <Text className="text-xl font-bold text-base-content">{title}</Text>
      </View>
      {action}
    </View>
  );
}
