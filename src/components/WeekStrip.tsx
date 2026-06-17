import { Text, View } from 'react-native';

type WeekStripProps = {
  activeDays?: number[];
};

const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function WeekStrip({ activeDays = [1, 3, 5] }: WeekStripProps) {
  return (
    <View className="flex-row justify-between rounded-card border border-base-300 bg-base-200 p-3">
      {dayLabels.map((day, index) => {
        const isToday = index === normalizeMondayFirst(new Date().getDay());
        const isActive = activeDays.includes(index);

        return (
          <View key={`${day}-${index}`} className="items-center gap-2">
            <Text
              className={`text-xs font-bold ${
                isToday ? 'text-primary' : 'text-base-muted'
              }`}
            >
              {day}
            </Text>
            <View
              className={`h-8 w-8 items-center justify-center rounded-pill border ${
                isActive
                  ? 'border-primary bg-primary'
                  : isToday
                    ? 'border-primary bg-primary/10'
                    : 'border-base-300 bg-base-100'
              }`}
            >
              <View
                className={`h-2 w-2 rounded-pill ${
                  isActive ? 'bg-primary-content' : 'bg-base-muted'
                }`}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function normalizeMondayFirst(day: number) {
  return day === 0 ? 6 : day - 1;
}
