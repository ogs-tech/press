/**
 * Plugin/Legal cookie store — deliberately ZERO React imports. `index.ts`
 * re-exports `hasConsent`/`resetConsent`/`CONSENT_ANTI_FLASH_SCRIPT` from here,
 * and the host `layout.tsx` (a Server Component) reads the anti-flash script's
 * literal string at SSR/build time, so this module lands in the RSC server
 * graph. React's `react-server` export condition does not export
 * `useSyncExternalStore`, and Next's RSC transform rejects it outside a
 * `'use client'` boundary — hence the hook lives alone in
 * `./use-consent-decision.ts`. The store machinery below (`subscribe`,
 * `getSnapshot`, `getServerSnapshot`) is plain JS and stays here; only the hook
 * that consumes it is client-only.
 */
import type { ConsentCategory } from './types';

/** Plugin/Legal Spec §4 cookie contract. */
export const CONSENT_COOKIE_NAME = 'press_consent';
const CONSENT_COOKIE_VERSION = 1;
const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // 180 days

export interface ConsentDecision {
  analytics: boolean;
  marketing: boolean;
  decidedAt: number;
}

interface StoredConsent {
  v: number;
  analytics: boolean;
  marketing: boolean;
  decidedAt: number;
}

/** Returns the raw, still percent-encoded cookie value — decoding happens inside parseConsentCookie's try/catch. */
function readRawCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

/** SSR-safe no-op, mirroring readRawCookie's guard: `resetConsent` is public API, so a Server Component call must never throw. */
function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

/** SSR-safe no-op — see writeCookie. */
function clearCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * A version mismatch, malformed JSON, or malformed percent-encoding all parse
 * as no decision (re-consent), never a throw — `decodeURIComponent` on a
 * corrupted (e.g. manually edited) cookie value can itself throw `URIError`,
 * so it must run inside this same try/catch, not before it.
 */
function parseConsentCookie(raw: string | undefined): ConsentDecision | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<StoredConsent>;
    if (parsed.v !== CONSENT_COOKIE_VERSION) return null;
    if (
      typeof parsed.analytics !== 'boolean' ||
      typeof parsed.marketing !== 'boolean' ||
      typeof parsed.decidedAt !== 'number'
    ) {
      return null;
    }
    return { analytics: parsed.analytics, marketing: parsed.marketing, decidedAt: parsed.decidedAt };
  } catch {
    return null;
  }
}

export function readConsentCookie(): ConsentDecision | null {
  return parseConsentCookie(readRawCookie(CONSENT_COOKIE_NAME));
}

type Listener = () => void;
const listeners = new Set<Listener>();
function notify(): void {
  for (const listener of listeners) listener();
}
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
// useSyncExternalStore requires getSnapshot to return a referentially STABLE
// value while the store hasn't changed — React re-invokes it after every
// render to detect drift, and notify() fires unconditionally on every
// setConsent()/resetConsent() call (regardless of whether the value actually
// changed), so this cache keys strictly off the raw cookie string rather than
// trusting notify() to only fire on real changes. `readConsentCookie()` itself
// stays unmemoized on purpose — non-store callers (hasConsent, tests) may read
// it immediately after mutating the cookie via a non-store path.
let lastRawSnapshot: string | undefined;
let lastParsedSnapshot: ConsentDecision | null = null;
export function getSnapshot(): ConsentDecision | null {
  const raw = readRawCookie(CONSENT_COOKIE_NAME);
  if (raw !== lastRawSnapshot) {
    lastRawSnapshot = raw;
    lastParsedSnapshot = parseConsentCookie(raw);
  }
  return lastParsedSnapshot;
}
export function getServerSnapshot(): ConsentDecision | null {
  return null;
}

export function setConsent(decision: { analytics: boolean; marketing: boolean }): void {
  const stored: StoredConsent = {
    v: CONSENT_COOKIE_VERSION,
    analytics: decision.analytics,
    marketing: decision.marketing,
    decidedAt: Date.now(),
  };
  writeCookie(CONSENT_COOKIE_NAME, JSON.stringify(stored), CONSENT_MAX_AGE_SECONDS);
  notify();
}

export function resetConsent(): void {
  clearCookie(CONSENT_COOKIE_NAME);
  notify();
}

/** Fail-closed: 'necessary' is always true; any other category is false during SSR or before a decision exists. */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === 'necessary') return true;
  if (typeof document === 'undefined') return false;
  const decision = readConsentCookie();
  if (!decision) return false;
  return category === 'analytics' ? decision.analytics : decision.marketing;
}

/**
 * Anti-flash (Plugin/Legal Spec §5): stamps `data-press-consent-decided` on
 * `<html>` before hydration when a decision cookie already exists, so
 * `theme.css` can hide the full-banner state for the one frame a returning
 * visitor's browser would otherwise paint the server-rendered "no decision"
 * markup before React corrects the `useSyncExternalStore` snapshot. Mounted
 * as a raw `<script>` in the host `layout.tsx` `<head>` — the `buildThemeStyle`
 * `<style>` injection precedent — never read via `next/headers` `cookies()`,
 * which would force the route dynamic.
 *
 * The attribute is REMOVED by `CookieConsentBanner`'s mount effect: it only has
 * to bridge "HTML painted" → "React hydrated", and its `theme.css` rule hides
 * ANY rendered banner, so leaving it in place would permanently swallow the
 * reopen panel, a re-consent flow after a cookie-version bump, and any
 * post-mount `resetConsent()`.
 */
export const CONSENT_ANTI_FLASH_SCRIPT = `(function(){try{if(document.cookie.indexOf('${CONSENT_COOKIE_NAME}=')!==-1){document.documentElement.setAttribute('data-press-consent-decided','');}}catch(e){}})();`;
