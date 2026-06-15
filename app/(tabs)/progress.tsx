import { Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { MetricCard } from '@/src/components/MetricCard';
import { Screen } from '@/src/components/Screen';

export default function ProgressScreen() {
  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontSize: 32, fontWeight: '800' }}>Progress</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Weight, measurements, goals, streaks, and training trends.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MetricCard label="Weight" value="—" />
          <MetricCard label="Workout streak" value="0 days" />
        </View>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Body measurements</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Add weight, body fat, waist, hips, chest, arms, and thighs.
          </Text>
          <View style={{ marginTop: 12 }}>
            <Button title="Log measurement" onPress={() => {}} />
          </View>
        </Card>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Charts</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Weight trend, body fat trend, and workout volume charts will be added
            after logging flows are complete.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
