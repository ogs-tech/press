/**
 * Wire + resolved shapes for the Legal plugin (Plugin/Legal Spec §2) — a
 * seeded privacy-policy page gate (Eixo A) plus a category-based
 * cookie-consent banner (Eixo B). `Raw` mirrors the CMS component verbatim
 * (every field optional); `Resolved` is TOTAL — the shape `CookieConsentBanner`
 * and `ResolvedPressConfig.plugins.legal` actually consume.
 */

/** Closed union by design — a 4th category is an additive engine change. */
export type ConsentCategory = 'necessary' | 'analytics' | 'marketing';

export interface RawCookieCategory {
  label?: string;
  description?: string;
}

export interface ResolvedCookieCategory {
  label: string;
  description: string;
}

export interface RawLegalPages {
  enabled?: boolean;
}

export interface ResolvedLegalPages {
  enabled: boolean;
}

export interface RawCookieConsent {
  enabled?: boolean;
  bannerTitle?: string;
  bannerDescription?: string;
  acceptAllLabel?: string;
  savePreferencesLabel?: string;
  reopenTriggerLabel?: string;
  necessaryCategory?: RawCookieCategory | null;
  analyticsCategory?: RawCookieCategory | null;
  marketingCategory?: RawCookieCategory | null;
}

export interface ResolvedCookieConsent {
  enabled: boolean;
  bannerTitle: string;
  bannerDescription: string;
  acceptAllLabel: string;
  savePreferencesLabel: string;
  reopenTriggerLabel: string;
  necessaryCategory: ResolvedCookieCategory;
  analyticsCategory: ResolvedCookieCategory;
  marketingCategory: ResolvedCookieCategory;
}

export interface ResolvedLegalPlugin {
  pages: { privacyPolicy: ResolvedLegalPages };
  consent: ResolvedCookieConsent;
}
