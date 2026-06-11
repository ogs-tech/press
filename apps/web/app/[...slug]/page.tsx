import { notFound } from 'next/navigation';
import { BlockRenderer, getPage } from '@press/web';
import { customBlocks } from '../../press.blocks';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPage((slug ?? []).join('/') || 'home');
  return { title: page?.title ?? 'Not found' };
}

export default async function CatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPage((slug ?? []).join('/') || 'home');
  if (!page) notFound();
  return <BlockRenderer blocks={page.body} components={customBlocks} />;
}
