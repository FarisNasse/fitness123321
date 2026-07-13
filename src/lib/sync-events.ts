export type SyncDomain = 'workouts' | 'nutrition' | 'wellness' | 'progress';

type SyncPendingListener = (domain: SyncDomain) => void;

const listeners = new Set<SyncPendingListener>();

export function subscribeToSyncPending(listener: SyncPendingListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function markSyncPending(domain: SyncDomain) {
  for (const listener of listeners) {
    listener(domain);
  }
}
