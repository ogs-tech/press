import type { ResolvedSeoPlugin } from './types';

/**
 * Ships ENABLED by default (plugin-seo Spec §6) — diverging from the
 * `example`/cookie-consent "ships disabled" precedent: SEO is core product
 * surface a fresh adopter site should have on day one, not a demo requiring
 * an opt-in step to discover.
 */
export const DEFAULT_SEO_PLUGIN: ResolvedSeoPlugin = {
  enabled: true,
  titleTemplate: '%s · {site}',
  metaDescription: '',
  social: { sameAs: [] },
};
