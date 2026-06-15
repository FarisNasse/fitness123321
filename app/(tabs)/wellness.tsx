import { Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { MetricCard } from '@/src/components/MetricCard';
import { Screen } from '@/src/components/Screen';

export default function WellnessScreen() {
  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontSize: 32, fontWeight: '800' }}>Wellness</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Sleep, mood, stress, steps, and recovery habits.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MetricCard label="Sleep" value="—" />
          <MetricCard label="Mood" value="—" />
        </View>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Daily check-in</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Log mood, stress, and energy using a simple 1-5 scale.
          </Text>
          <View style={{ marginTop: 12 }}>
            <Button title="Log mood" onPress={() => {}} />
          </View>
        </Card>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Sleep</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Manual sleep logging comes first. Wearable imports should be added later.
          </Text>
          <View style={{ marginTop: 12 }}>
            <Button title="Log sleep" onPress={() => {}} />
          </View>
        </Card>
      </View>
    </Screen>
  );
}
