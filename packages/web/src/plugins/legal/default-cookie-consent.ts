import type { ResolvedCookieConsent } from './types';

/**
 * Ships ENABLED, with English copy (Plugin/Legal Spec §2) — the engine's
 * usual default-copy language, matching every other engine default; the
 * editor localizes in Site Settings same as everything else.
 */
export const DEFAULT_COOKIE_CONSENT: ResolvedCookieConsent = {
  enabled: true,
  bannerTitle: 'We use cookies',
  bannerDescription:
    'We use cookies to run this site and, with your permission, to measure usage and personalize marketing.',
  acceptAllLabel: 'Accept all',
  savePreferencesLabel: 'Save preferences',
  reopenTriggerLabel: 'Cookie preferences',
  necessaryCategory: {
    label: 'Necessary',
    description: 'Required for the site to function. Always on.',
  },
  analyticsCategory: {
    label: 'Analytics',
    description: 'Helps us understand how visitors use the site.',
  },
  marketingCategory: {
    label: 'Marketing',
    description: 'Used to show relevant ads and measure their performance.',
  },
};
