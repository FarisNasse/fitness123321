export const colors = {
  base100: '#0d1117',
  base200: '#161b22',
  base300: '#30363d',
  baseContent: '#e6edf3',
  baseMuted: '#8b949e',
  primary: '#a3e635',
  primaryContent: '#1a2e05',
  secondary: '#818cf8',
  secondaryContent: '#f1f5f9',
  accent: '#f97316',
  accentContent: '#fff7ed',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#38bdf8',
} as const;

export const lightColors = {
  base100: '#f8fafc',
  base200: '#ffffff',
  base300: '#e2e8f0',
  baseContent: '#0f172a',
  baseMuted: '#64748b',
  primary: '#16a34a',
  primaryContent: '#ffffff',
  secondary: '#4f46e5',
  secondaryContent: '#ffffff',
  accent: '#ea580c',
  accentContent: '#fff7ed',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  info: '#0284c7',
} as const;

export type ColorToken = keyof typeof colors;
