import * as Crypto from "expo-crypto";

import { reportError } from "@/src/lib/error-reporting";
import { db, type LocalBodyMeasurement } from "@/src/lib/local-db";
import { markSyncPending } from "@/src/lib/sync-events";
import { shouldApplyRemoteRow } from "@/src/lib/sync-conflict.mjs";
import {
  LOCAL_DEV_USER_ID,
  USE_REMOTE_BODY_MEASUREMENT_SYNC,
} from "@/src/lib/runtime-flags";

export type BodyMeasurementRecord = LocalBodyMeasurement;

export type SaveBodyMeasurementInput = {
  userId: string;
  measuredAt?: Date;
  weightKg: number;
  bodyFatPercent?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  chestCm?: number | null;
  armCm?: number | null;
  thighCm?: number | null;
  notes?: string | null;
};

type RemoteBodyMeasurementRow = {
  id: string;
  user_id: string;
  measured_at: string;
  weight_kg: number | string | null;
  body_fat_percent: number | string | null;
  waist_cm: number | string | null;
  hips_cm: number | string | null;
  chest_cm: number | string | null;
  arm_cm: number | string | null;
  thigh_cm: number | string | null;
  notes: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  updated_at: string | null;
};

const POUNDS_PER_KILOGRAM = 2.2046226218;
const CENTIMETERS_PER_INCH = 2.54;
type BodyMeasurementListener = {
  userId: string;
  listener: () => void;
};

const bodyMeasurementListeners = new Set<BodyMeasurementListener>();

export function poundsToKilograms(pounds: number) {
  return pounds / POUNDS_PER_KILOGRAM;
}

export function kilogramsToPounds(kilograms: number) {
  return kilograms * POUNDS_PER_KILOGRAM;
}

export function inchesToCentimeters(inches: number) {
  return inches * CENTIMETERS_PER_INCH;
}

export function centimetersToInches(centimeters: number) {
  return centimeters / CENTIMETERS_PER_INCH;
}

export function subscribeToBodyMeasurementChanges(
  userId: string,
  listener: () => void,
) {
  const registration = { userId, listener };
  bodyMeasurementListeners.add(registration);

  return () => {
    bodyMeasurementListeners.delete(registration);
  };
}

function notifyBodyMeasurementsChanged(userId: string) {
  for (const registration of bodyMeasurementListeners) {
    if (registration.userId === userId) {
      registration.listener();
    }
  }
}

function validateOptionalPositive(
  label: string,
  value: number | null | undefined,
) {
  if (value === null || value === undefined) {
    return;
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }
}

function validateBodyMeasurement(input: SaveBodyMeasurementInput) {
  if (!input.userId.trim()) {
    throw new Error("A measurement owner is required.");
  }

  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    throw new Error("Weight must be greater than 0.");
  }

  if (
    input.bodyFatPercent !== null &&
    input.bodyFatPercent !== undefined &&
    (!Number.isFinite(input.bodyFatPercent) ||
      input.bodyFatPercent < 0 ||
      input.bodyFatPercent > 100)
  ) {
    throw new Error("Body fat must be between 0 and 100.");
  }

  validateOptionalPositive("Waist", input.waistCm);
  validateOptionalPositive("Hips", input.hipsCm);
  validateOptionalPositive("Chest", input.chestCm);
  validateOptionalPositive("Arm", input.armCm);
  validateOptionalPositive("Thigh", input.thighCm);

  const measuredAt = input.measuredAt ?? new Date();

  if (!Number.isFinite(measuredAt.getTime())) {
    throw new Error("Use a valid measurement date.");
  }
}

function nullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getBodyMeasurementOwnerUserId() {
  if (!USE_REMOTE_BODY_MEASUREMENT_SYNC) {
    return LOCAL_DEV_USER_ID;
  }

  const { supabase } = await import("@/src/lib/supabase");
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.id) {
    if (error) {
      reportError(error, {
        source: "body-measurements-service",
        operation: "resolve-owner",
        domain: "progress",
      });
    }
    throw new Error("Sign in before logging cloud-synced measurements.");
  }

  return data.user.id;
}

export function getBodyMeasurementHistory(
  userId: string,
): BodyMeasurementRecord[] {
  return db.getAllSync<BodyMeasurementRecord>(
    `
    select *
    from body_measurements_local
    where user_id = ?
      and coalesce(is_deleted, 0) = 0
      and deleted_at is null
    order by measured_at asc, updated_at asc
    `,
    [userId],
  );
}

export function getLatestBodyMeasurement(
  userId: string,
): BodyMeasurementRecord | null {
  const rows = db.getAllSync<BodyMeasurementRecord>(
    `
    select *
    from body_measurements_local
    where user_id = ?
      and coalesce(is_deleted, 0) = 0
      and deleted_at is null
    order by measured_at desc, updated_at desc
    limit 1
    `,
    [userId],
  );

  return rows[0] ?? null;
}

export function saveBodyMeasurement(
  input: SaveBodyMeasurementInput,
): BodyMeasurementRecord {
  validateBodyMeasurement(input);

  const localId = Crypto.randomUUID();
  const measuredAt = (input.measuredAt ?? new Date()).toISOString();
  const updatedAt = new Date().toISOString();

  db.runSync(
    `
    insert into body_measurements_local (
      local_id,
      server_id,
      user_id,
      measured_at,
      weight_kg,
      body_fat_percent,
      waist_cm,
      hips_cm,
      chest_cm,
      arm_cm,
      thigh_cm,
      notes,
      is_deleted,
      deleted_at,
      sync_status,
      updated_at
    )
    values (?, null, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, null, 'pending', ?)
    `,
    [
      localId,
      input.userId,
      measuredAt,
      input.weightKg,
      input.bodyFatPercent ?? null,
      input.waistCm ?? null,
      input.hipsCm ?? null,
      input.chestCm ?? null,
      input.armCm ?? null,
      input.thighCm ?? null,
      input.notes?.trim() || null,
      updatedAt,
    ],
  );

  const saved = db.getAllSync<BodyMeasurementRecord>(
    `
    select *
    from body_measurements_local
    where local_id = ?
    limit 1
    `,
    [localId],
  )[0];

  if (!saved) {
    throw new Error("The measurement could not be read after saving.");
  }

  notifyBodyMeasurementsChanged(input.userId);
  markSyncPending('progress');
  return saved;
}

export function deleteBodyMeasurement(userId: string, localId: string) {
  const now = new Date().toISOString();
  db.runSync(
    `
    update body_measurements_local
    set is_deleted = 1,
        deleted_at = ?,
        sync_status = 'pending',
        updated_at = ?
    where user_id = ? and local_id = ? and coalesce(is_deleted, 0) = 0
    `,
    [now, now, userId, localId],
  );
  notifyBodyMeasurementsChanged(userId);
  markSyncPending('progress');
}

function markBodyMeasurementSynced(localId: string, serverId: string) {
  db.runSync(
    `
    update body_measurements_local
    set server_id = ?,
        sync_status = 'synced'
    where local_id = ?
    `,
    [serverId, localId],
  );
}

function markBodyMeasurementFailed(localId: string) {
  db.runSync(
    `
    update body_measurements_local
    set sync_status = 'failed'
    where local_id = ?
    `,
    [localId],
  );
}

function importRemoteBodyMeasurement(
  row: RemoteBodyMeasurementRow,
  existing: BodyMeasurementRecord | undefined,
) {
  const updatedAt = row.updated_at ?? row.deleted_at ?? row.measured_at;
  if (!shouldApplyRemoteRow(existing, updatedAt)) return;

  db.runSync(
    `
    replace into body_measurements_local (
      local_id, server_id, user_id, measured_at, weight_kg, body_fat_percent,
      waist_cm, hips_cm, chest_cm, arm_cm, thigh_cm, notes, is_deleted,
      deleted_at, sync_status, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
    `,
    [
      existing?.local_id ?? String(row.id),
      String(row.id),
      row.user_id,
      row.measured_at,
      nullableNumber(row.weight_kg) ?? 0,
      nullableNumber(row.body_fat_percent),
      nullableNumber(row.waist_cm),
      nullableNumber(row.hips_cm),
      nullableNumber(row.chest_cm),
      nullableNumber(row.arm_cm),
      nullableNumber(row.thigh_cm),
      row.notes,
      row.is_deleted ? 1 : 0,
      row.deleted_at,
      updatedAt,
    ],
  );
}

export async function refreshBodyMeasurementsFromRemote(userId: string) {
  if (!USE_REMOTE_BODY_MEASUREMENT_SYNC) {
    return;
  }

  const { supabase } = await import("@/src/lib/supabase");
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || authData.user?.id !== userId) {
    if (authError) {
      reportError(authError, {
        source: "body-measurements-service",
        operation: "resolve-refresh-owner",
        domain: "progress",
      });
    }
    throw new Error("Measurements can only be loaded for the signed-in user.");
  }

  const { data, error } = await supabase
    .from("body_measurements")
    .select(
      "id, user_id, measured_at, weight_kg, body_fat_percent, waist_cm, hips_cm, chest_cm, arm_cm, thigh_cm, notes, is_deleted, deleted_at, updated_at",
    )
    .eq("user_id", userId)
    .order("measured_at", { ascending: true });

  if (error) {
    reportError(error, {
      source: "body-measurements-service",
      operation: "refresh-measurements",
      domain: "progress",
    });
    throw new Error("Measurements could not be refreshed right now.");
  }

  const localRows = db.getAllSync<BodyMeasurementRecord>(
    'select * from body_measurements_local where user_id = ?',
    [userId],
  );
  const localByRemoteId = new Map<string, BodyMeasurementRecord>();

  for (const localRow of localRows) {
    localByRemoteId.set(localRow.local_id, localRow);

    if (localRow.server_id) {
      localByRemoteId.set(localRow.server_id, localRow);
    }
  }

  for (const row of (data ?? []) as RemoteBodyMeasurementRow[]) {
    const remoteWeight = nullableNumber(row.weight_kg);

    if (!row.is_deleted && !row.deleted_at && (remoteWeight === null || remoteWeight <= 0)) {
      continue;
    }

    const existing = localByRemoteId.get(String(row.id));

    if (
      existing?.sync_status === "pending" ||
      existing?.sync_status === "failed"
    ) {
      continue;
    }

    importRemoteBodyMeasurement(row, existing);
  }

  if ((data ?? []).length > 0) {
    notifyBodyMeasurementsChanged(userId);
  }
}

let measurementSyncInFlight: Promise<void> | null = null;
let measurementSyncRequestedWhileInFlight = false;

async function syncPendingBodyMeasurementsImpl() {
  if (!USE_REMOTE_BODY_MEASUREMENT_SYNC) {
    return;
  }

  const { supabase } = await import("@/src/lib/supabase");
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user?.id) {
    if (authError) {
      reportError(authError, {
        source: "body-measurements-service",
        operation: "resolve-sync-owner",
        domain: "progress",
      });
    }
    throw new Error("Sign in before syncing body measurements.");
  }

  const userId = authData.user.id;
  const pendingMeasurements = db.getAllSync<BodyMeasurementRecord>(
    `
    select *
    from body_measurements_local
    where sync_status in ('pending', 'failed')
      and user_id != ?
      and user_id = ?
    order by updated_at asc
    `,
    [LOCAL_DEV_USER_ID, userId],
  );

  for (const measurement of pendingMeasurements) {
    const { data, error } = await supabase
      .from("body_measurements")
      .upsert(
        {
          id: measurement.server_id ?? measurement.local_id,
          user_id: measurement.user_id,
          measured_at: measurement.measured_at,
          weight_kg: measurement.weight_kg,
          body_fat_percent: measurement.body_fat_percent,
          waist_cm: measurement.waist_cm,
          hips_cm: measurement.hips_cm,
          chest_cm: measurement.chest_cm,
          arm_cm: measurement.arm_cm,
          thigh_cm: measurement.thigh_cm,
          notes: measurement.notes,
          is_deleted: Boolean(measurement.is_deleted),
          deleted_at: measurement.deleted_at,
        },
        { onConflict: "id" },
      )
      .select("id")
      .maybeSingle();

    if (error || !data?.id) {
      reportError(error ?? new Error("Measurement provider returned no row."), {
        source: "body-measurements-service",
        operation: "sync-measurement",
        domain: "progress",
      });
      markBodyMeasurementFailed(measurement.local_id);
      continue;
    }

    markBodyMeasurementSynced(measurement.local_id, String(data.id));
  }

  await refreshBodyMeasurementsFromRemote(userId);
}

async function drainBodyMeasurementSyncQueue() {
  do {
    measurementSyncRequestedWhileInFlight = false;
    await syncPendingBodyMeasurementsImpl();
  } while (measurementSyncRequestedWhileInFlight);
}

export function syncPendingBodyMeasurements() {
  if (!USE_REMOTE_BODY_MEASUREMENT_SYNC) {
    return Promise.resolve();
  }

  if (measurementSyncInFlight) {
    measurementSyncRequestedWhileInFlight = true;
    return measurementSyncInFlight;
  }

  measurementSyncInFlight = drainBodyMeasurementSyncQueue().then(
    () => {
      measurementSyncInFlight = null;
    },
    (error) => {
      measurementSyncInFlight = null;
      throw error;
    },
  );

  return measurementSyncInFlight;
}
