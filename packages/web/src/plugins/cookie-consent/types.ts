import type { PressPlugin } from '../../plugin';

/**
 * The CLOSED set of consent categories (cookie-consent Spec §2). Code-fixed —
 * the CMS edits per-category copy and offers on/off, never the key set — so
 * `hasConsent('analytics')` type-checks against a constant that cannot drift
 * when an editor renames a row. A 4th category is an additive engine change
 * (the ThemeName precedent).
 */
export type ConsentCategory = 'necessary' | 'analytics' | 'marketing';

/**
 * The visitor's persisted decision (cookie-consent Spec §5). Versioned so a
 * future category-set change can force re-consent by bumping `v`. `necessary`
 * is structurally always true — exempt from consent by design (Spec §2).
 */
export interface ConsentState {
  v: 1;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  /** ISO timestamp of the decision — the minimal audit anchor. */
  decidedAt: string;
}

/** Raw `preset-config.cookie-category` payload as populated by the site-setting controller. */
export interface RawCookieCategory {
  enabled?: boolean;
  label?: string;
  description?: string;
}

/**
 * Raw `preset-config.cookie-consent` payload as populated by the site-setting
 * controller. EVERY field is optional: an unfilled component and an
 * unreachable CMS both map as if absent (the SiteSettingsData rule).
 */
export interface RawCookieConsent {
  enabled?: boolean;
  title?: string;
  description?: string;
  acceptAllLabel?: string;
  rejectAllLabel?: string;
  manageLabel?: string;
  saveLabel?: string;
  privacyLinkLabel?: string;
  privacyPage?: { slug?: string } | null;
  necessary?: RawCookieCategory | null;
  analytics?: RawCookieCategory | null;
  marketing?: RawCookieCategory | null;
}

/** One resolved consent category: offered or not, plus its total copy. */
export interface ResolvedCookieCategory {
  /** Whether the category appears in the banner's preferences panel (`necessary` is always true). */
  enabled: boolean;
  label: string;
  description: string;
}

/**
 * The resolved cookie-consent plugin (cookie-consent Spec §1/§3): TOTAL —
 * every default applied, present even when the CMS is empty or unreachable.
 * Rendered by CookieConsentBanner; the visitor's own decision is NOT here
 * (it is client-only state, never part of the ISR-cached config).
 */
export interface ResolvedCookieConsentPlugin extends PressPlugin<'cookie-consent'> {
  texts: {
    title: string;
    description: string;
    acceptAllLabel: string;
    rejectAllLabel: string;
    manageLabel: string;
    saveLabel: string;
    privacyLinkLabel: string;
  };
  categories: Record<ConsentCategory, ResolvedCookieCategory>;
  /** Resolved href of the linked privacy-policy page; undefined when unset. */
  privacyPolicyHref?: string;
}
