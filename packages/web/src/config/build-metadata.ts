import type { Metadata } from 'next';
import type { ResolvedPressConfig } from './types';

type PageMeta = { title?: string } | null;

/**
 * Produces a minimal Next `Metadata` object: `<title>` + favicon only. With a
 * `page`, the title is `seo.titleTemplate` with `%s` replaced by the page title;
 * with no page (the layout base) it is `seo.defaultTitle`. The title is a plain
 * string (not Next's template object) so the rendered `<title>` is deterministic
 * and directly assertable. The favicon is identity, not SEO, so it stays.
 *
 * Everything else — description, canonical, Open Graph, Twitter, robots, JSON-LD —
 * is deferred to Plugin/SEO (see the BASE/PAGES design). `ResolvedPressConfig.seo`
 * keeps `defaultDescription`/`defaultOgImage`; they simply go unconsumed here
 * until that plugin ships. Pure — no I/O.
 */
export function buildMetadata(resolved: ResolvedPressConfig, page: PageMeta): Metadata {
  const { brand, seo } = resolved;
  const title = page?.title ? seo.titleTemplate.replace('%s', page.title) : seo.defaultTitle;
  return {
    title,
    ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
  };
}
