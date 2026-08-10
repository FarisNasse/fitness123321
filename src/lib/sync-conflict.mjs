export function latestSyncTimestamp(...values) {
  const valid = values
    .filter((value) => typeof value === 'string' && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return valid[0] ?? new Date(0).toISOString();
}

export function shouldApplyRemoteRow(localRow, remoteUpdatedAt) {
  if (!localRow) return true;
  if (localRow.sync_status === 'pending' || localRow.sync_status === 'failed') return false;

  const localTime = Date.parse(localRow.updated_at ?? '');
  const remoteTime = Date.parse(remoteUpdatedAt ?? '');
  if (!Number.isFinite(remoteTime)) return false;
  if (!Number.isFinite(localTime)) return true;
  return remoteTime >= localTime;
}
