import type { PressConfig, ResolvedPressConfig } from './types';

/**
 * Fills engine defaults over the adopter's PressConfig (Spec §4.2). Pure: same
 * input → same output, no I/O, no mutation — so the resolved value is safe to
 * hold as an immutable module constant under RSC/SSR (Spec §11, the Spec 1
 * lesson). Defaults: titleTemplate → '%s', locale → 'en', defaultTitle →
 * brand.name, favicon → '/favicon.ico'; defaultOgImage is resolved ABSOLUTE
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
  };
}
