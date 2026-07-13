import Constants from 'expo-constants';
import { Platform } from 'react-native';

const expoConfig = Constants.expoConfig;
const appSlug = expoConfig?.slug ?? 'all-in-one-fitness';
const appVersion = expoConfig?.version ?? '0.0.0';
const buildNumber =
  Platform.OS === 'ios'
    ? expoConfig?.ios?.buildNumber
    : expoConfig?.android?.versionCode?.toString();

export const APP_ENVIRONMENT =
  process.env.EXPO_PUBLIC_APP_ENV?.trim() || (__DEV__ ? 'development' : 'production');

export const APP_RELEASE =
  process.env.EXPO_PUBLIC_APP_RELEASE?.trim() || `${appSlug}@${appVersion}`;

export const APP_DISTRIBUTION =
  process.env.EXPO_PUBLIC_APP_DIST?.trim() || buildNumber || 'unversioned';

export const RUNTIME_METADATA = {
  environment: APP_ENVIRONMENT,
  release: APP_RELEASE,
  distribution: APP_DISTRIBUTION,
  appVersion,
  platform: Platform.OS,
} as const;
