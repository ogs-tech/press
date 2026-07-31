import type { ResolvedPressConfig } from '../../config/types';
import type { PageSeo } from '../../types/base';

type PageMeta = { title?: string; seo?: PageSeo } | null;

/**
 * Pure resolved-config + page → JSON-LD nodes (plugin-seo Spec §3). `[]` when
 * the plugin is disabled — mirrors buildSeoMetadata's fail-open gate so a
 * disabled site never emits structured data either. Pure — no I/O.
 */
export function buildJsonLd(resolved: ResolvedPressConfig, page: PageMeta, path?: string): Record<string, unknown>[] {
  const { brand, site, plugins } = resolved;
  if (!plugins.seo.enabled) return [];

  const url = path && site.url ? `${site.url}${path}` : undefined;
  const sameAs = plugins.seo.social.sameAs;

  const organization: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.name,
    ...(brand.logo ? { logo: brand.logo } : {}),
    ...(site.url ? { url: site.url } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };

  const description = page?.seo?.metaDescription || plugins.seo.metaDescription || undefined;
  const webPage: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page?.seo?.metaTitle || page?.title || brand.name,
    ...(url ? { url } : {}),
    ...(description ? { description } : {}),
    isPartOf: {
      '@type': 'WebSite',
      name: brand.name,
      ...(site.url ? { url: site.url } : {}),
    },
  };

  return [organization, webPage];
}
