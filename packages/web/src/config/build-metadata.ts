import type { Metadata } from 'next';
import type { ResolvedPressConfig } from './types';

type PageMeta = { title?: string; description?: string } | null;

/**
 * Produces a Next `Metadata` object from the resolved config (Spec §4.2). With
 * a `page`, the title is `seo.titleTemplate` with `%s` replaced by the page
 * title; with no page (the layout base) it is `seo.defaultTitle`. The title is
 * a plain string (not Next's template object) so the rendered `<title>` is
 * deterministic and directly assertable (AC1/AC3). The OG image is already
 * absolute (resolved against `site.url` in `resolveConfig`). Pure — no I/O.
 */
export function buildMetadata(resolved: ResolvedPressConfig, page: PageMeta): Metadata {
  const { brand, site, seo } = resolved;
  const title = page?.title
    ? seo.titleTemplate.replace('%s', page.title)
    : seo.defaultTitle;
  const description = page?.description ?? seo.defaultDescription;
  const images = seo.defaultOgImage ? [{ url: seo.defaultOgImage }] : undefined;

  return {
    title,
    ...(description ? { description } : {}),
    ...(site.url ? { alternates: { canonical: site.url } } : {}),
    openGraph: {
      title,
      ...(description ? { description } : {}),
      siteName: brand.name,
      ...(site.url ? { url: site.url } : {}),
      ...(images ? { images } : {}),
    },
    ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
  };
}
