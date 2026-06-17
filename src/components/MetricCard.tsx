import { Text, View } from 'react-native';

import { Card } from './Card';
import { ProgressBar } from './ProgressBar';

type MetricCardProps = {
  label: string;
  value: string;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  progress?: number;
  className?: string;
};

export function MetricCard({
  label,
  value,
  subtext,
  trend,
  progress,
  className = '',
}: MetricCardProps) {
  return (
    <View className={`flex-1 ${className}`}>
      <Card className="gap-1">
        <Text className="text-base-muted text-xs font-bold uppercase tracking-widest">
          {label}
        </Text>
        <Text className="text-3xl font-black text-base-content">{value}</Text>
        {subtext ? (
          <Text className="text-base-muted text-xs font-bold">{subtext}</Text>
        ) : null}
        {trend ? (
          <Text
            className={`text-xs font-bold mt-1 ${
              trend === 'up'
                ? 'text-success'
                : trend === 'down'
                  ? 'text-error'
                  : 'text-base-muted'
            }`}
          >
            {trend === 'up' ? 'Up' : trend === 'down' ? 'Down' : 'Flat'} trending
          </Text>
        ) : null}
        {progress !== undefined ? (
          <ProgressBar value={progress} className="mt-2" />
        ) : null}
      </Card>
    </View>
  );
}
