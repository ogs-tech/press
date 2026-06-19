import { DEFAULT_THEME } from './default-theme';
import type { PressConfig, ResolvedPressConfig } from './types';

/**
 * Normalizes the `theme` union (string sugar | object | absent) into the total
 * resolved shape. `colors`/`radius` are filled over the Default-theme values
 * (shallow per group); `fonts` is passed through as overrides ONLY — font
 * defaults live in `next/font` (Spec §6), so an absent font key is intentional.
 */
function resolveTheme(theme: PressConfig['theme']): ResolvedPressConfig['theme'] {
  const t = typeof theme === 'string' ? { name: theme } : theme ?? {};
  return {
    name: t.name ?? DEFAULT_THEME.name,
    colors: { ...DEFAULT_THEME.colors, ...(t.colors ?? {}) },
    fonts: { ...(t.fonts ?? {}) },
    radius: { ...DEFAULT_THEME.radius, ...(t.radius ?? {}) },
  };
}

/**
 * Fills engine defaults over the adopter's PressConfig (Spec §4.2). Pure: same
 * input → same output, no I/O, no mutation — so the resolved value is safe to
 * hold as an immutable module constant under RSC/SSR (Spec §11, the Spec 1
 * lesson). Defaults: titleTemplate → '%s', locale → 'en', defaultTitle →
 * brand.name, favicon → '/favicon.ico', routes.home → 'home'; defaultOgImage is resolved ABSOLUTE
 * against site.url when both are present AND site.url is a parseable URL.
 * A malformed site.url (e.g. "localhost:3000" with no scheme) falls through
 * to passthrough — same behaviour as an absent site.url.
 */
export function resolveConfig(config: PressConfig): ResolvedPressConfig {
  const siteUrl = config.site?.url ?? '';
  const ogImage = config.seo?.defaultOgImage;
  const canResolve = Boolean(ogImage && siteUrl && URL.canParse(siteUrl));
  return {
    brand: {
      name: config.brand.name,
      logo: config.brand.logo,
      favicon: config.brand.favicon ?? '/favicon.ico',
    },
    site: {
      url: siteUrl,
      locale: config.site?.locale ?? 'en',
    },
    seo: {
      titleTemplate: config.seo?.titleTemplate ?? '%s',
      defaultTitle: config.seo?.defaultTitle ?? config.brand.name,
      defaultDescription: config.seo?.defaultDescription ?? '',
      defaultOgImage: canResolve
        ? new URL(ogImage!, siteUrl).toString()
        : ogImage,
    },
    routes: {
      home: config.routes?.home ?? 'home',
    },
    theme: resolveTheme(config.theme),
  };
}
