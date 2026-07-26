import type { Metadata } from 'next';
import type { ResolvedPressConfig } from './types';

type PageMeta = { title?: string } | null;

/**
 * Produces a minimal Next `Metadata` object: `<title>` + favicon only. The
 * title is the page's own title; with no page (the layout base) it falls back
 * to the site name — no CMS-editable template. Everything else — description,
 * canonical, Open Graph, Twitter, robots, JSON-LD — is deferred to a future
 * Plugin/SEO. Pure — no I/O.
 */
export function buildMetadata(resolved: ResolvedPressConfig, page: PageMeta): Metadata {
  const { brand } = resolved;
  const title = page?.title ?? brand.name;
  return {
    title,
    ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
  };
}
