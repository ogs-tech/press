'use client';

import { useSyncExternalStore } from 'react';
import { getServerSnapshot, getSnapshot, subscribe, type ConsentDecision } from './consent-store';

/**
 * React-native hydration-safe read (Plugin/Legal Spec §4): server (and first
 * client paint) always see `null`; React swaps to the real cookie value
 * immediately after hydration commits.
 *
 * Lives alone in a `'use client'` module — and is deliberately NOT re-exported
 * from the package barrel — because `consent-store.ts` is pulled into the RSC
 * server graph by the host `layout.tsx` (via `CONSENT_ANTI_FLASH_SCRIPT`), and
 * `useSyncExternalStore` does not exist under React's `react-server` export
 * condition. Only `banner.tsx` (itself `'use client'`) consumes this.
 */
export function useConsentDecision(): ConsentDecision | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
