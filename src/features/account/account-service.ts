import { Share } from 'react-native';

import { getDailyTargets } from '@/src/features/nutrition/nutrition-service';
import { syncPendingNutritionLogs } from '@/src/features/nutrition/nutrition-service';
import {
  refreshBodyMeasurementsFromRemote,
  syncPendingBodyMeasurements,
} from '@/src/features/progress/body-measurements-service';
import { syncPendingWellnessCheckIns } from '@/src/features/wellness/wellness-service';
import { syncPendingWorkoutSessions } from '@/src/features/workouts/workout-service';
import { clearLocalUserData, getLocalUserDataSnapshot } from '@/src/lib/local-db';
import { USE_DEV_AUTH } from '@/src/lib/runtime-flags';
import { supabase } from '@/src/lib/supabase';

export async function exportAccountData(userId: string) {
  await Promise.allSettled([
    syncPendingWorkoutSessions(),
    syncPendingNutritionLogs(),
    syncPendingWellnessCheckIns(),
    syncPendingBodyMeasurements(),
  ]);
  await refreshBodyMeasurementsFromRemote(userId).catch(() => undefined);

  const [dailyTargets, localData] = await Promise.all([
    getDailyTargets(),
    Promise.resolve(getLocalUserDataSnapshot(userId)),
  ]);

  const payload = {
    format: 'all-in-one-fitness-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    userId,
    dailyTargets: dailyTargets.targets,
    ...localData,
  };
  const json = JSON.stringify(payload, null, 2);

  await Share.share({
    title: 'Fitness data export',
    message: json,
  });

  return json;
}

export async function deleteAccountPermanently(userId: string) {
  if (USE_DEV_AUTH) {
    throw new Error('Account deletion is disabled while development authentication is active.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || userData.user?.id !== userId) {
    throw userError ?? new Error('The signed-in account could not be verified.');
  }

  const { error } = await supabase.functions.invoke('delete-account', {
    body: { confirmation: 'DELETE' },
  });
  if (error) throw error;

  clearLocalUserData(userId);
  await supabase.auth.signOut({ scope: 'local' });
}
