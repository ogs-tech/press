import { notFound } from 'next/navigation';
import { BlockRenderer, buildMetadata, getPage } from '@press/web';
import { customBlocks } from '../../press.blocks';
import { config } from '../../press-config';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPage((slug ?? []).join('/') || 'home');
  return buildMetadata(config, page ? { title: page.title } : null);
}

export default async function CatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPage((slug ?? []).join('/') || 'home');
  if (!page) notFound();
  return <BlockRenderer blocks={page.body} components={customBlocks} />;
}
