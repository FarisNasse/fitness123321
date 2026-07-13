module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: 'nativewind',
          // NativeWind v4 already adds react-native-worklets/plugin. Disable
          // Expo's automatic copy so native bundles run the transform once.
          reanimated: false,
          worklets: false,
        },
      ],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module-resolver',
        { alias: { '@': './' } },
      ],
    ],
  };
};
