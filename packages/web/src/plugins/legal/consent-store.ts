import { useSyncExternalStore } from 'react';
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

function readRawCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/** A version mismatch or malformed value parses as no decision (re-consent), never a throw. */
function parseConsentCookie(raw: string | undefined): ConsentDecision | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
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
function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): ConsentDecision | null {
  return readConsentCookie();
}
function getServerSnapshot(): ConsentDecision | null {
  return null;
}

/**
 * React-native hydration-safe read (Plugin/Legal Spec §4): server (and first
 * client paint) always see `null`; React swaps to the real cookie value
 * immediately after hydration commits.
 */
export function useConsentDecision(): ConsentDecision | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
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
 */
export const CONSENT_ANTI_FLASH_SCRIPT = `(function(){try{if(document.cookie.indexOf('${CONSENT_COOKIE_NAME}=')!==-1){document.documentElement.setAttribute('data-press-consent-decided','');}}catch(e){}})();`;
