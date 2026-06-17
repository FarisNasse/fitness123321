import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { MetricCard } from '@/src/components/MetricCard';
import { PRCard } from '@/src/components/PRCard';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { WeightChart } from '@/src/components/WeightChart';
import { getSeededExercises } from '@/src/features/workouts/exercise-service';
import { estimatedOneRepMax } from '@/src/features/workouts/pr-service';
import {
  getCompletedWorkoutSessions,
  getLocalWorkoutSets,
  type LocalWorkoutSessionRow,
} from '@/src/features/workouts/workout-service';

type PersonalRecord = {
  exercise: string;
  value: string;
};

export default function ProgressScreen() {
  const [sessions, setSessions] = useState<LocalWorkoutSessionRow[]>([]);
  const exercises = useMemo(() => getSeededExercises(), []);

  useFocusEffect(
    useCallback(() => {
      setSessions(getCompletedWorkoutSessions(12));
    }, [])
  );

  const records = useMemo<PersonalRecord[]>(() => {
    const exerciseLookup = Object.fromEntries(
      exercises.map((exercise) => [exercise.id, exercise.name])
    );
    const bestByExercise = new Map<string, number>();

    for (const session of sessions) {
      for (const set of getLocalWorkoutSets(session.local_id)) {
        const reps = Number(set.reps);
        const weight = Number(set.weight);

        if (!Number.isFinite(reps) || !Number.isFinite(weight) || reps <= 0) {
          continue;
        }

        const estimate = estimatedOneRepMax(weight, reps);
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

  const prRecords =
    records.length > 0
      ? records
      : [
          { exercise: 'Bench Press', value: '225 lb est. 1RM' },
          { exercise: 'Squat', value: '315 lb est. 1RM' },
        ];

  return (
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
          <MetricCard label="Weight" value="170 lb" subtext="Down 5 lb" trend="down" />
          <MetricCard
            label="Workout streak"
            value={`${sessions.length} days`}
            subtext="Recent"
            progress={Math.min(1, sessions.length / 7)}
          />
        </View>

        <Card className="gap-4">
          <SectionHeader eyebrow="Body weight" title="Trend" />
          <WeightChart />
          <Text className="text-sm font-bold text-base-muted">175 lb to 170 lb</Text>
        </Card>

        <View className="gap-3">
          <SectionHeader eyebrow="Personal records" title="Strength highlights" />
          <PRCard records={prRecords} />
        </View>

        <Card className="gap-3">
          <SectionHeader title="Measurements" />
          <Text className="text-sm font-body leading-6 text-base-muted">
            Add weight, body fat, waist, hips, chest, arms, and thighs.
          </Text>
          <Button title="Log measurement" onPress={() => {}} variant="outline" />
        </Card>
      </View>
    </Screen>
  );
}
