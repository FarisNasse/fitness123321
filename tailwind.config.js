const withOpacity = (variableName, fallback) => {
  return ({ opacityValue }) => {
    if (opacityValue === undefined) {
      return `rgb(var(${variableName}, ${fallback}))`;
    }

    return `rgb(var(${variableName}, ${fallback}) / ${opacityValue})`;
  };
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'base-100': withOpacity('--color-base-100', '13 17 23'),
        'base-200': withOpacity('--color-base-200', '22 27 34'),
        'base-300': withOpacity('--color-base-300', '48 54 61'),
        'base-content': withOpacity('--color-base-content', '230 237 243'),
        'base-muted': withOpacity('--color-base-muted', '139 148 158'),
        primary: withOpacity('--color-primary', '163 230 53'),
        'primary-content': withOpacity('--color-primary-content', '26 46 5'),
        secondary: withOpacity('--color-secondary', '129 140 248'),
        'secondary-content': withOpacity('--color-secondary-content', '241 245 249'),
        accent: withOpacity('--color-accent', '249 115 22'),
        'accent-content': withOpacity('--color-accent-content', '255 247 237'),
        success: withOpacity('--color-success', '74 222 128'),
        warning: withOpacity('--color-warning', '251 191 36'),
        error: withOpacity('--color-error', '248 113 113'),
        info: withOpacity('--color-info', '56 189 248'),
      },
      fontFamily: {
        display: ['SpaceGrotesk_700Bold', 'System'],
        body: ['Inter_400Regular', 'System'],
        bold: ['Inter_700Bold', 'System'],
        black: ['Inter_900Black', 'System'],
      },
      borderRadius: {
        card: '18px',
        pill: '999px',
        input: '12px',
      },
    },
  },
  plugins: [],
};
