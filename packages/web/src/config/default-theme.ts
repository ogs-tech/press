import type { ThemeColors, ThemeName, ThemeRadius } from './types';

/**
 * The embedded "Default" theme's adopter-overridable token VALUES (Spec §4).
 * Single source of truth: `resolveConfig` fills these over the adopter's partial,
 * and they flow into the `:root` block via `buildThemeStyle`. Values are derived
 * from the OGS brand guidelines but positioned as the engine's neutral default.
 */
export const DEFAULT_THEME: {
  name: ThemeName;
  colors: ThemeColors;
  radius: ThemeRadius;
} = {
  name: 'default',
  colors: {
    primary: '#119350',
    accent: '#D9A12C',
    secondary: '#3D5CC2',
    ink: '#142036',
    surface: '#FAF8F3',
    muted: '#7A7E89',
    danger: '#C0392B',
    onPrimary: '#FFFFFF',
    border: 'rgba(20,32,54,0.12)',
  },
  radius: { xs: '6px', sm: '10px', md: '14px', lg: '20px' },
};

/**
 * Engine-FIXED scales (Spec §4 "derived (fixed)") — NOT adopter-overridable.
 * Emitted as constants by `buildThemeStyle` so all token values still enter
 * through the single `:root` injection point (Spec §0).
 */
export const FIXED_TOKENS: {
  space: readonly string[]; // index 0 → --press-space-1
  text: Record<string, string>;
  radiusPill: string;
} = {
  space: ['4px', '8px', '12px', '16px', '24px', '32px', '48px', '64px', '96px'],
  text: {
    kicker: '12px',
    sm: '14px',
    body: '16px',
    lg: '18px',
    h3: '20px',
    h2: '28px',
    h1: '40px',
  },
  radiusPill: '999px',
};
