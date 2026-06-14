import { notFound, permanentRedirect } from 'next/navigation';
import { BlockRenderer, buildMetadata, getPage } from '@press/web';
import { customBlocks } from '../../press.blocks';
import { config } from '../../press-config';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

/**
 * Catch-all segments → CMS slug. The site root ('/') has no segments and maps to
 * the home slug declared in press.config (`config.routes.home`) — so the engine
 * no longer hardcodes a magic 'home' string; the adopter owns it.
 */
function slugFor(segments?: string[]): string {
  return (segments ?? []).join('/') || config.routes.home;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPage(slugFor(slug));
  return buildMetadata(config, page ? { title: page.title } : null);
}

export default async function CatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const path = (slug ?? []).join('/');

  // The home page is canonical at the root only. A direct hit on its slug
  // (e.g. /home) 308-redirects to '/', so home has no public slug URL.
  if (path && path === config.routes.home) permanentRedirect('/');

  const page = await getPage(path || config.routes.home);
  if (!page) notFound();
  return <BlockRenderer blocks={page.body} components={customBlocks} />;
}
