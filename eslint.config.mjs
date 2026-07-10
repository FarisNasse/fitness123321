import js from '@eslint/js';
import reactNative from '@react-native/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    name: 'project/ignores',
    ignores: ['.expo/**', 'coverage/**', 'dist/**', 'node_modules/**', 'web-build/**'],
  },
  {
    ...js.configs.recommended,
    name: 'project/javascript-recommended',
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    name: 'project/runtime-globals',
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    name: 'project/react-native',
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    plugins: {
      ...reactHooks.configs.flat.recommended.plugins,
      '@react-native': reactNative,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      // Screens hydrate SQLite/Supabase state in effects after native resources
      // become available; these are synchronization boundaries, not derived state.
      'react-hooks/set-state-in-effect': 'off',
      '@react-native/no-deep-imports': 'error',
      '@react-native/platform-colors': 'error',
    },
  }
);
