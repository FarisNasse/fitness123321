import { Pressable, Text, View } from 'react-native';

type SegmentedControlProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export function SegmentedControl({ label, value, onChange }: SegmentedControlProps) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-base-content">{label}</Text>
        <Text className="text-xs font-bold text-base-muted">{value}/5</Text>
      </View>
      <View className="flex-row gap-2">
        {[1, 2, 3, 4, 5].map((item) => {
          const selected = item <= value;

          return (
            <Pressable
              key={item}
              onPress={() => onChange(item)}
              className={`h-4 flex-1 rounded-pill ${
                selected ? 'bg-primary' : 'bg-base-300'
              }`}
            />
          );
        })}
      </View>
    </View>
  );
}
