'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  CONSENT_CHANGE_EVENT,
  acceptAll,
  getConsentSnapshot,
  hasConsent,
  rejectAll,
  resetConsent,
  setConsent,
} from './consent-store';
import type { ConsentCategory, ConsentState } from './types';

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(CONSENT_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onStoreChange);
}

// Server snapshot is a constant null ("unknown") so the first client render
// matches SSR exactly — no hydration mismatch, no blocking read (Spec §5).
const getServerSnapshot = (): ConsentState | null => null;

/**
 * Reactive view over the consent store (cookie-consent Spec §5): re-renders
 * the consumer the instant a decision is written anywhere in the same tab —
 * the seam a future script plugin uses to react to consent granted after
 * load. For non-React consumers, the plain functions (hasConsent &c.) read
 * the same cookie.
 */
export function useConsent(): {
  consent: ConsentState | null;
  hasConsent: (category: ConsentCategory) => boolean;
  setConsent: typeof setConsent;
  acceptAll: typeof acceptAll;
  rejectAll: typeof rejectAll;
  resetConsent: typeof resetConsent;
} {
  const consent = useSyncExternalStore(subscribe, getConsentSnapshot, getServerSnapshot);
  return {
    consent,
    hasConsent: useCallback((category: ConsentCategory) => hasConsent(category, consent), [consent]),
    setConsent,
    acceptAll,
    rejectAll,
    resetConsent,
  };
}
