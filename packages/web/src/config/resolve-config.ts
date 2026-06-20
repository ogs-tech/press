import { DEFAULT_THEME } from './default-theme';
import type { BuildTimeConfig, PressConfig } from './types';

/**
 * Normalizes the `theme` union (string sugar | object | absent) into the
 * build-time theme slice: `name` (defaulted to DEFAULT_THEME.name) and `fonts`
 * (overrides only — font defaults live in next/font, so an absent key is
 * intentional). Colour/radius VALUES are NOT here anymore; they resolve at
 * runtime over DEFAULT_THEME in mapSiteSettings.
 */
function resolveTheme(theme: PressConfig['theme']): BuildTimeConfig['theme'] {
  const t = typeof theme === 'string' ? { name: theme } : theme ?? {};
  return {
    name: t.name ?? DEFAULT_THEME.name,
    fonts: { ...(t.fonts ?? {}) },
  };
}

/**
 * Resolves press.config.ts into the deterministic BUILD-TIME slice
 * (site-settings-cms spec §6). Pure: same input → same output, no I/O, no
 * mutation — safe to hold as an immutable module constant under RSC/SSR. The full
 * ResolvedPressConfig (identity/SEO/theme values) is produced at runtime by
 * getSiteConfig, NOT here.
 */
export function resolveConfig(config: PressConfig): BuildTimeConfig {
  return {
    routes: { home: config.routes?.home ?? 'home' },
    theme: resolveTheme(config.theme),
  };
}
