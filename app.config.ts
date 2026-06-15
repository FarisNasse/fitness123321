import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'All-In-One Fitness',
  slug: 'all-in-one-fitness',
  scheme: 'fitnessapp',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.example.allinonefitness',
  },
  android: {
    package: 'com.example.allinonefitness',
  },
  web: {
    bundler: 'metro',
  },
  plugins: ['expo-router', 'expo-secure-store', 'expo-sqlite'],
};

export default config;
