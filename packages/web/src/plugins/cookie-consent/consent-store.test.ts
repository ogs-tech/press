import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildConsentBootstrapScript,
  buildConsentCookie,
  CONSENT_COOKIE_NAME,
  getConsent,
  hasConsent,
  makeConsentState,
  parseConsentCookie,
  parseConsentState,
  serializeConsentCookie,
} from './consent-store';

const decided = makeConsentState({ analytics: true, marketing: false });

describe('consent state (cookie-consent Spec §5)', () => {
  it('makeConsentState forces necessary:true, stamps the version and an ISO decidedAt', () => {
    expect(decided.v).toBe(1);
    expect(decided.necessary).toBe(true);
    expect(decided.analytics).toBe(true);
    expect(decided.marketing).toBe(false);
    expect(new Date(decided.decidedAt).toISOString()).toBe(decided.decidedAt);
  });

  it('round-trips through serialize + parse', () => {
    const cookie = serializeConsentCookie(decided);
    expect(parseConsentCookie(cookie)).toEqual(decided);
  });

  it('finds its cookie inside a multi-cookie header string', () => {
    const header = `other=1; ${serializeConsentCookie(decided)}; another=x`;
    expect(parseConsentCookie(header)).toEqual(decided);
  });

  it('treats a version mismatch as "no decision" — forces re-consent', () => {
    const stale = JSON.stringify({ ...decided, v: 99 });
    expect(parseConsentState(stale)).toBeNull();
  });

  it('treats malformed JSON, wrong shapes, and absent cookies as "no decision"', () => {
    expect(parseConsentState('{oops')).toBeNull();
    expect(parseConsentState(JSON.stringify({ v: 1, analytics: 'yes' }))).toBeNull();
    expect(parseConsentState(null)).toBeNull();
    expect(parseConsentCookie('other=1')).toBeNull();
    expect(parseConsentCookie('')).toBeNull();
    expect(parseConsentCookie(`${CONSENT_COOKIE_NAME}=%E0%A4%A`)).toBeNull(); // broken encoding
  });
});

describe('hasConsent — fail-closed gate (Spec §2/§5)', () => {
  it('always grants necessary, even with no decision', () => {
    expect(hasConsent('necessary', null)).toBe(true);
  });

  it('denies every optional category when there is no decision', () => {
    expect(hasConsent('analytics', null)).toBe(false);
    expect(hasConsent('marketing', null)).toBe(false);
  });

  it('reads the per-category decision from an explicit state (the server-side seam)', () => {
    expect(hasConsent('analytics', decided)).toBe(true);
    expect(hasConsent('marketing', decided)).toBe(false);
  });

  it('is fail-closed on the server: no explicit state + no document ⇒ false', () => {
    expect(getConsent()).toBeNull(); // node environment — no document
    expect(hasConsent('analytics')).toBe(false);
  });
});

describe('cookie attributes', () => {
  it('sets Path, Max-Age (180d), SameSite=Lax — Secure only when asked', () => {
    const insecure = buildConsentCookie(decided, { secure: false });
    expect(insecure).toContain(`${CONSENT_COOKIE_NAME}=`);
    expect(insecure).toContain('Path=/');
    expect(insecure).toContain(`Max-Age=${180 * 24 * 60 * 60}`);
    expect(insecure).toContain('SameSite=Lax');
    expect(insecure).not.toContain('Secure');
    expect(buildConsentCookie(decided, { secure: true })).toContain('; Secure');
  });
});

describe('buildConsentBootstrapScript — the pre-paint hide (Spec §5)', () => {
  it('references the cookie name, version check, and the decided attribute', () => {
    const script = buildConsentBootstrapScript();
    expect(script).toContain(CONSENT_COOKIE_NAME);
    expect(script).toContain('s.v===1');
    expect(script).toContain("setAttribute('data-press-consent','decided')");
    // Defensive: the whole thing is wrapped so a cookie parse error can never
    // break the page before React loads.
    expect(script).toMatch(/^\(function\(\)\{try\{/);
    expect(script).toContain('catch(e){}');
  });

  it('the host template <html> suppresses hydration warnings for the stamped attribute', () => {
    // The bootstrap script mutates <html> BEFORE React hydrates, so the
    // server-rendered element never carries data-press-consent — without
    // suppressHydrationWarning React 19 reports a hydration mismatch for
    // every visitor who already decided. The prop only silences attribute
    // diffs on that one element, so child content mismatches still surface.
    const layoutPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '..', '..', '..', 'templates', 'host', 'app', 'layout.tsx',
    );
    const layout = readFileSync(layoutPath, 'utf8');
    expect(layout).toMatch(/<html[^>]*suppressHydrationWarning/);
  });
});
