import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PressMedia } from '../types/base';
import { Hero } from './hero';

// Mirrors the press.image contract test: renderers are called as functions and
// resolve media absolute against CMS_URL (unset here → engine default).
const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(Hero({ __component: 'section.hero', id: 1, ...(props as any) }));

const img = (url: string, alternativeText?: string | null): PressMedia => ({ url, alternativeText });

describe('Hero renderer', () => {
  it('wraps output in a data-block="section.hero" section', () => {
    expect(render({ title: 'Ship faster' })).toContain('<section data-block="section.hero"');
  });

  it('renders the title as an h1', () => {
    expect(render({ title: 'Ship faster' })).toContain('<h1>Ship faster</h1>');
  });

  it('renders the optional eyebrow and subtitle when present', () => {
    const out = render({ eyebrow: 'New', title: 'Ship faster', subtitle: 'The engine' });
    expect(out).toContain('New');
    expect(out).toContain('The engine');
  });

  it('defaults align to "left" and honors "center"', () => {
    expect(render({ title: 'T' })).toContain('data-align="left"');
    expect(render({ title: 'T', align: 'center' })).toContain('data-align="center"');
  });

  it('resolves the hero image absolute against CMS_URL', () => {
    expect(render({ title: 'T', image: img('/uploads/h.png') }))
      .toContain('src="http://localhost:1337/uploads/h.png"');
  });

  it('omits the image when absent', () => {
    expect(render({ title: 'T' })).not.toContain('<img');
  });

  it('renders the CTA only when BOTH ctaLabel and ctaHref are present (Spec §8)', () => {
    expect(render({ title: 'T', ctaLabel: 'Go', ctaHref: '/go' })).toContain('href="/go"');
    expect(render({ title: 'T', ctaLabel: 'Go' })).not.toContain('data-hero="cta"');
    expect(render({ title: 'T', ctaHref: '/go' })).not.toContain('data-hero="cta"');
  });

  it('renders nothing when title is missing (tolerant draft, Spec §8)', () => {
    expect(render({ eyebrow: 'orphan' })).toBe('');
  });
});
