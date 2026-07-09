import { View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { colors } from '@/src/lib/theme';

export type WeightChartPoint = {
  value: number;
  label: string;
  id?: string;
};

type WeightChartProps = {
  data: WeightChartPoint[];
};

const chartWidth = 340;
const chartHeight = 210;
const paddingX = 28;
const paddingTop = 20;
const paddingBottom = 34;
const pointRadius = 4;

type WeightChartGeometry = {
  areaPath: string;
  linePath: string;
  points: Array<WeightChartPoint & { x: number; y: number }>;
};

function buildWeightChartGeometry(): WeightChartGeometry;
function buildWeightChartGeometry(data: WeightChartPoint[]): WeightChartGeometry;
function buildWeightChartGeometry(data: WeightChartPoint[] = []): WeightChartGeometry {
  if (data.length === 0) {
    return { areaPath: '', linePath: '', points: [] };
  }

  const values = data.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const points = data.map((point, index) => {
    const x = paddingX + (plotWidth / Math.max(1, data.length - 1)) * index;
    const y =
      minValue === maxValue
        ? paddingTop + plotHeight / 2
        : paddingTop + ((maxValue - point.value) / range) * plotHeight;

    return { ...point, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    chartHeight - paddingBottom
  } L ${points[0].x} ${chartHeight - paddingBottom} Z`;

  return { areaPath, linePath, points };
}

export function WeightChart({ data }: WeightChartProps) {
  const { areaPath, linePath, points } = buildWeightChartGeometry(data);

  if (points.length === 0) {
    return null;
  }

  return (
    <View className="overflow-hidden rounded-card bg-base-200">
      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <Path d={areaPath} fill={colors.primary} opacity={0.14} />
        <Path
          d={linePath}
          fill="transparent"
          stroke={colors.primary}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={4}
        />
        {points.map((point, index) => (
          <Circle
            key={point.id ?? `${point.label}-${point.value}-${index}`}
            cx={point.x}
            cy={point.y}
            r={pointRadius}
            fill={colors.primary}
          />
        ))}
        {points.map((point, index) => (
          <SvgText
            key={`${point.id ?? `${point.label}-${index}`}-label`}
            x={point.x}
            y={chartHeight - 12}
            fill={colors.baseMuted}
            fontSize={11}
            fontWeight="700"
            textAnchor="middle"
          >
            {point.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
