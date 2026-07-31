import type { MetadataRoute } from 'next';
import { getSiteConfig, getSitemapEntries } from '@ogs-tech/press-web';
import { buildTime } from '../press-config';

/**
 * Published-page sitemap (plugin-seo Spec §4) — [] when the SEO plugin is
 * disabled or the site has no URL configured. Pages with `noindex: true` are
 * excluded — a page telling crawlers not to index it shouldn't be advertised
 * in the sitemap either.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSiteConfig(buildTime);
  if (!site.plugins.seo.enabled || !site.site.url) return [];
  const entries = await getSitemapEntries();
  return entries
    .filter((entry) => !entry.noindex)
    .map((entry) => ({
      url: `${site.site.url}${entry.slug === buildTime.routes.home ? '/' : `/${entry.slug}`}`,
    }));
}
