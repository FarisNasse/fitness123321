import type { PropsWithChildren } from 'react';
import { View, useColorScheme } from 'react-native';
import { vars } from 'nativewind';

const darkTheme = vars({
  '--color-base-100': '13 17 23',
  '--color-base-200': '22 27 34',
  '--color-base-300': '48 54 61',
  '--color-base-content': '230 237 243',
  '--color-base-muted': '139 148 158',
  '--color-primary': '163 230 53',
  '--color-primary-content': '26 46 5',
  '--color-secondary': '129 140 248',
  '--color-secondary-content': '241 245 249',
  '--color-accent': '249 115 22',
  '--color-accent-content': '255 247 237',
  '--color-success': '74 222 128',
  '--color-warning': '251 191 36',
  '--color-error': '248 113 113',
  '--color-info': '56 189 248',
});

const lightTheme = vars({
  '--color-base-100': '248 250 252',
  '--color-base-200': '255 255 255',
  '--color-base-300': '226 232 240',
  '--color-base-content': '15 23 42',
  '--color-base-muted': '100 116 139',
  '--color-primary': '22 163 74',
  '--color-primary-content': '255 255 255',
  '--color-secondary': '79 70 229',
  '--color-secondary-content': '255 255 255',
  '--color-accent': '234 88 12',
  '--color-accent-content': '255 247 237',
  '--color-success': '22 163 74',
  '--color-warning': '217 119 6',
  '--color-error': '220 38 38',
  '--color-info': '2 132 199',
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const scheme = useColorScheme();
  const theme = scheme === 'light' ? lightTheme : darkTheme;

  return (
    <View style={theme} className="flex-1 bg-base-100">
      {children}
    </View>
  );
}
