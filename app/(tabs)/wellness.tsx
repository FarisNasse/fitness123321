import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { MetricCard } from '@/src/components/MetricCard';
import { MoodSelector } from '@/src/components/MoodSelector';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { SegmentedControl } from '@/src/components/SegmentedControl';

export default function WellnessScreen() {
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(2);

  return (
    <Screen>
      <View className="gap-5">
        <View className="gap-2">
          <Text className="text-base font-bold uppercase tracking-widest text-primary">
            Rest
          </Text>
          <Text className="text-4xl font-display text-base-content">Wellness</Text>
          <Text className="text-sm font-body leading-6 text-base-muted">
            Sleep, mood, stress, steps, and recovery habits.
          </Text>
        </View>

        <View className="flex-row gap-3">
          <MetricCard label="Sleep" value="8h" subtext="Target" progress={1} />
          <MetricCard label="Mood" value={`${mood}/5`} subtext="Today" progress={mood / 5} />
        </View>

        <Card variant="highlighted" className="gap-5">
          <SectionHeader eyebrow="Daily check-in" title="How are you feeling?" />
          <MoodSelector value={mood} onChange={setMood} />
          <SegmentedControl label="Energy" value={energy} onChange={setEnergy} />
          <SegmentedControl label="Stress" value={stress} onChange={setStress} />
          <Button title="Save today's check-in" onPress={() => {}} />
        </Card>

        <Card className="gap-3">
          <SectionHeader title="Sleep" />
          <View className="rounded-card border border-base-300 bg-base-100 p-4">
            <View className="flex-row justify-between">
              <Text className="text-sm font-bold text-base-muted">Bedtime</Text>
              <Text className="text-sm font-bold text-base-content">10:30 PM</Text>
            </View>
            <View className="mt-3 flex-row justify-between">
              <Text className="text-sm font-bold text-base-muted">Wake up</Text>
              <Text className="text-sm font-bold text-base-content">6:30 AM</Text>
            </View>
            <View className="mt-3 flex-row justify-between">
              <Text className="text-sm font-bold text-base-muted">Duration</Text>
              <Text className="text-sm font-bold text-primary">8h 0m</Text>
            </View>
          </View>
          <Text className="text-sm font-body leading-6 text-base-muted">
            Manual sleep logging comes first. Wearable imports can be added after
            the wellness table lands.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
