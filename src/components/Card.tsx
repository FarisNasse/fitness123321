import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

type CardVariant = 'default' | 'highlighted' | 'ghost';

type CardProps = PropsWithChildren<{
  variant?: CardVariant;
  className?: string;
}>;

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-base-200 border border-base-300',
  highlighted: 'bg-base-200 border border-primary/40',
  ghost: 'bg-transparent border border-base-300',
};

export function Card({ children, variant = 'default', className = '' }: CardProps) {
  return (
    <View className={`rounded-card p-4 ${variantClasses[variant]} ${className}`}>
      {children}
    </View>
  );
}
