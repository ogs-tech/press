import { notFound, permanentRedirect } from 'next/navigation';
import {
  buildSeoMetadata,
  buildJsonLd,
  SeoJsonLd,
  getPage,
  getSiteConfig,
  getStaticPageParams,
  TreeRenderer,
} from '@ogs-tech/press-web';
import { customBlocks } from '../../press.blocks';
import { buildTime } from '../../press-config';

// ISR: published pages are prerendered at build — generateStaticParams lists
// their slugs from the CMS — and revalidated every 60s (mirrors getPage/
// getSiteConfig). dynamicParams stays at its default (true), so a slug added
// after the build — or every slug when the CMS is unreachable at build (the
// list fails to empty) — renders on-demand and caches. /home → / and notFound()
// run inside the render, unchanged under ISR.
export const revalidate = 60;

export async function generateStaticParams() {
  return getStaticPageParams(buildTime.routes.home);
}

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

/**
 * Catch-all segments → CMS slug. The site root ('/') has no segments and maps to
 * the home slug declared in press.config (`buildTime.routes.home`). Routing reads
 * the build-time anchor only, so the /home → / redirect stays deterministic and
 * independent of CMS availability.
 */
function slugFor(segments?: string[]): string {
  return (segments ?? []).join('/') || buildTime.routes.home;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  // Next dedupes identical fetches within a request + the ISR Data Cache serves
  // getSiteConfig across requests, so this resolves to a single cached round-trip
  // even though the layout also calls it.
  const [site, page] = await Promise.all([getSiteConfig(buildTime), getPage(slugFor(slug))]);
  // `path` stays undefined when there is no page — a 404 response must never
  // carry a self-referencing canonical (plugin-seo Spec §3 call sites).
  const path = page ? `/${(slug ?? []).join('/')}` : undefined;
  return buildSeoMetadata(site, page ? { title: page.title, seo: page.seo } : null, path);
}

export default async function CatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const path = (slug ?? []).join('/');

  // The home page is canonical at the root only. A direct hit on its slug
  // (e.g. /home) 308-redirects to '/', so home has no public slug URL.
  if (path && path === buildTime.routes.home) permanentRedirect('/');

  const [site, page] = await Promise.all([
    getSiteConfig(buildTime),
    getPage(path || buildTime.routes.home),
  ]);
  if (!page) notFound();

  // notFound() above guarantees `page` is non-null here, so the JSON-LD
  // WebPage node always has real page data (plugin-seo Spec §3).
  const urlPath = `/${path}`;
  return (
    <>
      {site.plugins.seo.enabled && (
        <SeoJsonLd data={buildJsonLd(site, { title: page.title, seo: page.seo }, urlPath)} />
      )}
      <TreeRenderer body={page.body} site={site} components={customBlocks} />
    </>
  );
}
