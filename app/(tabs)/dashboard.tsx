import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/src/components/Card';
import { MetricCard } from '@/src/components/MetricCard';
import { Screen } from '@/src/components/Screen';
import {
  DEFAULT_DAILY_TARGETS,
  getDailyNutritionSummary,
  getDailyTargets,
  subscribeToNutritionLogChanges,
  type DailyNutritionSummary,
  type DailyTargets,
} from '@/src/features/nutrition/nutrition-service';

const emptySummary: DailyNutritionSummary = {
  entries: [],
  waterLogs: [],
  totals: {
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    waterMl: 0,
  },
};

function formatWholeNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function formatMacro(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatWaterMl(value: number) {
  return (value / 1000).toFixed(value % 1000 === 0 ? 1 : 2);
}

export default function DashboardScreen() {
  const [summary, setSummary] = useState<DailyNutritionSummary>(emptySummary);
  const [targets, setTargets] = useState<DailyTargets>(DEFAULT_DAILY_TARGETS);
  const [hasRemoteTargets, setHasRemoteTargets] = useState(true);
  const [isLoadingTargets, setIsLoadingTargets] = useState(true);

  const refreshSummary = useCallback(() => {
    setSummary(getDailyNutritionSummary());
  }, []);

  const refreshTargets = useCallback(async () => {
    setIsLoadingTargets(true);

    try {
      const nextTargets = await getDailyTargets();
      setTargets(nextTargets.targets);
      setHasRemoteTargets(nextTargets.hasRemoteTargets);
    } finally {
      setIsLoadingTargets(false);
    }
  }, []);

  const refreshDashboard = useCallback(() => {
    refreshSummary();
    void refreshTargets();
  }, [refreshSummary, refreshTargets]);

  useFocusEffect(
    useCallback(() => {
      refreshDashboard();
    }, [refreshDashboard])
  );

  useEffect(() => {
    return subscribeToNutritionLogChanges(refreshSummary);
  }, [refreshSummary]);

  const waterLoggedLabel = formatWaterMl(summary.totals.waterMl);
  const waterTargetLabel = formatWaterMl(targets.waterMl);

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
          <MetricCard
            label="Calories"
            value={`${formatWholeNumber(summary.totals.calories)} / ${formatWholeNumber(
              targets.calories
            )}`}
          />
          <MetricCard
            label="Protein"
            value={`${formatMacro(summary.totals.proteinG)}g / ${formatWholeNumber(
              targets.proteinG
            )}g`}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MetricCard label="Water" value={`${waterLoggedLabel}L / ${waterTargetLabel}L`} />
          <MetricCard label="Steps" value={`0 / ${formatWholeNumber(targets.steps)}`} />
        </View>

        {!hasRemoteTargets ? (
          <Card>
            <Text style={{ fontSize: 18, fontWeight: '800' }}>Set your targets</Text>
            <Text style={{ marginTop: 8, color: '#64748b' }}>
              Using default goals for now: 2,000 calories, 135g protein, 2.0L water,
              and 8,000 steps. Add a daily_targets row to personalize these denominators.
            </Text>
          </Card>
        ) : null}

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Next action</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Log a meal or quick-add water to keep today&apos;s dashboard totals current.
          </Text>
          <Link href="/nutrition" style={{ marginTop: 12, fontWeight: '800' }}>
            Go to nutrition →
          </Link>
        </Card>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>MVP status</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            {isLoadingTargets
              ? 'Loading personalized targets...'
              : 'Logging flows update this checklist as they ship.'}
          </Text>
          <View style={{ marginTop: 12, gap: 8 }}>
            <ChecklistItem label="Auth scaffold" done />
            <ChecklistItem label="Onboarding scaffold" done />
            <ChecklistItem label="Workout logging" done />
            <ChecklistItem label="Nutrition logging" done />
            <ChecklistItem label="Dashboard live totals" done />
            <ChecklistItem label="Wellness logging" />
            <ChecklistItem label="Progress charts" />
            <ChecklistItem label="Offline sync" done />
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
