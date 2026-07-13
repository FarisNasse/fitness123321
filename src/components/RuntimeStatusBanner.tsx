import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useNetworkState } from '@/src/lib/network-state';
import { useSyncState } from '@/src/lib/sync-state';
import { colors } from '@/src/lib/theme';

export function RuntimeStatusBanner() {
  const { status: networkStatus } = useNetworkState();
  const { overallStatus, retryAll } = useSyncState();

  if (
    networkStatus !== 'offline' &&
    overallStatus !== 'failed' &&
    overallStatus !== 'pending' &&
    overallStatus !== 'syncing'
  ) {
    return null;
  }

  if (networkStatus === 'offline') {
    return (
      <View
        accessibilityRole="alert"
        className="flex-row items-center gap-3 border-b border-warning/40 bg-warning/15 px-4 py-3"
      >
        <Ionicons name="cloud-offline-outline" size={20} color={colors.warning} />
        <View className="flex-1">
          <Text className="text-sm font-bold text-base-content">You’re offline</Text>
          <Text className="text-xs font-body leading-5 text-base-muted">
            Logging stays available. Saved changes will sync when your connection returns.
          </Text>
        </View>
      </View>
    );
  }

  if (overallStatus === 'failed') {
    return (
      <View
        accessibilityRole="alert"
        className="flex-row items-center gap-3 border-b border-error/40 bg-error/15 px-4 py-3"
      >
        <Ionicons name="warning-outline" size={20} color={colors.error} />
        <View className="flex-1">
          <Text className="text-sm font-bold text-base-content">Some changes need another try</Text>
          <Text className="text-xs font-body leading-5 text-base-muted">
            Your records remain saved on this device.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => void retryAll()}
          className="rounded-pill border border-error/50 px-3 py-2 active:opacity-70"
        >
          <Text className="text-xs font-bold text-error">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-3 border-b border-info/30 bg-info/10 px-4 py-2.5">
      <ActivityIndicator size="small" color={colors.info} />
      <Text className="flex-1 text-xs font-bold text-base-muted">
        {overallStatus === 'pending' ? 'Changes are saved and waiting to sync.' : 'Syncing saved changes…'}
      </Text>
    </View>
  );
}
