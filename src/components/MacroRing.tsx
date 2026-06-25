import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/src/lib/theme';

type RingMetric = {
  label: string;
  value: number;
  color: string;
};

type MacroRingProps = {
  calories: number;
  protein: number;
  water: number;
};

const size = 220;
const center = size / 2;
const strokeWidth = 14;

const rings = [
  { radius: 92, key: 'calories' },
  { radius: 70, key: 'protein' },
  { radius: 48, key: 'water' },
] as const;

export function MacroRing({ calories, protein, water }: MacroRingProps) {
  const metrics: Record<(typeof rings)[number]['key'], RingMetric> = {
    calories: {
      label: 'Calories',
      value: calories,
      color: colors.primary,
    },
    protein: {
      label: 'Protein',
      value: protein,
      color: colors.secondary,
    },
    water: {
      label: 'Water',
      value: water,
      color: colors.info,
    },
  };

  return (
    <View className="items-center gap-4">
      <View className="items-center justify-center">
        <Svg width={size} height={size}>
          {rings.map((ring) => {
            const metric = metrics[ring.key];
            const circumference = 2 * Math.PI * ring.radius;
            const progress = Math.max(0, Math.min(1, metric.value));

            return (
              <Circle
                key={`${ring.key}-track`}
                cx={center}
                cy={center}
                r={ring.radius}
                stroke={colors.base300}
                strokeWidth={strokeWidth}
                fill="transparent"
              />
            );
          })}
          {rings.map((ring) => {
            const metric = metrics[ring.key];
            const circumference = 2 * Math.PI * ring.radius;
            const progress = Math.max(0, Math.min(1, metric.value));

            return (
              <Circle
                key={`${ring.key}-value`}
                cx={center}
                cy={center}
                r={ring.radius}
                stroke={metric.color}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference * (1 - progress)}
                strokeLinecap="round"
                transform={`rotate(-90 ${center} ${center})`}
              />
            );
          })}
        </Svg>
        <View className="absolute items-center">
          <Text className="text-5xl font-black text-base-content">
            {Math.round(calories * 100)}
          </Text>
          <Text className="text-xs font-bold uppercase tracking-widest text-base-muted">
            percent
          </Text>
        </View>
      </View>

      <View className="w-full flex-row justify-center gap-3">
        {rings.map((ring) => {
          const metric = metrics[ring.key];

          return (
            <View key={ring.key} className="flex-row items-center gap-2">
              <View
                className="h-2.5 w-2.5 rounded-pill"
                style={{ backgroundColor: metric.color }}
              />
              <Text className="text-xs font-bold text-base-muted">{metric.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
