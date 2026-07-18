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
 *
 * `container` and `gridGap` are added for the layout primitives (Spec §6.2).
 * Values are duplicated literals (not `var()`-referenced against
 * `--press-space-*`) because FIXED_TOKENS is the source of truth and
 * cross-referencing token scales makes future edits fragile — the
 * `= space-N literal` comments are the coordination hints.
 */
export const FIXED_TOKENS: {
  space: readonly string[]; // index 0 → --press-space-1
  text: Record<string, string>;
  radiusPill: string;
  container: {
    widths: Record<'prose' | 'sm' | 'md' | 'lg' | 'xl', string>;
    paddingX: string;
  };
  gridGap: Record<'sm' | 'md' | 'lg', string>;
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
  container: {
    widths: { prose: '72ch', sm: '640px', md: '768px', lg: '1024px', xl: '1280px' },
    paddingX: '24px', // = space-5 literal
  },
  gridGap: { sm: '12px', md: '24px', lg: '48px' }, // = space-3/5/7 literals
};
