import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Input } from '@/src/components/Input';
import { MetricCard } from '@/src/components/MetricCard';
import { MoodSelector } from '@/src/components/MoodSelector';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { SegmentedControl } from '@/src/components/SegmentedControl';
import {
  buildSleepWindow,
  formatTimeInput,
  getDailyWellnessCheckIn,
  getLatestWellnessCheckIn,
  getLocalDateKey,
  getSleepDurationMinutes,
  getWellnessOwnerUserId,
  saveDailyWellnessCheckIn,
  syncPendingWellnessCheckIns,
} from '@/src/features/wellness/wellness-service';
import { reportError } from '@/src/lib/error-reporting';

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

export default function WellnessScreen() {
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(2);
  const [steps, setSteps] = useState('0');
  const [bedtime, setBedtime] = useState('22:30');
  const [wakeTime, setWakeTime] = useState('06:30');
  const [isSaving, setIsSaving] = useState(false);
  const [hasSavedToday, setHasSavedToday] = useState(false);

  const refreshCheckIn = useCallback(async () => {
    try {
      const userId = await getWellnessOwnerUserId();
      const checkIn =
        getDailyWellnessCheckIn(userId) ?? getLatestWellnessCheckIn(userId);

      if (!checkIn) {
        setHasSavedToday(false);
        return;
      }

      setMood(Number(checkIn.mood_score));
      setEnergy(Number(checkIn.energy_score));
      setStress(Number(checkIn.stress_score));
      setSteps(String(checkIn.steps));
      setBedtime(formatTimeInput(checkIn.sleep_start));
      setWakeTime(formatTimeInput(checkIn.sleep_end));
      setHasSavedToday(checkIn.check_in_date === getLocalDateKey());
    } catch (error) {
      reportError(error, {
        source: 'wellness-screen',
        operation: 'load-check-in',
        domain: 'wellness',
      });
      Alert.alert('Unable to load wellness', 'Your wellness check-in could not be loaded.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshCheckIn();
    }, [refreshCheckIn])
  );

  const sleepDuration = useMemo(() => {
    try {
      const window = buildSleepWindow(new Date(), bedtime, wakeTime);
      return getSleepDurationMinutes(window.sleepStart, window.sleepEnd);
    } catch {
      return 0;
    }
  }, [bedtime, wakeTime]);

  async function handleSave() {
    const parsedSteps = Number(steps.trim());

    if (!Number.isInteger(parsedSteps) || parsedSteps < 0) {
      Alert.alert('Invalid step count', 'Enter a whole number of 0 or greater.');
      return;
    }

    setIsSaving(true);

    try {
      const userId = await getWellnessOwnerUserId();
      const sleepWindow = buildSleepWindow(new Date(), bedtime, wakeTime);

      saveDailyWellnessCheckIn({
        userId,
        sleepStart: sleepWindow.sleepStart,
        sleepEnd: sleepWindow.sleepEnd,
        mood,
        stress,
        energy,
        steps: parsedSteps,
      });

      setHasSavedToday(true);

      void syncPendingWellnessCheckIns().catch((error) => {
        reportError(error, {
          source: 'wellness-screen',
          operation: 'sync-after-save',
          domain: 'wellness',
        });
      });

      Alert.alert('Check-in saved', 'Today’s wellness values are stored on this device.');
    } catch (error) {
      reportError(error, {
        source: 'wellness-screen',
        operation: 'save-check-in',
        domain: 'wellness',
      });
      Alert.alert('Unable to save wellness', 'Check your values and try saving again.');
    } finally {
      setIsSaving(false);
    }
  }

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
          <MetricCard
            label="Sleep"
            value={formatDuration(sleepDuration)}
            subtext={hasSavedToday ? 'Saved today' : 'Tonight'}
            progress={Math.min(1, sleepDuration / 480)}
          />
          <MetricCard label="Mood" value={`${mood}/5`} subtext="Today" progress={mood / 5} />
        </View>

        <Card variant="highlighted" className="gap-5">
          <SectionHeader eyebrow="Daily check-in" title="How are you feeling?" />
          <MoodSelector value={mood} onChange={setMood} />
          <SegmentedControl label="Energy" value={energy} onChange={setEnergy} />
          <SegmentedControl label="Stress" value={stress} onChange={setStress} />
          <Input
            label="Manual steps"
            value={steps}
            onChangeText={setSteps}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="0"
            hint="Enter the total shown by your phone, watch, or pedometer."
          />
          <Button
            title={hasSavedToday ? "Update today's check-in" : "Save today's check-in"}
            onPress={handleSave}
            loading={isSaving}
          />
        </Card>

        <Card className="gap-3">
          <SectionHeader title="Sleep" />
          <View className="gap-4 rounded-card border border-base-300 bg-base-100 p-4">
            <Input
              label="Bedtime"
              value={bedtime}
              onChangeText={setBedtime}
              placeholder="22:30"
              autoCapitalize="none"
              hint="24-hour time (HH:MM)"
            />
            <Input
              label="Wake time"
              value={wakeTime}
              onChangeText={setWakeTime}
              placeholder="06:30"
              autoCapitalize="none"
              hint="Times earlier than bedtime are treated as the next morning."
            />
            <View className="flex-row justify-between">
              <Text className="text-sm font-bold text-base-muted">Duration</Text>
              <Text className="text-sm font-bold text-primary">
                {formatDuration(sleepDuration)}
              </Text>
            </View>
          </View>
          <Text className="text-sm font-body leading-6 text-base-muted">
            Sleep is stored manually with the same dated check-in. No wearable connection
            is required.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
