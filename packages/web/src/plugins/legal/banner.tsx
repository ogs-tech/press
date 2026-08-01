'use client';

import { useState } from 'react';
import type { ResolvedCookieConsent } from './types';
import { setConsent, useConsentDecision } from './consent-store';

type CookieConsentBannerProps = Omit<ResolvedCookieConsent, 'enabled'>;

/**
 * The engine's second client component (after MobileNav) — global,
 * always-mounted UI, not something an editor places in the composition tree
 * (Plugin/Legal Spec §5), same hand-rolled-not-DZ precedent ExamplePlugin set.
 *
 * Three states driven by useConsentDecision() plus one local panelOpen flag:
 * 1. No decision — the full banner (category rows + Accept All / Save Preferences).
 * 2. Decision exists, panel closed — a small persistent floating trigger.
 * 3. Trigger clicked — the same form as state 1, pre-filled from the current decision.
 */
export function CookieConsentBanner({
  bannerTitle,
  bannerDescription,
  acceptAllLabel,
  savePreferencesLabel,
  reopenTriggerLabel,
  necessaryCategory,
  analyticsCategory,
  marketingCategory,
}: CookieConsentBannerProps) {
  const decision = useConsentDecision();
  const [panelOpen, setPanelOpen] = useState(false);
  const [analytics, setAnalytics] = useState(decision?.analytics ?? false);
  const [marketing, setMarketing] = useState(decision?.marketing ?? false);

  const openPanel = () => {
    setAnalytics(decision?.analytics ?? false);
    setMarketing(decision?.marketing ?? false);
    setPanelOpen(true);
  };

  const acceptAll = () => {
    setConsent({ analytics: true, marketing: true });
    setPanelOpen(false);
  };

  const savePreferences = () => {
    setConsent({ analytics, marketing });
    setPanelOpen(false);
  };

  if (decision !== null && !panelOpen) {
    return (
      <button type="button" data-press-consent="reopen" onClick={openPanel}>
        {reopenTriggerLabel}
      </button>
    );
  }

  return (
    <div data-press-consent="banner" role="region" aria-label="Cookie preferences">
      <p data-press-consent="title">{bannerTitle}</p>
      <p data-press-consent="description">{bannerDescription}</p>
      <div data-press-consent="category" data-category="necessary">
        <label>
          <input type="checkbox" checked disabled />
          {necessaryCategory.label}
        </label>
        <p>{necessaryCategory.description}</p>
      </div>
      <div data-press-consent="category" data-category="analytics">
        <label>
          <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
          {analyticsCategory.label}
        </label>
        <p>{analyticsCategory.description}</p>
      </div>
      <div data-press-consent="category" data-category="marketing">
        <label>
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
          {marketingCategory.label}
        </label>
        <p>{marketingCategory.description}</p>
      </div>
      <button type="button" data-press-consent="accept-all" onClick={acceptAll}>
        {acceptAllLabel}
      </button>
      <button type="button" data-press-consent="save-preferences" onClick={savePreferences}>
        {savePreferencesLabel}
      </button>
    </div>
  );
}
