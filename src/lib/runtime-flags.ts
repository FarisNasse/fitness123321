export const LOCAL_DEV_USER_ID = '00000000-0000-0000-0000-000000000999';
export const LOCAL_DEV_USER_EMAIL = 'local-dev@example.test';

export const AUTH_MODE = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'local';
export const USE_DEV_AUTH = AUTH_MODE !== 'supabase';

export const USE_REMOTE_WORKOUT_SYNC =
  process.env.EXPO_PUBLIC_WORKOUT_SYNC_SOURCE === 'supabase';

export const USE_REMOTE_NUTRITION_SYNC =
  process.env.EXPO_PUBLIC_NUTRITION_SYNC_SOURCE === 'supabase';

export const USE_REMOTE_WELLNESS_SYNC =
  process.env.EXPO_PUBLIC_WELLNESS_SYNC_SOURCE === 'supabase';

export const USE_REMOTE_BODY_MEASUREMENT_SYNC =
  process.env.EXPO_PUBLIC_BODY_MEASUREMENT_SYNC_SOURCE === 'supabase';

export const USE_SUPABASE_EXERCISES =
  process.env.EXPO_PUBLIC_EXERCISE_SOURCE === 'supabase';

export const FOOD_SOURCE = process.env.EXPO_PUBLIC_FOOD_SOURCE ?? 'local';

export const USE_USDA_FOOD_CATALOG = FOOD_SOURCE === 'usda';

export const USE_SUPABASE_FOODS =
  USE_REMOTE_NUTRITION_SYNC || FOOD_SOURCE === 'supabase' || USE_USDA_FOOD_CATALOG;

export const AUTH_REDIRECT_URL =
  process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim() || null;
