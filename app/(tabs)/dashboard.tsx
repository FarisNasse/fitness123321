import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { MacroRing } from '@/src/components/MacroRing';
import { MetricCard } from '@/src/components/MetricCard';
import { ProgressBar } from '@/src/components/ProgressBar';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { WeekStrip } from '@/src/components/WeekStrip';
import { useAuthSession } from '@/src/features/auth/auth-session-context';
import {
  DEFAULT_DAILY_TARGETS,
  getDailyNutritionSummary,
  getDailyTargets,
  subscribeToNutritionLogChanges,
  type DailyNutritionSummary,
  type DailyTargets,
} from '@/src/features/nutrition/nutrition-service';
import {
  getDailyWellnessCheckIn,
  getLocalDateKey,
  subscribeToWellnessChanges,
} from '@/src/features/wellness/wellness-service';
import { reportError, reportProviderError } from '@/src/lib/error-reporting';
import { useNetworkState } from '@/src/lib/network-state';
import { USE_DEV_AUTH } from '@/src/lib/runtime-flags';
import { supabase } from '@/src/lib/supabase';

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

function progress(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(1, current / target);
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

export default function DashboardScreen() {
  const { session } = useAuthSession();
  const ownerId = session?.user.id ?? null;
  const [summary, setSummary] = useState<DailyNutritionSummary>(emptySummary);
  const [targets, setTargets] = useState<DailyTargets>(DEFAULT_DAILY_TARGETS);
  const [steps, setSteps] = useState(0);
  const [hasRemoteTargets, setHasRemoteTargets] = useState(true);
  const [isLoadingTargets, setIsLoadingTargets] = useState(true);
  const { status: networkStatus } = useNetworkState();

  const refreshSummary = useCallback(() => {
    setSummary(ownerId ? getDailyNutritionSummary(ownerId) : emptySummary);
  }, [ownerId]);

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

  const refreshWellness = useCallback(async () => {
    try {
      if (!ownerId) {
        setSteps(0);
        return;
      }
      const checkIn = getDailyWellnessCheckIn(ownerId);
      setSteps(Number(checkIn?.steps ?? 0));
    } catch (error) {
      reportError(error, {
        source: 'dashboard-screen',
        operation: 'load-wellness-summary',
        domain: 'wellness',
      });
      setSteps(0);
    }
  }, [ownerId]);

  const refreshDashboard = useCallback(() => {
    refreshSummary();
    void refreshTargets();
    void refreshWellness();
  }, [refreshSummary, refreshTargets, refreshWellness]);

  useFocusEffect(
    useCallback(() => {
      refreshDashboard();
    }, [refreshDashboard])
  );

  useEffect(() => {
    if (!ownerId) return undefined;
    return subscribeToNutritionLogChanges(ownerId, refreshSummary);
  }, [ownerId, refreshSummary]);

  useEffect(() => {
    if (!ownerId) return undefined;
    return subscribeToWellnessChanges(ownerId, (checkIn) => {
      if (checkIn.check_in_date === getLocalDateKey()) {
        setSteps(Number(checkIn.steps ?? 0));
      }
    });
  }, [ownerId]);

  const waterLoggedLabel = formatWaterMl(summary.totals.waterMl);
  const waterTargetLabel = formatWaterMl(targets.waterMl);
  const calorieProgress = progress(summary.totals.calories, targets.calories);
  const proteinProgress = progress(summary.totals.proteinG, targets.proteinG);
  const waterProgress = progress(summary.totals.waterMl, targets.waterMl);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      const message = reportProviderError(
        error,
        { source: 'dashboard-screen', operation: 'sign-out', domain: 'auth' },
        {
          offline: networkStatus === 'offline',
          fallback: 'We couldn’t sign you out. Please try again.',
        }
      );
      Alert.alert('Unable to sign out', message);
      return;
    }

    router.replace('/login');
  }

  return (
    <Screen>
      <View className="gap-5">
        <View className="gap-2">
          <Text className="text-base font-bold uppercase tracking-widest text-primary">
            {getGreeting()}
          </Text>
          <Text className="text-4xl font-display text-base-content">Today</Text>
          <Text className="text-sm font-body leading-6 text-base-muted">
            Your live snapshot across training, nutrition, recovery, and progress.
          </Text>
        </View>

        <Card variant="highlighted" className="gap-5">
          <MacroRing
            calories={calorieProgress}
            protein={proteinProgress}
            water={waterProgress}
          />

          <View className="gap-3">
            <MacroProgress
              label="Calories"
              value={`${formatWholeNumber(summary.totals.calories)} / ${formatWholeNumber(
                targets.calories
              )}`}
              progress={calorieProgress}
            />
            <MacroProgress
              label="Protein"
              value={`${formatMacro(summary.totals.proteinG)}g / ${formatWholeNumber(
                targets.proteinG
              )}g`}
              progress={proteinProgress}
            />
            <MacroProgress
              label="Water"
              value={`${waterLoggedLabel}L / ${waterTargetLabel}L`}
              progress={waterProgress}
            />
          </View>
        </Card>

        <WeekStrip />

        <View className="flex-row gap-3">
          <MetricCard
            label="Calories"
            value={`${formatWholeNumber(summary.totals.calories)} / ${formatWholeNumber(
              targets.calories
            )}`}
            progress={calorieProgress}
          />
          <MetricCard
            label="Protein"
            value={`${formatMacro(summary.totals.proteinG)}g / ${formatWholeNumber(
              targets.proteinG
            )}g`}
            progress={proteinProgress}
          />
        </View>

        <View className="flex-row gap-3">
          <MetricCard label="Water" value={`${waterLoggedLabel}L / ${waterTargetLabel}L`} progress={waterProgress} />
          <MetricCard
            label="Steps"
            value={`${formatWholeNumber(steps)} / ${formatWholeNumber(targets.steps)}`}
            progress={progress(steps, targets.steps)}
          />
        </View>

        {!hasRemoteTargets ? (
          <Card className="gap-2">
            <Text className="text-xl font-bold text-base-content">Today's baseline</Text>
            <Text className="text-sm font-body leading-6 text-base-muted">
              Daily progress is currently measured against 2,000 calories, 135g protein,
              2.0L water, and 8,000 steps.
            </Text>
          </Card>
        ) : null}

        <Card className="gap-4">
          <SectionHeader eyebrow="Quick actions" title="Keep the day moving" />
          <View className="flex-row gap-3">
            <QuickAction href="/nutrition" title="Log meal" subtitle="Macros" />
            <QuickAction href="/workouts" title="Train" subtitle="Start set" />
          </View>
          <View className="flex-row gap-3">
            <QuickAction href="/wellness" title="Check in" subtitle="Recovery" />
            <QuickAction href="/progress" title="Review" subtitle="Trends" />
          </View>
        </Card>

        <Card className="gap-3">
          <Text className="text-xl font-bold text-base-content">Today's momentum</Text>
          <Text className="text-sm font-body leading-6 text-base-muted">
            {isLoadingTargets
              ? 'Loading your daily progress...'
              : 'Complete a few small actions to build a consistent day.'}
          </Text>
          <View className="gap-2">
            <ChecklistItem label="Log a meal" done={summary.entries.length > 0} />
            <ChecklistItem label="Drink water" done={summary.totals.waterMl > 0} />
            <ChecklistItem label="Record activity" done={steps > 0} />
          </View>
        </Card>

        {!USE_DEV_AUTH ? (
          <Card className="gap-3">
            <Text className="text-xl font-bold text-base-content">Account</Text>
            <Text className="text-sm font-body leading-6 text-base-muted">
              Your on-device and cloud-backed records stay associated with this account.
              You can sign back in at any time.
            </Text>
            <Button title="Sign out" variant="outline" onPress={handleSignOut} />
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

function ChecklistItem({ label, done = false }: { label: string; done?: boolean }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className={`h-4 w-4 rounded-pill ${done ? 'bg-primary' : 'bg-base-300'}`} />
      <Text
        className={`text-sm font-bold ${done ? 'text-base-content' : 'text-base-muted'}`}
      >
        {label}
      </Text>
    </View>
  );
}

function MacroProgress({
  label,
  value,
  progress: progressValue,
}: {
  label: string;
  value: string;
  progress: number;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-widest text-base-muted">
          {label}
        </Text>
        <Text className="text-xs font-bold text-base-content">{value}</Text>
      </View>
      <ProgressBar value={progressValue} />
    </View>
  );
}

function QuickAction({
  href,
  title,
  subtitle,
}: {
  href: '/nutrition' | '/workouts' | '/wellness' | '/progress';
  title: string;
  subtitle: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable className="flex-1 rounded-card border border-base-300 bg-base-100 p-4 active:opacity-75">
        <Text className="text-base font-bold text-base-content">{title}</Text>
        <Text className="mt-1 text-xs font-bold uppercase tracking-widest text-base-muted">
          {subtitle}
        </Text>
      </Pressable>
    </Link>
  );
}
