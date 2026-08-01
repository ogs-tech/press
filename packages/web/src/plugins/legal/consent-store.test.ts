// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasConsent,
  readConsentCookie,
  resetConsent,
  setConsent,
  CONSENT_COOKIE_NAME,
} from './consent-store';
// The hook lives in its own 'use client' module so consent-store.ts stays
// React-free for the RSC server graph — see use-consent-decision.ts.
import { useConsentDecision } from './use-consent-decision';

// Hand-rolled act() + createRoot harness (Spec §12; CLAUDE.md testing note) —
// NEVER @testing-library/react, matching the mobile-nav.test.tsx precedent.
// This file stays .test.ts (no JSX) on purpose, so components are built with
// createElement rather than a .tsx rename.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  resetConsent();
});

describe('consent-store cookie round-trip', () => {
  it('reads null when no cookie is set', () => {
    expect(readConsentCookie()).toBeNull();
  });

  it('round-trips a decision through setConsent/readConsentCookie', () => {
    setConsent({ analytics: true, marketing: false });
    const decision = readConsentCookie();
    expect(decision).not.toBeNull();
    expect(decision!.analytics).toBe(true);
    expect(decision!.marketing).toBe(false);
    expect(typeof decision!.decidedAt).toBe('number');
  });

  it('clears the decision on resetConsent', () => {
    setConsent({ analytics: true, marketing: true });
    resetConsent();
    expect(readConsentCookie()).toBeNull();
  });

  it('writes the cookie under the documented name with SameSite=Lax and Path=/', () => {
    setConsent({ analytics: true, marketing: true });
    expect(document.cookie).toContain(`${CONSENT_COOKIE_NAME}=`);
  });

  it('writes the full cookie string with SameSite=Lax, Path=/, and the 180-day Max-Age', () => {
    // document.cookie's getter never exposes attributes (Path/SameSite/Secure/Max-Age) —
    // only name=value pairs — so this spies on the setter to inspect the written string.
    const setSpy = vi.spyOn(document, 'cookie', 'set');
    setConsent({ analytics: true, marketing: true });
    expect(setSpy).toHaveBeenCalledTimes(1);
    const written = setSpy.mock.calls[0][0];
    expect(written).toContain(`${CONSENT_COOKIE_NAME}=`);
    expect(written).toContain('SameSite=Lax');
    expect(written).toContain('Path=/');
    expect(written).toContain('Max-Age=15552000');
    setSpy.mockRestore();
  });
});

describe('consent-store malformed/version-mismatched values', () => {
  it('reads null for a malformed (non-JSON) cookie value', () => {
    document.cookie = `${CONSENT_COOKIE_NAME}=not-json; Path=/`;
    expect(readConsentCookie()).toBeNull();
  });

  it('reads null for a version-mismatched cookie value (forces re-consent)', () => {
    document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(
      JSON.stringify({ v: 99, analytics: true, marketing: true, decidedAt: 1 }),
    )}; Path=/`;
    expect(readConsentCookie()).toBeNull();
  });

  it('reads null for a structurally incomplete cookie value', () => {
    document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify({ v: 1 }))}; Path=/`;
    expect(readConsentCookie()).toBeNull();
  });

  it('reads null (never throws) for a cookie value with invalid percent-encoding', () => {
    document.cookie = `${CONSENT_COOKIE_NAME}=%; Path=/`;
    expect(() => readConsentCookie()).not.toThrow();
    expect(readConsentCookie()).toBeNull();
  });
});

describe('hasConsent', () => {
  it('is always true for necessary, decision or not', () => {
    expect(hasConsent('necessary')).toBe(true);
    setConsent({ analytics: false, marketing: false });
    expect(hasConsent('necessary')).toBe(true);
  });

  it('fails closed for analytics/marketing with no decision stored', () => {
    expect(hasConsent('analytics')).toBe(false);
    expect(hasConsent('marketing')).toBe(false);
  });

  it('reflects the stored decision once one exists', () => {
    setConsent({ analytics: true, marketing: false });
    expect(hasConsent('analytics')).toBe(true);
    expect(hasConsent('marketing')).toBe(false);
  });

  it('fails closed for non-necessary categories when document is undefined (SSR)', () => {
    const originalDocument = globalThis.document;
    // @ts-expect-error simulating an SSR environment where document doesn't exist
    delete globalThis.document;
    try {
      expect(hasConsent('necessary')).toBe(true);
      expect(hasConsent('analytics')).toBe(false);
      expect(hasConsent('marketing')).toBe(false);
    } finally {
      globalThis.document = originalDocument;
    }
  });
});

describe('write path under SSR', () => {
  // resetConsent is public package API (index.ts), so an adopter can call it
  // from a Server Component — it must no-op, not throw a raw ReferenceError.
  // setConsent shares the exact same write path and is guarded for symmetry.
  it('setConsent/resetConsent are safe no-ops when document is undefined', () => {
    const originalDocument = globalThis.document;
    // @ts-expect-error simulating an SSR environment where document doesn't exist
    delete globalThis.document;
    try {
      expect(() => setConsent({ analytics: true, marketing: true })).not.toThrow();
      expect(() => resetConsent()).not.toThrow();
    } finally {
      globalThis.document = originalDocument;
    }
  });
});

describe('useConsentDecision rendered in a component (regression: infinite update loop)', () => {
  // useSyncExternalStore requires getSnapshot to be referentially stable
  // while the store hasn't changed. A prior version of getSnapshot() called
  // readConsentCookie() directly, which JSON.parse()s and returns a brand-new
  // object every call — so after notify() (fired unconditionally by every
  // setConsent()/resetConsent(), whether or not the value changed) React saw
  // "the snapshot changed again" on its own re-check, scheduled another
  // re-render, checked again, forever ("Maximum update depth exceeded").
  // Calling the plain functions directly (as every other test in this file
  // does) never exercises useSyncExternalStore's render loop, so only an
  // actual mount + notify catches this class of bug.
  function ConsentProbe() {
    const decision = useConsentDecision();
    return createElement('div', { 'data-testid': 'decision' }, decision ? JSON.stringify(decision) : 'none');
  }

  it('does not enter an infinite update loop when setConsent runs after mount, and the render reflects the new decision', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    try {
      act(() => {
        root.render(createElement(ConsentProbe));
      });
      expect(container.textContent).toBe('none');

      expect(() => {
        act(() => {
          setConsent({ analytics: true, marketing: false });
        });
      }).not.toThrow();

      expect(container.textContent).toContain('"analytics":true');
      expect(container.textContent).toContain('"marketing":false');
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
