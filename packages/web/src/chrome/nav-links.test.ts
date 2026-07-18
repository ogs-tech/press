import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ResolvedNavLink } from '../config/types';

// usePathname is controlled per test via a hoisted holder (vitest hoists vi.mock
// above imports; vi.hoisted makes the holder safe to reference inside the factory).
const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { NavLinks } from './nav-links';

type Links = ResolvedNavLink[];

const render = (links: Links): string =>
  renderToStaticMarkup(createElement(NavLinks, { links }));

describe('NavLinks', () => {
  it('renders an anchor per link with label and href', () => {
    const html = render([
      { label: 'About', href: '/about', external: false, newTab: false },
      { label: 'Home', href: '/', external: false, newTab: false },
    ]);
    expect(html).toContain('data-press-layout="row"');
    expect(html).toContain('data-press-nav="header"');
    expect(html).toContain('href="/about"');
    expect(html).toContain('>About');
    expect(html).toContain('href="/"');
  });

  it('marks the active link with aria-current="page" (exact match)', () => {
    nav.pathname = '/about';
    const html = render([
      { label: 'About', href: '/about', external: false, newTab: false },
      { label: 'Docs', href: '/docs', external: false, newTab: false },
    ]);
    // the About anchor is active …
    expect(html).toMatch(/<a[^>]*href="\/about"[^>]*aria-current="page"/);
    // … and the Docs anchor is not
    expect(html).not.toMatch(/<a[^>]*href="\/docs"[^>]*aria-current="page"/);
    nav.pathname = '/'; // reset for other tests
  });

  it('matches home (/) exactly', () => {
    nav.pathname = '/';
    const html = render([{ label: 'Home', href: '/', external: false, newTab: false }]);
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*aria-current="page"/);
  });

  it('newTab links get target=_blank and rel=noopener noreferrer', () => {
    const html = render([{ label: 'Docs', href: 'https://docs.test', external: true, newTab: true }]);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('non-newTab links carry neither target nor rel', () => {
    const html = render([{ label: 'About', href: '/about', external: false, newTab: false }]);
    expect(html).not.toContain('target=');
    expect(html).not.toContain('rel=');
  });

  it('external links show the ↗ affordance independent of newTab', () => {
    const html = render([{ label: 'Site', href: 'https://x.test', external: true, newTab: false }]);
    expect(html).toContain('↗');
    expect(html).not.toContain('target='); // external but newTab=false → no _blank
  });

  it('renders nothing for an empty link list', () => {
    expect(render([])).toBe('');
  });
});
