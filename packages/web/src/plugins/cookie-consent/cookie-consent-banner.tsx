'use client';

import { useState } from 'react';
import { useConsent } from './use-consent';
import type { ResolvedCookieConsentPlugin } from './types';

const OPTIONAL_CATEGORIES = ['analytics', 'marketing'] as const;

/**
 * CookieConsentBanner — the cookie-consent plugin's render surface
 * (cookie-consent Spec §5). The engine's first stateful client component.
 *
 * Visibility contract: the banner IS part of the SSR HTML (a new visitor sees
 * it in the very first paint — no pop-in), and a decided visitor never sees
 * it: pre-paint the bootstrap script + the theme.css attribute rule hide it,
 * post-hydration `consent !== null` unmounts it. Both server and first client
 * render see `consent === null` (useSyncExternalStore's null server
 * snapshot), so hydration can never mismatch.
 *
 * The component is intentionally dumb about config: `plugin` arrives TOTAL
 * from mapCookieConsent — no defaulting here (the TreeRenderer "renderers
 * stay dumb" discipline).
 */
export function CookieConsentBanner({ plugin }: { plugin: ResolvedCookieConsentPlugin }) {
  const { consent, setConsent, acceptAll, rejectAll } = useConsent();
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, marketing: false });

  if (!plugin.enabled) return null;
  if (consent !== null) return null; // decided → gone (pre-paint hiding is the CSS attr rule)

  const offered = OPTIONAL_CATEGORIES.filter((id) => plugin.categories[id].enabled);

  return (
    <section
      data-press-plugin="cookie-consent"
      role="region"
      aria-label={plugin.texts.title}
    >
      <div data-consent="body">
        <p data-consent="title">{plugin.texts.title}</p>
        <p data-consent="description">
          {plugin.texts.description}
          {plugin.privacyPolicyHref ? (
            <>
              {' '}
              <a href={plugin.privacyPolicyHref}>{plugin.texts.privacyLinkLabel}</a>
            </>
          ) : null}
        </p>
      </div>
      {managing ? (
        <div data-consent="categories">
          <label data-consent="category">
            <input type="checkbox" checked disabled />
            <span data-consent="category-label">{plugin.categories.necessary.label}</span>
            <span data-consent="category-description">{plugin.categories.necessary.description}</span>
          </label>
          {offered.map((id) => (
            <label key={id} data-consent="category">
              <input
                type="checkbox"
                checked={draft[id]}
                onChange={(e) => setDraft({ ...draft, [id]: e.target.checked })}
              />
              <span data-consent="category-label">{plugin.categories[id].label}</span>
              <span data-consent="category-description">{plugin.categories[id].description}</span>
            </label>
          ))}
        </div>
      ) : null}
      <div data-consent="actions">
        <button type="button" data-variant="primary" onClick={() => acceptAll()}>
          {plugin.texts.acceptAllLabel}
        </button>
        <button type="button" data-variant="secondary" onClick={() => rejectAll()}>
          {plugin.texts.rejectAllLabel}
        </button>
        {managing ? (
          <button type="button" data-variant="secondary" onClick={() => setConsent(draft)}>
            {plugin.texts.saveLabel}
          </button>
        ) : (
          <button type="button" data-variant="ghost" onClick={() => setManaging(true)}>
            {plugin.texts.manageLabel}
          </button>
        )}
      </div>
    </section>
  );
}
