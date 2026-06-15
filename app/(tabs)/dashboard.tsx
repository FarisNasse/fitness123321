import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { Card } from '@/src/components/Card';
import { MetricCard } from '@/src/components/MetricCard';
import { Screen } from '@/src/components/Screen';

export default function DashboardScreen() {
  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontSize: 32, fontWeight: '800' }}>Today</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Your daily snapshot across workouts, nutrition, wellness, and progress.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MetricCard label="Calories" value="0 / 2,000" />
          <MetricCard label="Protein" value="0g / 135g" />
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MetricCard label="Water" value="0 / 2.0L" />
          <MetricCard label="Steps" value="0 / 8,000" />
        </View>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Next action</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Start with the workout logging vertical slice. Once set logging works,
            everything else can plug into this dashboard.
          </Text>
          <Link href="/workouts" style={{ marginTop: 12, fontWeight: '800' }}>
            Go to workouts →
          </Link>
        </Card>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>MVP status</Text>
          <View style={{ marginTop: 12, gap: 8 }}>
            <ChecklistItem label="Auth scaffold" done />
            <ChecklistItem label="Onboarding scaffold" done />
            <ChecklistItem label="Workout logging" />
            <ChecklistItem label="Nutrition logging" />
            <ChecklistItem label="Wellness logging" />
            <ChecklistItem label="Progress charts" />
            <ChecklistItem label="Offline sync" />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function ChecklistItem({ label, done = false }: { label: string; done?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: done ? '#0f172a' : '#e2e8f0',
        }}
      />
      <Text style={{ color: done ? '#0f172a' : '#64748b' }}>{label}</Text>
    </View>
  );
}
