// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { hasConsent, readConsentCookie, resetConsent, setConsent, CONSENT_COOKIE_NAME } from './consent-store';

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
