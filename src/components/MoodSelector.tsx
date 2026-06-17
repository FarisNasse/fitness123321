import { Pressable, Text, View } from 'react-native';

type MoodSelectorProps = {
  value: number;
  onChange: (value: number) => void;
};

const moods = ['Very low', 'Low', 'Okay', 'Good', 'Great'];
const moodFaces = ['1', '2', '3', '4', '5'];

export function MoodSelector({ value, onChange }: MoodSelectorProps) {
  return (
    <View className="flex-row justify-between gap-2">
      {moods.map((mood, index) => {
        const moodValue = index + 1;
        const selected = value === moodValue;

        return (
          <Pressable
            key={mood}
            onPress={() => onChange(moodValue)}
            accessibilityLabel={mood}
            className={`h-12 w-12 items-center justify-center rounded-pill border ${
              selected
                ? 'border-primary bg-primary/20'
                : 'border-base-300 bg-base-100'
            }`}
          >
            <Text
              className={`text-lg font-black ${
                selected ? 'text-primary' : 'text-base-muted'
              }`}
            >
              {moodFaces[index]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
