import type { Metadata } from 'next';
import type { ResolvedPressConfig } from './types';
import type { PageSeo } from '../types/base';

type PageMeta = { title?: string; seo?: PageSeo } | null;

/**
 * Produces the Next `Metadata` object for a route (plugin-seo Spec §3),
 * replacing the old title+favicon-only `buildMetadata` — its own comment
 * already deferred everything else to this plugin. `path` is the
 * browser-visible URL path the caller already resolved (e.g. '/about');
 * callers must pass `undefined` whenever `page` is `null` so a 404/
 * layout-fallback response never carries a self-referencing canonical.
 * Pure — no I/O.
 */
export function buildSeoMetadata(resolved: ResolvedPressConfig, page: PageMeta, path?: string): Metadata {
  const { brand } = resolved;
  const seo = resolved.plugins.seo;

  if (!seo.enabled) {
    return {
      title: page?.title ?? brand.name,
      ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
    };
  }

  // Enabled branch: built out in the increments below.
  return {
    title: page?.title ?? brand.name,
    ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
  };
}
