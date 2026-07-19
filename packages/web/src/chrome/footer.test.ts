import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Footer } from './footer';

const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(Footer({ __component: 'preset-organism.footer', id: 1, ...(props as any) }));

describe('Footer renderer', () => {
  it('wraps output in a Container that carries data-block="preset-organism.footer" (Spec §8.4)', () => {
    const html = render({ text: 'hi', brand: { name: 'Acme' } });
    expect(html).toContain('data-press-layout="container"');
    expect(html).toContain('data-block="preset-organism.footer"');
  });

  it('spans full width like the Navbar — chrome is edge-to-edge, content is contained', () => {
    expect(render({ text: 'hi', brand: { name: 'Acme' } })).toContain('data-max-width="full"');
  });

  it('renders the copyright inside a <small>', () => {
    const html = render({ text: '© Acme Corp — all rights reserved', brand: { name: 'Acme' } });
    expect(html).toContain('<small>');
    expect(html).toContain('© Acme Corp — all rights reserved');
  });

  it('falls back to "brand · currentYear" when text is empty (Spec §1: today\'s behavior)', () => {
    const year = String(new Date().getFullYear());
    const empty = render({ text: '', brand: { name: 'Acme' } });
    expect(empty).toContain('Acme');
    expect(empty).toContain(year);
    const absent = render({ brand: { name: 'Acme' } });
    expect(absent).toContain('Acme');
    expect(absent).toContain(year);
  });

  it('tolerates an un-hydrated block (no brand) without crashing', () => {
    expect(() => render({})).not.toThrow();
    expect(render({})).toContain(String(new Date().getFullYear()));
  });
});
