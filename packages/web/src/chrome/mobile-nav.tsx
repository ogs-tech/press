'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResolvedNavLink, ResolvedChromeNavbar } from '../config/types';

interface MobileNavProps {
  links: ResolvedNavLink[];
  cta?: ResolvedChromeNavbar['cta'];
}

const DRAWER_ID = 'press-mobile-nav-drawer';

/**
 * Mobile nav drawer (spec §8.3 mobile UX addendum, plan Task 13). The one
 * intentional exception to the "server-first, zero-runtime layout" non-goal:
 * a small stateful client component that toggles a full-viewport drawer
 * from a hamburger button. Renders both surfaces (toggle + drawer);
 * `theme.css` swaps visibility by viewport (`data-mobile-nav="toggle"` shown
 * below `md`, hidden above; the desktop `[data-navbar-desktop]` Row is the
 * opposite).
 *
 * A11y: aria-expanded on the toggle mirrors state; drawer is
 * role="dialog" aria-modal="true" aria-label="Site navigation".
 * Escape closes; body scroll is locked while open; on open, focus moves to
 * the first link; on close, focus restores to the toggle.
 *
 * Renders nothing when both `links` is empty AND no CTA is provided —
 * matches Navbar's tolerant behavior on an un-hydrated block.
 */
export function MobileNav({ links, cta }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const hasCta = Boolean(cta?.label && cta?.href);
  const isEmpty = links.length === 0 && !hasCta;

  const close = useCallback(() => setOpen(false), []);
  const toggleOpen = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstLinkRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      toggleRef.current?.focus();
    };
  }, [open, close]);

  if (isEmpty) return null;

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        data-mobile-nav="toggle"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={DRAWER_ID}
        aria-label="Menu"
        onClick={toggleOpen}
      >
        <span data-mobile-nav="toggle-icon" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={DRAWER_ID}
          data-mobile-nav="drawer"
          data-open="true"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          onClick={(e) => {
            // Close only on a true backdrop click — the target IS the
            // drawer root itself, not a bubbled click from inner content.
            // Inner clicks are link navigations or no-ops; they must not
            // close the drawer (contract: backdrop-only close).
            if (e.target === e.currentTarget) close();
          }}
        >
          <nav data-mobile-nav="drawer-inner" aria-label="Primary mobile">
            {links.map((link, i) => (
              <a
                key={`${link.href}-${i}`}
                ref={i === 0 ? firstLinkRef : undefined}
                href={link.href}
                target={link.newTab ? '_blank' : undefined}
                rel={link.newTab ? 'noopener noreferrer' : undefined}
              >
                {link.label}
                {link.external ? (
                  <span aria-hidden="true" data-press-nav-ext>
                    {' '}
                    ↗
                  </span>
                ) : null}
              </a>
            ))}
            {hasCta ? (
              <a data-navbar="cta" data-variant={cta?.variant ?? 'primary'} href={cta?.href}>
                {cta?.label}
              </a>
            ) : null}
          </nav>
        </div>
      ) : null}
    </>
  );
}
