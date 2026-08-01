import type {
  RawLegalPages,
  RawCookieConsent,
  RawCookieCategory,
  ResolvedCookieCategory,
  ResolvedLegalPlugin,
} from './types';
import { DEFAULT_LEGAL_PAGES } from './default-legal-pages';
import { DEFAULT_COOKIE_CONSENT } from './default-cookie-consent';

function mapCategory(
  raw: RawCookieCategory | null | undefined,
  fallback: ResolvedCookieCategory,
): ResolvedCookieCategory {
  return {
    label: raw?.label ?? fallback.label,
    description: raw?.description ?? fallback.description,
  };
}

/**
 * Pure CMS-shape → ResolvedLegalPlugin (Plugin/Legal Spec §2): FAIL-OPEN on
 * `pages` and `consent` independently, identical to mapExamplePlugin/
 * mapSeoPlugin — the established plugin-mapper convention, not a deliberate
 * exception.
 */
export function mapLegal(
  pages: RawLegalPages | null | undefined,
  consent: RawCookieConsent | null | undefined,
): ResolvedLegalPlugin {
  return {
    pages: {
      privacyPolicy: { enabled: pages?.enabled ?? DEFAULT_LEGAL_PAGES.enabled },
    },
    consent: {
      enabled: consent?.enabled ?? DEFAULT_COOKIE_CONSENT.enabled,
      bannerTitle: consent?.bannerTitle ?? DEFAULT_COOKIE_CONSENT.bannerTitle,
      bannerDescription: consent?.bannerDescription ?? DEFAULT_COOKIE_CONSENT.bannerDescription,
      acceptAllLabel: consent?.acceptAllLabel ?? DEFAULT_COOKIE_CONSENT.acceptAllLabel,
      savePreferencesLabel: consent?.savePreferencesLabel ?? DEFAULT_COOKIE_CONSENT.savePreferencesLabel,
      reopenTriggerLabel: consent?.reopenTriggerLabel ?? DEFAULT_COOKIE_CONSENT.reopenTriggerLabel,
      necessaryCategory: mapCategory(consent?.necessaryCategory, DEFAULT_COOKIE_CONSENT.necessaryCategory),
      analyticsCategory: mapCategory(consent?.analyticsCategory, DEFAULT_COOKIE_CONSENT.analyticsCategory),
      marketingCategory: mapCategory(consent?.marketingCategory, DEFAULT_COOKIE_CONSENT.marketingCategory),
    },
  };
}
