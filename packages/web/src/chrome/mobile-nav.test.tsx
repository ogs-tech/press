// @vitest-environment jsdom
//
// Interactive-flow tests for the mobile nav drawer — the engine's second
// stateful client component (after the cookie-consent banner). Same
// hand-rolled act() + createRoot harness (Spec §12; CLAUDE.md testing note):
// NEVER @testing-library/react, because the workspace's node-linker=hoisted
// layout materializes only Strapi-admin's react-19 RTL variant at root.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// usePathname is called indirectly (MobileNav renders its own <a> list, not
// NavLinks, so no import — but keeping the mock harmless doesn't hurt).
const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { MobileNav } from './mobile-nav';
import type { ResolvedNavLink } from '../config/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(ui: React.ReactElement): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(ui));
}

function toggle(): HTMLButtonElement {
  const el = container.querySelector('[data-mobile-nav="toggle"]') as HTMLButtonElement | null;
  if (!el) throw new Error('toggle button not found');
  return el;
}

function drawer(): HTMLElement | null {
  return container.querySelector('[data-mobile-nav="drawer"]') as HTMLElement | null;
}

const link = (label: string, href: string): ResolvedNavLink => ({
  label,
  href,
  external: false,
  newTab: false,
});

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('<MobileNav>', () => {
  it('renders the toggle button with aria-expanded="false" by default', () => {
    render(<MobileNav links={[link('About', '/about')]} />);
    const btn = toggle();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls')).toBe('press-mobile-nav-drawer');
    expect(btn.getAttribute('aria-label')).toBe('Menu');
  });

  it('does not render the drawer body until opened', () => {
    render(<MobileNav links={[link('About', '/about')]} />);
    expect(drawer()).toBeNull();
  });

  it('opens the drawer on toggle click and flips aria-expanded to "true"', () => {
    render(<MobileNav links={[link('About', '/about')]} />);
    act(() => toggle().click());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    const d = drawer();
    expect(d).not.toBeNull();
    expect(d!.textContent).toContain('About');
  });

  it('renders every link inside the drawer', () => {
    render(
      <MobileNav
        links={[link('About', '/about'), link('Docs', '/docs')]}
      />,
    );
    act(() => toggle().click());
    const anchors = drawer()!.querySelectorAll('a');
    expect(anchors.length).toBe(2);
    expect(anchors[0].getAttribute('href')).toBe('/about');
    expect(anchors[1].getAttribute('href')).toBe('/docs');
  });

  it('renders the CTA when BOTH label and href are present', () => {
    render(
      <MobileNav
        links={[link('About', '/about')]}
        cta={{ label: 'Sign up', href: '/signup', variant: 'primary' }}
      />,
    );
    act(() => toggle().click());
    const html = drawer()!.innerHTML;
    expect(html).toContain('data-navbar="cta"');
    expect(html).toContain('href="/signup"');
  });

  it('omits the CTA when label or href is missing (no dead links)', () => {
    render(
      <MobileNav
        links={[link('About', '/about')]}
        cta={{ label: 'Sign up' } as any}
      />,
    );
    act(() => toggle().click());
    expect(drawer()!.innerHTML).not.toContain('data-navbar="cta"');
  });

  it('closes on Escape', () => {
    render(<MobileNav links={[link('About', '/about')]} />);
    act(() => toggle().click());
    expect(drawer()).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(drawer()).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('locks body scroll while open and restores on close', () => {
    render(<MobileNav links={[link('About', '/about')]} />);
    expect(document.body.style.overflow).toBe('');
    act(() => toggle().click());
    expect(document.body.style.overflow).toBe('hidden');
    act(() => toggle().click());
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on backdrop click (a click on the drawer element itself, outside its inner content)', () => {
    render(<MobileNav links={[link('About', '/about')]} />);
    act(() => toggle().click());
    const d = drawer()!;
    act(() => {
      // Click event bubbling from the drawer root closes; a click on inner
      // <a> or button would either navigate (link) or be swallowed by content.
      d.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(drawer()).toBeNull();
  });

  it('renders nothing when the link list is empty and no cta is provided', () => {
    render(<MobileNav links={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
