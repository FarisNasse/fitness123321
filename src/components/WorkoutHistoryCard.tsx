import { Pressable, Text, View } from 'react-native';

import { Badge } from './Badge';

type WorkoutHistoryCardProps = {
  name: string;
  startedAt: string;
  durationLabel: string;
  setCount: number;
  onPress: () => void;
};

export function WorkoutHistoryCard({
  name,
  startedAt,
  durationLabel,
  setCount,
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
        <Badge label="Finished" variant="success" />
      </View>
      <Text className="text-sm font-bold text-base-muted">
        {durationLabel} / {setCount} set{setCount === 1 ? '' : 's'}
      </Text>
    </Pressable>
  );
}
