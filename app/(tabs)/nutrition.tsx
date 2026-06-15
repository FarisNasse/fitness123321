import { Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { MetricCard } from '@/src/components/MetricCard';
import { Screen } from '@/src/components/Screen';

export default function NutritionScreen() {
  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontSize: 32, fontWeight: '800' }}>Nutrition</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Track meals, macros, calories, and water intake.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MetricCard label="Calories" value="0" />
          <MetricCard label="Protein" value="0g" />
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MetricCard label="Carbs" value="0g" />
          <MetricCard label="Fat" value="0g" />
        </View>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Food logger</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Next implementation: manual food creation, recent foods, saved meals,
            and daily macro totals.
          </Text>
          <View style={{ marginTop: 12 }}>
            <Button title="Add food" onPress={() => {}} />
          </View>
        </Card>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Water</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Quick-add hydration buttons will be added here.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
