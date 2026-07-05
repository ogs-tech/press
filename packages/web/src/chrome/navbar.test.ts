import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// NavLinks (rendered inside Navbar) reads usePathname — same holder pattern as
// nav-links.test.ts.
const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { Navbar } from './navbar';

const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(createElement(Navbar as any, { __component: 'preset-organism.navbar', id: 1, ...props }));

describe('Navbar renderer', () => {
  it('wraps output in a data-block="preset-organism.navbar" element', () => {
    expect(render({ brand: { name: 'Acme' }, links: [] })).toContain('data-block="preset-organism.navbar"');
  });

  it('renders the hydrated brand as a home link with logo + name (Spec §1: brand never stored on the block)', () => {
    const html = render({ brand: { name: 'Acme', logo: 'http://cms.test/logo.png' }, links: [] });
    expect(html).toMatch(/<a[^>]*data-navbar="brand"[^>]*href="\/"/);
    expect(html).toContain('src="http://cms.test/logo.png"');
    expect(html).toContain('Acme');
  });

  it('omits the logo img when the brand has none', () => {
    expect(render({ brand: { name: 'Acme' }, links: [] })).not.toContain('<img');
  });

  it('renders the resolved links through the internal NavLinks', () => {
    const html = render({
      brand: { name: 'Acme' },
      links: [{ label: 'About', href: '/about', external: false, newTab: false }],
    });
    expect(html).toContain('<nav');
    expect(html).toContain('href="/about"');
    expect(html).toContain('>About');
  });

  it('renders the CTA only when BOTH label and href are present (no dead links)', () => {
    const withCta = render({
      brand: { name: 'Acme' },
      links: [],
      cta: { label: 'Sign up', href: '/signup', variant: 'secondary' },
    });
    expect(withCta).toMatch(/<a[^>]*data-navbar="cta"[^>]*href="\/signup"/);
    expect(withCta).toContain('data-variant="secondary"');

    expect(render({ brand: { name: 'Acme' }, links: [], cta: { label: 'Sign up' } }))
      .not.toContain('data-navbar="cta"');
    expect(render({ brand: { name: 'Acme' }, links: [] })).not.toContain('data-navbar="cta"');
  });

  it('defaults the CTA variant to primary', () => {
    expect(render({ brand: { name: 'Acme' }, links: [], cta: { label: 'Go', href: '/go' } }))
      .toContain('data-variant="primary"');
  });

  it('tolerates an un-hydrated block (no brand/links) without crashing', () => {
    // Direct BlockRenderer use outside mapSiteSettings must degrade, not throw —
    // mirroring the tolerant admission principle.
    expect(() => render({})).not.toThrow();
    expect(render({})).toContain('data-block="preset-organism.navbar"');
  });
});
