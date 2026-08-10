export type SyncConflictRow = {
  sync_status?: string | null;
  updated_at?: string | null;
};
export function latestSyncTimestamp(...values: Array<string | null | undefined>): string;
export function shouldApplyRemoteRow(
  localRow: SyncConflictRow | null | undefined,
  remoteUpdatedAt: string | null | undefined
): boolean;
