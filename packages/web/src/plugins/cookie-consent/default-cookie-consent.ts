import type { ResolvedCookieConsentPlugin } from './types';

/**
 * Engine-shipped banner copy (cookie-consent Spec §3) — the SINGLE source of
 * default text, merged per-field at the mapping boundary exactly like
 * DEFAULT_THEME. Deliberately NOT seeded into the CMS: text fields stay empty
 * there ("no defaults duplicated in the CMS", seed-site-setting precedent);
 * localized copy is a CMS override, not an engine concern.
 */
export const DEFAULT_COOKIE_CONSENT: Pick<ResolvedCookieConsentPlugin, 'texts' | 'categories'> = {
  texts: {
    title: 'Cookies on this site',
    description:
      'We use cookies to make this site work and to understand how it is used. ' +
      'You can accept all cookies, reject the optional ones, or manage each category.',
    acceptAllLabel: 'Accept all',
    rejectAllLabel: 'Reject optional',
    manageLabel: 'Manage preferences',
    saveLabel: 'Save preferences',
    privacyLinkLabel: 'Privacy policy',
  },
  categories: {
    necessary: {
      enabled: true,
      label: 'Necessary',
      description: 'Required for the site to function. Always on.',
    },
    analytics: {
      enabled: true,
      label: 'Analytics',
      description: 'Help us understand how the site is used.',
    },
    marketing: {
      enabled: true,
      label: 'Marketing',
      description: 'Used to personalize campaigns and measure their reach.',
    },
  },
};
