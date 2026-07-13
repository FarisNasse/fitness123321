import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { Input } from '@/src/components/Input';
import { MetricCard } from '@/src/components/MetricCard';
import { PRCard } from '@/src/components/PRCard';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { WeightChart, type WeightChartPoint } from '@/src/components/WeightChart';
import {
  centimetersToInches,
  getBodyMeasurementHistory,
  getBodyMeasurementOwnerUserId,
  inchesToCentimeters,
  kilogramsToPounds,
  poundsToKilograms,
  refreshBodyMeasurementsFromRemote,
  saveBodyMeasurement,
  subscribeToBodyMeasurementChanges,
  syncPendingBodyMeasurements,
  type BodyMeasurementRecord,
} from '@/src/features/progress/body-measurements-service';
import { getSeededExercises } from '@/src/features/workouts/exercise-service';
import { estimatedOneRepMax } from '@/src/features/workouts/pr-service';
import {
  getCompletedWorkoutSessions,
  getLocalWorkoutSets,
  type LocalWorkoutSessionRow,
} from '@/src/features/workouts/workout-service';
import { reportError } from '@/src/lib/error-reporting';

type PersonalRecord = {
  exercise: string;
  value: string;
};

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseMeasurementDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    throw new Error('Use a date in YYYY-MM-DD format.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error('Use a valid measurement date.');
  }

  return date;
}

function parseRequiredNumber(value: string, label: string) {
  const parsed = Number(value.trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }

  return parsed;
}

function parseOptionalPercentage(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value.trim());

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error('Body fat must be between 0 and 100.');
  }

  return parsed;
}

function formatDecimal(value: number, digits = 1) {
  return value.toFixed(digits).replace(/\.0$/, '');
}

function formatWeight(weightKg: number) {
  return `${formatDecimal(kilogramsToPounds(Number(weightKg)))} lb`;
}

function formatMeasurementDate(measuredAt: string) {
  const date = new Date(measuredAt);

  if (!Number.isFinite(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatChartDate(measuredAt: string) {
  const date = new Date(measuredAt);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function OptionalMeasurement({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[46%] flex-1 gap-1 rounded-card border border-base-300 bg-base-100 p-3">
      <Text className="text-xs font-bold uppercase tracking-widest text-base-muted">
        {label}
      </Text>
      <Text className="text-base font-bold text-base-content">{value}</Text>
    </View>
  );
}

export default function ProgressScreen() {
  const [sessions, setSessions] = useState<LocalWorkoutSessionRow[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurementRecord[]>([]);
  const [isMeasurementOpen, setIsMeasurementOpen] = useState(false);
  const [isSavingMeasurement, setIsSavingMeasurement] = useState(false);
  const [measurementDate, setMeasurementDate] = useState(getLocalDateInputValue());
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [chest, setChest] = useState('');
  const [arm, setArm] = useState('');
  const [thigh, setThigh] = useState('');
  const exercises = useMemo(() => getSeededExercises(), []);

  const loadLocalMeasurements = useCallback(async () => {
    const userId = await getBodyMeasurementOwnerUserId();
    setMeasurements(getBodyMeasurementHistory(userId));
  }, []);

  const refreshMeasurements = useCallback(async () => {
    try {
      const userId = await getBodyMeasurementOwnerUserId();
      await refreshBodyMeasurementsFromRemote(userId);
      setMeasurements(getBodyMeasurementHistory(userId));
    } catch (error) {
      reportError(error, {
        source: 'progress-screen',
        operation: 'load-measurements',
        domain: 'progress',
      });
      Alert.alert('Unable to load measurements', 'Measurements could not be refreshed right now.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setSessions(getCompletedWorkoutSessions(12));
      void refreshMeasurements();

      const unsubscribe = subscribeToBodyMeasurementChanges(() => {
        void loadLocalMeasurements();
      });

      return unsubscribe;
    }, [loadLocalMeasurements, refreshMeasurements])
  );

  const records = useMemo<PersonalRecord[]>(() => {
    const exerciseLookup = Object.fromEntries(
      exercises.map((exercise) => [exercise.id, exercise.name])
    );
    const bestByExercise = new Map<string, number>();

    for (const session of sessions) {
      for (const set of getLocalWorkoutSets(session.local_id)) {
        const reps = Number(set.reps);
        const setWeight = Number(set.weight);

        if (!Number.isFinite(reps) || !Number.isFinite(setWeight) || reps <= 0) {
          continue;
        }

        const estimate = estimatedOneRepMax(setWeight, reps);
        const currentBest = bestByExercise.get(set.exercise_id) ?? 0;

        if (estimate > currentBest) {
          bestByExercise.set(set.exercise_id, estimate);
        }
      }
    }

    return Array.from(bestByExercise.entries())
      .sort((first, second) => second[1] - first[1])
      .slice(0, 3)
      .map(([exerciseId, estimate]) => ({
        exercise: exerciseLookup[exerciseId] ?? 'Unknown exercise',
        value: `${Math.round(estimate)} lb est. 1RM`,
      }));
  }, [exercises, sessions]);

  const latestMeasurement = measurements[measurements.length - 1] ?? null;
  const previousMeasurement = measurements[measurements.length - 2] ?? null;
  const chartPoints = useMemo<WeightChartPoint[]>(
    () =>
      measurements.slice(-12).map((measurement) => ({
        id: measurement.local_id,
        value: kilogramsToPounds(Number(measurement.weight_kg)),
        label: formatChartDate(measurement.measured_at),
      })),
    [measurements]
  );

  const weightSubtext = useMemo(() => {
    if (!latestMeasurement) {
      return 'No measurements yet';
    }

    if (!previousMeasurement) {
      return formatMeasurementDate(latestMeasurement.measured_at);
    }

    const change =
      kilogramsToPounds(Number(latestMeasurement.weight_kg)) -
      kilogramsToPounds(Number(previousMeasurement.weight_kg));
    const prefix = change > 0 ? '+' : '';

    return `${prefix}${formatDecimal(change)} lb from last`;
  }, [latestMeasurement, previousMeasurement]);

  const optionalLatestMeasurements = useMemo(() => {
    if (!latestMeasurement) {
      return [];
    }

    const values: Array<{ label: string; value: string }> = [];

    if (latestMeasurement.body_fat_percent !== null) {
      values.push({
        label: 'Body fat',
        value: `${formatDecimal(Number(latestMeasurement.body_fat_percent))}%`,
      });
    }

    for (const [label, value] of [
      ['Waist', latestMeasurement.waist_cm],
      ['Hips', latestMeasurement.hips_cm],
      ['Chest', latestMeasurement.chest_cm],
      ['Arm', latestMeasurement.arm_cm],
      ['Thigh', latestMeasurement.thigh_cm],
    ] as const) {
      if (value !== null) {
        values.push({
          label,
          value: `${formatDecimal(centimetersToInches(Number(value)))} in`,
        });
      }
    }

    return values;
  }, [latestMeasurement]);

  function resetMeasurementForm() {
    setMeasurementDate(getLocalDateInputValue());
    setWeight('');
    setBodyFat('');
    setWaist('');
    setHips('');
    setChest('');
    setArm('');
    setThigh('');
  }

  async function handleSaveMeasurement() {
    setIsSavingMeasurement(true);

    try {
      const userId = await getBodyMeasurementOwnerUserId();
      const parsedBodyFat = parseOptionalPercentage(bodyFat);

      saveBodyMeasurement({
        userId,
        measuredAt: parseMeasurementDate(measurementDate),
        weightKg: poundsToKilograms(parseRequiredNumber(weight, 'Weight')),
        bodyFatPercent: parsedBodyFat,
        waistCm:
          waist.trim() === ''
            ? null
            : inchesToCentimeters(parseRequiredNumber(waist, 'Waist')),
        hipsCm:
          hips.trim() === ''
            ? null
            : inchesToCentimeters(parseRequiredNumber(hips, 'Hips')),
        chestCm:
          chest.trim() === ''
            ? null
            : inchesToCentimeters(parseRequiredNumber(chest, 'Chest')),
        armCm:
          arm.trim() === ''
            ? null
            : inchesToCentimeters(parseRequiredNumber(arm, 'Arm')),
        thighCm:
          thigh.trim() === ''
            ? null
            : inchesToCentimeters(parseRequiredNumber(thigh, 'Thigh')),
      });

      await loadLocalMeasurements();
      setIsMeasurementOpen(false);
      resetMeasurementForm();

      void syncPendingBodyMeasurements().catch((error) => {
        reportError(error, {
          source: 'progress-screen',
          operation: 'sync-after-save',
          domain: 'progress',
        });
      });

      Alert.alert('Measurement saved', 'Your weight trend has been updated.');
    } catch (error) {
      reportError(error, {
        source: 'progress-screen',
        operation: 'save-measurement',
        domain: 'progress',
      });
      Alert.alert('Unable to save measurement', 'Check the measurement values and try again.');
    } finally {
      setIsSavingMeasurement(false);
    }
  }

  return (
    <>
      <Screen>
        <View className="gap-5">
          <View className="gap-2">
            <Text className="text-base font-bold uppercase tracking-widest text-primary">
              Growth
            </Text>
            <Text className="text-4xl font-display text-base-content">Progress</Text>
            <Text className="text-sm font-body leading-6 text-base-muted">
              Weight, measurements, goals, streaks, and training trends.
            </Text>
          </View>

          <View className="flex-row gap-3">
            <MetricCard
              label="Weight"
              value={latestMeasurement ? formatWeight(latestMeasurement.weight_kg) : '—'}
              subtext={weightSubtext}
            />
            <MetricCard
              label="Workout streak"
              value={`${sessions.length} days`}
              subtext="Recent"
              progress={Math.min(1, sessions.length / 7)}
            />
          </View>

          <Card className="gap-4">
            <SectionHeader eyebrow="Body weight" title="Trend" />
            {measurements.length === 0 ? (
              <EmptyState
                title="No weight logged"
                message="Log your first measurement to start a real weight trend."
                action={
                  <Button
                    title="Log measurement"
                    onPress={() => setIsMeasurementOpen(true)}
                    size="sm"
                  />
                }
              />
            ) : (
              <>
                <WeightChart data={chartPoints} />
                <Text className="text-sm font-bold text-base-muted">
                  {formatWeight(measurements[0].weight_kg)} to{' '}
                  {formatWeight(latestMeasurement!.weight_kg)}
                </Text>
              </>
            )}
          </Card>

          <View className="gap-3">
            <SectionHeader eyebrow="Personal records" title="Strength highlights" />
            {records.length > 0 ? (
              <PRCard records={records} />
            ) : (
              <EmptyState
                title="No strength records yet"
                message="Complete weighted sets to build personal-record highlights."
              />
            )}
          </View>

          <Card className="gap-3">
            <SectionHeader title="Measurements" />
            <Text className="text-sm font-body leading-6 text-base-muted">
              Weight is required. Body fat, waist, hips, chest, arms, and thighs are
              optional.
            </Text>
            {latestMeasurement ? (
              <Text className="text-sm font-bold text-base-content">
                Latest: {formatMeasurementDate(latestMeasurement.measured_at)}
              </Text>
            ) : null}
            {optionalLatestMeasurements.length > 0 ? (
              <View className="flex-row flex-wrap gap-3">
                {optionalLatestMeasurements.map((measurement) => (
                  <OptionalMeasurement
                    key={measurement.label}
                    label={measurement.label}
                    value={measurement.value}
                  />
                ))}
              </View>
            ) : null}
            <Button
              title="Log measurement"
              onPress={() => setIsMeasurementOpen(true)}
              variant="outline"
            />
          </Card>
        </View>
      </Screen>

      <Modal
        animationType="slide"
        visible={isMeasurementOpen}
        onRequestClose={() => setIsMeasurementOpen(false)}
      >
        <View className="flex-1 bg-base-100">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="px-5 pt-5 pb-12"
          >
            <View className="gap-5">
              <View className="gap-2">
                <Text className="text-4xl font-display text-base-content">
                  Log measurement
                </Text>
                <Text className="text-sm font-body leading-6 text-base-muted">
                  Enter weight in pounds. Optional circumference fields use inches.
                </Text>
              </View>

              <Card variant="highlighted" className="gap-4">
                <Input
                  label="Date"
                  value={measurementDate}
                  onChangeText={setMeasurementDate}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                  hint="Measurements are sorted by this date."
                />
                <Input
                  label="Weight (lb)"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="170"
                  autoFocus
                />
              </Card>

              <Card className="gap-4">
                <SectionHeader title="Optional details" />
                <Input
                  label="Body fat (%)"
                  value={bodyFat}
                  onChangeText={setBodyFat}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="18"
                />
                <View className="flex-row gap-3">
                  <Input
                    label="Waist (in)"
                    value={waist}
                    onChangeText={setWaist}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    placeholder="32"
                    containerClassName="flex-1"
                  />
                  <Input
                    label="Hips (in)"
                    value={hips}
                    onChangeText={setHips}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    placeholder="38"
                    containerClassName="flex-1"
                  />
                </View>
                <View className="flex-row gap-3">
                  <Input
                    label="Chest (in)"
                    value={chest}
                    onChangeText={setChest}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    placeholder="40"
                    containerClassName="flex-1"
                  />
                  <Input
                    label="Arm (in)"
                    value={arm}
                    onChangeText={setArm}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    placeholder="14"
                    containerClassName="flex-1"
                  />
                </View>
                <Input
                  label="Thigh (in)"
                  value={thigh}
                  onChangeText={setThigh}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="22"
                />
              </Card>

              <View className="gap-3">
                <Button
                  title="Save measurement"
                  onPress={handleSaveMeasurement}
                  loading={isSavingMeasurement}
                />
                <Button
                  title="Cancel"
                  onPress={() => setIsMeasurementOpen(false)}
                  variant="ghost"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
