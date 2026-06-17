const withOpacity = (variableName) => {
  return ({ opacityValue }) => {
    if (opacityValue === undefined) {
      return `rgb(var(${variableName}))`;
    }

    return `rgb(var(${variableName}) / ${opacityValue})`;
  };
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'base-100': withOpacity('--color-base-100'),
        'base-200': withOpacity('--color-base-200'),
        'base-300': withOpacity('--color-base-300'),
        'base-content': withOpacity('--color-base-content'),
        'base-muted': withOpacity('--color-base-muted'),
        primary: withOpacity('--color-primary'),
        'primary-content': withOpacity('--color-primary-content'),
        secondary: withOpacity('--color-secondary'),
        'secondary-content': withOpacity('--color-secondary-content'),
        accent: withOpacity('--color-accent'),
        'accent-content': withOpacity('--color-accent-content'),
        success: withOpacity('--color-success'),
        warning: withOpacity('--color-warning'),
        error: withOpacity('--color-error'),
        info: withOpacity('--color-info'),
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
