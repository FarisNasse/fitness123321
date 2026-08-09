const config = {
  name: 'All-In-One Fitness',
  slug: 'all-in-one-fitness',
  owner: 'fk1032004',
  scheme: 'fitnessapp',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#0d1117',
  icon: './assets/icon.png',
  assetBundlePatterns: ['**/*'],

  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.farisnasse.allinonefitness',
  },

  android: {
    package: 'com.farisnasse.allinonefitness',
    icon: './assets/icon.png',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
      backgroundColor: '#0d1117',
    },
  },

  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },

  extra: {
    eas: {
      projectId: '9b6dd253-2592-4b69-84c0-a4c0efd1deef',
    },
  },

  plugins: [
    'expo-router',
    '@sentry/react-native/expo',
    'expo-sqlite',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow All-In-One Fitness to scan food barcodes.',
        recordAudioAndroid: false,
        barcodeScannerEnabled: true,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#0d1117',
      },
    ],
  ],
};

module.exports = config;