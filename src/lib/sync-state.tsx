import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { syncPendingNutritionLogs } from '@/src/features/nutrition/nutrition-service';
import { syncPendingBodyMeasurements } from '@/src/features/progress/body-measurements-service';
import { syncPendingWellnessCheckIns } from '@/src/features/wellness/wellness-service';
import { syncPendingWorkoutSessions } from '@/src/features/workouts/workout-service';
import { reportError } from '@/src/lib/error-reporting';
import { getOwnerSyncBacklog } from '@/src/lib/local-db';
import { useNetworkState } from '@/src/lib/network-state';
import {
  USE_REMOTE_BODY_MEASUREMENT_SYNC,
  USE_REMOTE_NUTRITION_SYNC,
  USE_REMOTE_WELLNESS_SYNC,
  USE_REMOTE_WORKOUT_SYNC,
} from '@/src/lib/runtime-flags';
import {
  subscribeToSyncPending,
  type SyncDomain,
} from '@/src/lib/sync-events';

export type SyncPhase = 'local' | 'idle' | 'pending' | 'syncing' | 'synced' | 'failed';

export type DomainSyncState = {
  phase: SyncPhase;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
};

export type OverallSyncStatus =
  | 'local'
  | 'idle'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'offline';

export type SyncStateValue = {
  domains: Record<SyncDomain, DomainSyncState>;
  overallStatus: OverallSyncStatus;
  retryAll: () => Promise<void>;
  retryDomain: (domain: SyncDomain) => Promise<void>;
};

type SyncStateProviderProps = PropsWithChildren<{
  canSync: boolean;
  ownerId: string | null;
}>;

type BacklogCounts = {
  pending: number;
  failed: number;
};

const domainRemoteEnabled: Record<SyncDomain, boolean> = {
  workouts: USE_REMOTE_WORKOUT_SYNC,
  nutrition: USE_REMOTE_NUTRITION_SYNC,
  wellness: USE_REMOTE_WELLNESS_SYNC,
  progress: USE_REMOTE_BODY_MEASUREMENT_SYNC,
};

const syncHandlers: Record<SyncDomain, () => Promise<void>> = {
  workouts: syncPendingWorkoutSessions,
  nutrition: syncPendingNutritionLogs,
  wellness: syncPendingWellnessCheckIns,
  progress: syncPendingBodyMeasurements,
};

function makeInitialDomainState(domain: SyncDomain): DomainSyncState {
  return {
    phase: domainRemoteEnabled[domain] ? 'idle' : 'local',
    lastAttemptAt: null,
    lastSuccessAt: null,
  };
}

const initialDomains: Record<SyncDomain, DomainSyncState> = {
  workouts: makeInitialDomainState('workouts'),
  nutrition: makeInitialDomainState('nutrition'),
  wellness: makeInitialDomainState('wellness'),
  progress: makeInitialDomainState('progress'),
};

const SyncStateContext = createContext<SyncStateValue | null>(null);

function getDomainBacklog(domain: SyncDomain, ownerId: string | null): BacklogCounts {
  if (!ownerId) {
    return { pending: 0, failed: 0 };
  }

  return getOwnerSyncBacklog(ownerId)[domain];
}

function getOverallStatus(
  domains: Record<SyncDomain, DomainSyncState>,
  isOffline: boolean
): OverallSyncStatus {
  const remoteStates = (Object.keys(domains) as SyncDomain[])
    .filter((domain) => domainRemoteEnabled[domain])
    .map((domain) => domains[domain].phase);

  if (isOffline) return 'offline';
  if (remoteStates.length === 0) return 'local';
  if (remoteStates.includes('failed')) return 'failed';
  if (remoteStates.includes('syncing')) return 'syncing';
  if (remoteStates.includes('pending')) return 'pending';
  if (remoteStates.every((phase) => phase === 'synced')) return 'synced';
  return 'idle';
}

export function SyncStateProvider({ children, canSync, ownerId }: SyncStateProviderProps) {
  const { status: networkStatus } = useNetworkState();
  const [domains, setDomains] = useState(initialDomains);
  const activeSyncsRef = useRef<Partial<Record<SyncDomain, Promise<void>>>>({});
  const canSyncRef = useRef(canSync);
  const networkStatusRef = useRef(networkStatus);
  const ownerIdRef = useRef(ownerId);
  const ownerGenerationRef = useRef(0);

  useEffect(() => {
    canSyncRef.current = canSync;
  }, [canSync]);

  useEffect(() => {
    networkStatusRef.current = networkStatus;
  }, [networkStatus]);

  useEffect(() => {
    ownerIdRef.current = ownerId;
    ownerGenerationRef.current += 1;
    activeSyncsRef.current = {};
    setDomains({
      workouts: makeInitialDomainState('workouts'),
      nutrition: makeInitialDomainState('nutrition'),
      wellness: makeInitialDomainState('wellness'),
      progress: makeInitialDomainState('progress'),
    });
  }, [ownerId]);

  const setDomainPhase = useCallback(
    (domain: SyncDomain, phase: SyncPhase, options?: { succeeded?: boolean }) => {
      const now = new Date().toISOString();

      setDomains((current) => ({
        ...current,
        [domain]: {
          ...current[domain],
          phase,
          lastAttemptAt: phase === 'syncing' ? now : current[domain].lastAttemptAt,
          lastSuccessAt: options?.succeeded ? now : current[domain].lastSuccessAt,
        },
      }));
    },
    []
  );

  const retryDomain = useCallback(
    async (domain: SyncDomain) => {
      if (!domainRemoteEnabled[domain]) {
        setDomainPhase(domain, 'local');
        return;
      }

      if (!ownerIdRef.current || !canSyncRef.current || networkStatusRef.current !== 'online') {
        setDomainPhase(domain, 'pending');
        return;
      }

      const existing = activeSyncsRef.current[domain];
      if (existing) {
        return existing;
      }

      const syncOwnerId = ownerIdRef.current;
      const syncGeneration = ownerGenerationRef.current;
      const isCurrentOwner = () =>
        ownerGenerationRef.current === syncGeneration && ownerIdRef.current === syncOwnerId;

      const syncPromise = (async () => {
        setDomainPhase(domain, 'syncing');

        try {
          await syncHandlers[domain]();

          if (!isCurrentOwner()) return;

          const backlog = getDomainBacklog(domain, syncOwnerId);

          if (backlog.failed > 0) {
            setDomainPhase(domain, 'failed');
          } else if (backlog.pending > 0) {
            setDomainPhase(domain, 'pending');
          } else {
            setDomainPhase(domain, 'synced', { succeeded: true });
          }
        } catch (error) {
          if (!isCurrentOwner()) return;

          setDomainPhase(domain, 'failed');
          reportError(error, {
            source: 'sync-state-provider',
            operation: 'sync-pending-records',
            domain,
          });
        }
      })();

      activeSyncsRef.current[domain] = syncPromise;
      void syncPromise.finally(() => {
        if (activeSyncsRef.current[domain] === syncPromise) {
          delete activeSyncsRef.current[domain];
        }
      });
      return syncPromise;
    },
    [setDomainPhase]
  );

  const retryAll = useCallback(async () => {
    const remoteDomains = (Object.keys(domainRemoteEnabled) as SyncDomain[]).filter(
      (domain) => domainRemoteEnabled[domain]
    );

    await Promise.all(remoteDomains.map((domain) => retryDomain(domain)));
  }, [retryDomain]);

  useEffect(() => {
    return subscribeToSyncPending((domain) => {
      if (!domainRemoteEnabled[domain]) {
        setDomainPhase(domain, 'local');
        return;
      }

      setDomainPhase(domain, 'pending');

      if (canSyncRef.current && networkStatusRef.current === 'online') {
        void retryDomain(domain);
      }
    });
  }, [retryDomain, setDomainPhase]);

  useEffect(() => {
    if (ownerId && canSync && networkStatus === 'online') {
      void retryAll();
    }
  }, [canSync, networkStatus, ownerId, retryAll]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          void retryAll();
        }
      }
    );

    return () => subscription.remove();
  }, [retryAll]);

  const value = useMemo(
    () => ({
      domains,
      overallStatus: getOverallStatus(domains, networkStatus === 'offline'),
      retryAll,
      retryDomain,
    }),
    [domains, networkStatus, retryAll, retryDomain]
  );

  return <SyncStateContext.Provider value={value}>{children}</SyncStateContext.Provider>;
}

export function useSyncState() {
  const value = useContext(SyncStateContext);

  if (!value) {
    throw new Error('useSyncState must be used inside SyncStateProvider.');
  }

  return value;
}
