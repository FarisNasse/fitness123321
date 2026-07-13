const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

// Start from Sentry's Expo-aware Metro config. This lets Expo add bundle Debug IDs
// before asset serialization instead of wrapping NativeWind's custom serializer.
const config = getSentryExpoConfig(__dirname);

config.resolver.assetExts = Array.from(
  new Set([...config.resolver.assetExts, 'wasm'])
);

module.exports = withNativeWind(config, { input: './global.css' });
