import { notFound, permanentRedirect } from 'next/navigation';
import { BlockRenderer, buildMetadata, getPage, getSiteConfig } from '@ogs-tech/press-web';
import { customBlocks } from '../../press.blocks';
import { buildTime } from '../../press-config';

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
  return buildMetadata(site, page ? { title: page.title } : null);
}

export default async function CatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const path = (slug ?? []).join('/');

  // The home page is canonical at the root only. A direct hit on its slug
  // (e.g. /home) 308-redirects to '/', so home has no public slug URL.
  if (path && path === buildTime.routes.home) permanentRedirect('/');

  const page = await getPage(path || buildTime.routes.home);
  if (!page) notFound();
  return <BlockRenderer blocks={page.body} components={customBlocks} />;
}
