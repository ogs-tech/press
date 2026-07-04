import type { ConsentCategory, ConsentState } from './types';

/**
 * The visitor-consent store (cookie-consent Spec §5): a versioned FIRST-PARTY
 * cookie — not localStorage — so a server-adjacent consumer (middleware, a
 * route handler gating a future script plugin) can read the same decision.
 * Framework-free on purpose: pure parse/serialize helpers work in any runtime;
 * the DOM-touching writers no-op outside a browser. The visitor's decision is
 * NEVER read via next/headers cookies() in the RSC tree — that would force
 * the whole route dynamic (killing static/ISR) and bake one visitor's consent
 * into cached HTML (Spec §5).
 */

export const CONSENT_COOKIE_NAME = 'press_consent';
export const CONSENT_COOKIE_VERSION = 1 as const;
export const CONSENT_COOKIE_MAX_AGE_DAYS = 180;
/** DOM CustomEvent dispatched on every consent write/reset (same-tab reactivity). */
export const CONSENT_CHANGE_EVENT = 'press:consent-change';
/** `<html>` attribute stamped pre-paint when a decision exists (Spec §5). */
export const CONSENT_DECIDED_ATTR = 'data-press-consent';

/** Builds a fresh decision. `necessary` is structurally true (Spec §2). */
export function makeConsentState(choices: { analytics: boolean; marketing: boolean }): ConsentState {
  return {
    v: CONSENT_COOKIE_VERSION,
    necessary: true,
    analytics: choices.analytics,
    marketing: choices.marketing,
    decidedAt: new Date().toISOString(),
  };
}

/**
 * Parses a stored decision. Version mismatch, malformed JSON, or a wrong
 * shape all return null — "no decision", forcing re-consent. Never throws.
 */
export function parseConsentState(json: string | null | undefined): ConsentState | null {
  if (!json) return null;
  try {
    const s = JSON.parse(json) as Record<string, unknown>;
    if (
      s === null ||
      typeof s !== 'object' ||
      s.v !== CONSENT_COOKIE_VERSION ||
      typeof s.analytics !== 'boolean' ||
      typeof s.marketing !== 'boolean' ||
      typeof s.decidedAt !== 'string'
    ) {
      return null;
    }
    return {
      v: CONSENT_COOKIE_VERSION,
      necessary: true,
      analytics: s.analytics,
      marketing: s.marketing,
      decidedAt: s.decidedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Extracts the decision from a `a=b; c=d` cookie string — works on
 * `document.cookie` in the browser and on a request Cookie header server-side
 * (the seam for future server-adjacent consumers).
 */
export function parseConsentCookie(cookieString: string | null | undefined): ConsentState | null {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    return parseConsentState(decodeURIComponent(match[1]));
  } catch {
    return null; // malformed percent-encoding → no decision
  }
}

/** The `name=value` pair alone (no attributes) — the server Set-Cookie seam. */
export function serializeConsentCookie(state: ConsentState): string {
  return `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(state))}`;
}

/** The full cookie string assigned to document.cookie by the client writers. */
export function buildConsentCookie(state: ConsentState, opts: { secure: boolean }): string {
  const maxAge = CONSENT_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  return `${serializeConsentCookie(state)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${opts.secure ? '; Secure' : ''}`;
}

/** Reads the visitor's decision in the browser; null on the server ("unknown"). */
export function getConsent(): ConsentState | null {
  if (typeof document === 'undefined') return null;
  return parseConsentCookie(document.cookie);
}

/**
 * The consent gate (cookie-consent Spec §2/§5): `necessary` is always granted;
 * every optional category is FAIL-CLOSED — no decision (or SSR) ⇒ false.
 * Pass `state` explicitly for server-side use; omit it to read the browser
 * cookie — the promised `hasConsent('analytics')` ergonomics.
 */
export function hasConsent(category: ConsentCategory, state?: ConsentState | null): boolean {
  if (category === 'necessary') return true;
  const resolved = state === undefined ? getConsent() : state;
  return resolved ? resolved[category] : false;
}

// Snapshot cache keyed by the raw document.cookie string so useSyncExternalStore
// gets a referentially-stable value between writes (a fresh parse per render
// would loop the store sync forever).
let cachedCookie: string | null = null;
let cachedState: ConsentState | null = null;

/** Stable snapshot for useSyncExternalStore; server snapshot is always null. */
export function getConsentSnapshot(): ConsentState | null {
  if (typeof document === 'undefined') return null;
  if (document.cookie !== cachedCookie) {
    cachedCookie = document.cookie;
    cachedState = parseConsentCookie(cachedCookie);
  }
  return cachedState;
}

function notifyChange(): void {
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

/** Persists a decision: cookie + pre-paint attribute + change event. Browser-only. */
export function setConsent(choices: { analytics: boolean; marketing: boolean }): ConsentState {
  const state = makeConsentState(choices);
  if (typeof document !== 'undefined') {
    document.cookie = buildConsentCookie(state, { secure: location.protocol === 'https:' });
    document.documentElement.setAttribute(CONSENT_DECIDED_ATTR, 'decided');
    notifyChange();
  }
  return state;
}

export function acceptAll(): ConsentState {
  return setConsent({ analytics: true, marketing: true });
}

export function rejectAll(): ConsentState {
  return setConsent({ analytics: false, marketing: false });
}

/**
 * Clears the stored decision — the minimal "change your mind" seam (Spec §5):
 * the banner re-appears on the next render. A persistent reopen affordance
 * (e.g. a footer link) is a known follow-up, not shipped here.
 */
export function resetConsent(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.documentElement.removeAttribute(CONSENT_DECIDED_ATTR);
  notifyChange();
}

/**
 * The pre-paint anti-flash script (cookie-consent Spec §5), injected inline in
 * <head> by the host layout (the buildThemeStyle injection precedent): stamps
 * `<html data-press-consent="decided">` BEFORE first paint when a valid
 * decision cookie exists, so theme.css hides the banner instantly for
 * returning visitors; React unmounts it after hydration. Version-checked so a
 * stale cookie re-shows the banner rather than hiding it.
 */
export function buildConsentBootstrapScript(): string {
  return (
    '(function(){try{' +
    `var m=document.cookie.match(/(?:^|;\\s*)${CONSENT_COOKIE_NAME}=([^;]*)/);` +
    'if(!m)return;' +
    'var s=JSON.parse(decodeURIComponent(m[1]));' +
    `if(s&&s.v===${CONSENT_COOKIE_VERSION})document.documentElement.setAttribute('${CONSENT_DECIDED_ATTR}','decided');` +
    '}catch(e){}})();'
  );
}
