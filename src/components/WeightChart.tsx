import { View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { colors } from '@/src/lib/theme';

const data = [
  { value: 175, label: 'M' },
  { value: 174, label: 'T' },
  { value: 173.5, label: 'W' },
  { value: 172.5, label: 'T' },
  { value: 171.5, label: 'F' },
  { value: 171, label: 'S' },
  { value: 170, label: 'S' },
];

export function WeightChart() {
  return (
    <View className="overflow-hidden rounded-card bg-base-200">
      <LineChart
        areaChart
        curved
        data={data}
        color={colors.primary}
        startFillColor={colors.primary}
        endFillColor={colors.base200}
        startOpacity={0.32}
        endOpacity={0}
        thickness={4}
        hideDataPoints={false}
        dataPointsColor={colors.primary}
        yAxisTextStyle={{ color: colors.baseMuted, fontFamily: 'Inter_700Bold' }}
        xAxisLabelTextStyle={{ color: colors.baseMuted, fontFamily: 'Inter_700Bold' }}
        rulesColor={colors.base300}
        xAxisColor={colors.base300}
        yAxisColor={colors.base300}
        backgroundColor={colors.base200}
        height={170}
        adjustToWidth
      />
    </View>
  );
}
