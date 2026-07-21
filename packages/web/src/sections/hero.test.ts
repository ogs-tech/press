import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PressMedia } from '../types/base';
import { Hero } from './hero';

// Mirrors the preset-atom.image contract test: renderers are called as functions and
// resolve media absolute against CMS_URL (unset here → engine default).
const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(Hero({ __component: 'preset-organism.hero', id: 1, ...(props as any) }));

const img = (url: string, alternativeText?: string | null): PressMedia => ({ url, alternativeText });

describe('Hero renderer', () => {
  it('renders nothing when title is missing (tolerant draft, Spec §8)', () => {
    expect(render({ eyebrow: 'orphan' })).toBe('');
  });

  it('wraps output in a <section> that carries both the Container attrs and data-block (Spec §8.1)', () => {
    const html = render({ title: 'Ship faster' });
    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain('data-press-layout="container"');
    expect(html).toContain('data-max-width="lg"');
    expect(html).toContain('data-padded');
    expect(html).toContain('data-block="preset-organism.hero"');
  });

  it('renders the title as an h1', () => {
    expect(render({ title: 'Ship faster' })).toContain('<h1>Ship faster</h1>');
  });

  it('renders the optional eyebrow and subtitle when present', () => {
    const out = render({ eyebrow: 'New', title: 'Ship faster', subtitle: 'The engine' });
    expect(out).toContain('data-hero="eyebrow"');
    expect(out).toContain('New');
    expect(out).toContain('The engine');
  });

  it('defaults align to "left" and honors "center"', () => {
    expect(render({ title: 'T' })).toContain('data-align="left"');
    expect(render({ title: 'T', align: 'center' })).toContain('data-align="center"');
  });

  it('renders an inner <Grid> with a text column that spans 7 on md when an image is present (Spec §8.1)', () => {
    const html = render({ title: 'T', image: img('/uploads/h.png') });
    expect(html).toContain('data-press-layout="grid"');
    expect(html).toContain('--press-col-span:12');
    expect(html).toContain('--press-col-span-md:7');
  });

  it('makes the text column span 12 at every tier when no image is present', () => {
    const html = render({ title: 'T' });
    expect(html).toContain('--press-col-span:12');
    expect(html).not.toContain('--press-col-span-md:7');
  });

  it('resolves the hero image absolute against CMS_URL inside an image column', () => {
    const html = render({ title: 'T', image: img('/uploads/h.png') });
    expect(html).toContain('src="http://localhost:1337/uploads/h.png"');
    expect(html).toContain('--press-col-span-md:5');
  });

  it('omits the image column when no image is present', () => {
    expect(render({ title: 'T' })).not.toContain('<img');
    expect(render({ title: 'T' })).not.toContain('--press-col-span-md:5');
  });

  it('renders the CTA only when a complete link is present (Spec §8)', () => {
    const withCta = render({ title: 'T', cta: { label: 'Go', url: '/go' } });
    expect(withCta).toContain('data-hero="cta"');
    expect(withCta).toContain('href="/go"');
    expect(withCta).toContain('Go');
    expect(render({ title: 'T', cta: { label: 'Go' } })).not.toContain('data-hero="cta"');
    expect(render({ title: 'T' })).not.toContain('data-hero="cta"');
  });
});
