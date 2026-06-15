import { Text, View } from 'react-native';

import { Card } from './Card';

type MetricCardProps = {
  label: string;
  value: string;
};

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <View style={{ flex: 1 }}>
      <Card>
        <Text style={{ color: '#64748b', fontWeight: '700' }}>{label}</Text>
        <Text style={{ marginTop: 8, fontSize: 20, fontWeight: '900' }}>{value}</Text>
      </Card>
    </View>
  );
}
