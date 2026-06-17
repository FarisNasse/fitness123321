import { Text, View } from 'react-native';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  className?: string;
};

const badgeConfig: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: 'bg-success/20 border-success', text: 'text-success' },
  warning: { bg: 'bg-warning/20 border-warning', text: 'text-warning' },
  error: { bg: 'bg-error/20 border-error', text: 'text-error' },
  info: { bg: 'bg-info/20 border-info', text: 'text-info' },
  neutral: { bg: 'bg-base-300 border-base-300', text: 'text-base-muted' },
  primary: { bg: 'bg-primary/20 border-primary/50', text: 'text-primary' },
};

export function Badge({ label, variant = 'neutral', className = '' }: BadgeProps) {
  const config = badgeConfig[variant];

  return (
    <View className={`border rounded-pill px-3 py-1 ${config.bg} ${className}`}>
      <Text className={`text-xs font-bold ${config.text}`}>{label}</Text>
    </View>
  );
}
