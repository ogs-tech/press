import type { ResolvedPressConfig, ThemeColors, ThemeFonts, ThemeRadius } from './types';
import { FIXED_TOKENS } from './default-theme';

/** Resolved colour key → CSS token suffix (`onPrimary` → `on-primary`). */
const COLOR_TOKENS: ReadonlyArray<readonly [keyof ThemeColors, string]> = [
  ['primary', 'primary'],
  ['accent', 'accent'],
  ['secondary', 'secondary'],
  ['ink', 'ink'],
  ['surface', 'surface'],
  ['muted', 'muted'],
  ['danger', 'danger'],
  ['onPrimary', 'on-primary'],
  ['border', 'border'],
];

const FONT_TOKENS: ReadonlyArray<readonly [keyof ThemeFonts, string]> = [
  ['display', 'display'],
  ['body', 'body'],
  ['mono', 'mono'],
];

const RADIUS_KEYS: ReadonlyArray<keyof ThemeRadius> = ['xs', 'sm', 'md', 'lg'];

/**
 * Emits the `:root{ --press-* }` value block from the resolved config — the
 * single injection point for token values (Spec §0). Mirrors `buildSeoMetadata`:
 * pure, same input → same output, safe as an RSC/SSR module constant.
 *
 * Emits all colours, the engine-fixed space/type scales, and the radii. A font
 * token is emitted ONLY when the adopter overrode it (Spec §6) — otherwise
 * `theme.css`'s `var(--press-font-x, var(--press-font-x-default))` fallback uses
 * the `next/font` default. The theme `name` is NEVER emitted (it is selection,
 * reflected on `<html data-theme>` only).
 */
export function buildThemeStyle(resolved: ResolvedPressConfig): string {
  const { colors, fonts, radius } = resolved.theme;
  const lines: string[] = [];

  for (const [key, token] of COLOR_TOKENS) {
    lines.push(`  --press-color-${token}: ${colors[key]};`);
  }
  FIXED_TOKENS.space.forEach((value, i) => {
    lines.push(`  --press-space-${i + 1}: ${value};`);
  });
  for (const [name, value] of Object.entries(FIXED_TOKENS.text)) {
    lines.push(`  --press-text-${name}: ${value};`);
  }
  for (const key of RADIUS_KEYS) {
    lines.push(`  --press-radius-${key}: ${radius[key]};`);
  }
  lines.push(`  --press-radius-pill: ${FIXED_TOKENS.radiusPill};`);
  for (const [key, value] of Object.entries(FIXED_TOKENS.container.widths)) {
    lines.push(`  --press-container-${key}: ${value};`);
  }
  lines.push(`  --press-container-padding-x: ${FIXED_TOKENS.container.paddingX};`);
  for (const [key, value] of Object.entries(FIXED_TOKENS.gridGap)) {
    lines.push(`  --press-grid-gap-${key}: ${value};`);
  }

  for (const [key, token] of FONT_TOKENS) {
    const value = fonts[key];
    if (value) lines.push(`  --press-font-${token}: ${value};`);
  }

  return `:root {\n${lines.join('\n')}\n}`;
}
