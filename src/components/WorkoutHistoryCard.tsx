import { Pressable, Text, View } from 'react-native';

import { Badge, type BadgeVariant } from './Badge';

type WorkoutHistoryCardProps = {
  name: string;
  startedAt: string;
  durationLabel: string;
  setCount: number;
  syncStatusLabel?: string;
  syncStatusVariant?: BadgeVariant;
  retrying?: boolean;
  onRetrySync?: () => void;
  onPress: () => void;
};

export function WorkoutHistoryCard({
  name,
  startedAt,
  durationLabel,
  setCount,
  syncStatusLabel,
  syncStatusVariant = 'neutral',
  retrying = false,
  onRetrySync,
  onPress,
}: WorkoutHistoryCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="gap-3 rounded-card border border-base-300 bg-base-100 p-4 active:opacity-75"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-bold text-base-content">{name}</Text>
          <Text className="mt-1 text-xs font-body text-base-muted">{startedAt}</Text>
        </View>
        <View className="items-end gap-2">
          <Badge label="Finished" variant="success" />
          {syncStatusLabel ? (
            <Badge label={syncStatusLabel} variant={syncStatusVariant} />
          ) : null}
        </View>
      </View>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-sm font-bold text-base-muted">
          {durationLabel} / {setCount} set{setCount === 1 ? '' : 's'}
        </Text>
        {onRetrySync ? (
          <Pressable
            disabled={retrying}
            onPress={(event) => {
              event.stopPropagation();
              onRetrySync();
            }}
            className="rounded-pill border border-primary px-3 py-2 active:opacity-75 disabled:opacity-40"
          >
            <Text className="text-xs font-black text-primary">
              {retrying ? 'Retrying...' : 'Retry sync'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}
