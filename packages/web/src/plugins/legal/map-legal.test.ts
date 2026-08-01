import { describe, expect, it } from 'vitest';
import { mapLegal } from './map-legal';
import { DEFAULT_LEGAL_PAGES } from './default-legal-pages';
import { DEFAULT_COOKIE_CONSENT } from './default-cookie-consent';

describe('mapLegal', () => {
  it('resolves DEFAULT_LEGAL_PAGES and DEFAULT_COOKIE_CONSENT when both inputs are null', () => {
    const r = mapLegal(null, null);
    expect(r.pages.privacyPolicy).toEqual(DEFAULT_LEGAL_PAGES);
    expect(r.consent).toEqual(DEFAULT_COOKIE_CONSENT);
  });

  it('resolves defaults when both inputs are undefined', () => {
    const r = mapLegal(undefined, undefined);
    expect(r.pages.privacyPolicy).toEqual(DEFAULT_LEGAL_PAGES);
    expect(r.consent).toEqual(DEFAULT_COOKIE_CONSENT);
  });

  it('fails open on legalPages independently of cookieConsent', () => {
    const r = mapLegal(null, { enabled: false });
    expect(r.pages.privacyPolicy).toEqual(DEFAULT_LEGAL_PAGES);
    expect(r.consent.enabled).toBe(false);
  });

  it('fails open on cookieConsent independently of legalPages', () => {
    const r = mapLegal({ enabled: false }, null);
    expect(r.pages.privacyPolicy.enabled).toBe(false);
    expect(r.consent).toEqual(DEFAULT_COOKIE_CONSENT);
  });

  it('lets a present legalPages.enabled win over the default', () => {
    expect(mapLegal({ enabled: false }, null).pages.privacyPolicy.enabled).toBe(false);
  });

  it('lets present cookieConsent fields win over defaults, field by field', () => {
    const r = mapLegal(null, { bannerTitle: 'Custom', acceptAllLabel: 'Yes please' });
    expect(r.consent.bannerTitle).toBe('Custom');
    expect(r.consent.acceptAllLabel).toBe('Yes please');
    expect(r.consent.savePreferencesLabel).toBe(DEFAULT_COOKIE_CONSENT.savePreferencesLabel);
  });

  it('passes category copy through per-field, falling back per-field to the default category', () => {
    const r = mapLegal(null, { analyticsCategory: { label: 'Tracking' } });
    expect(r.consent.analyticsCategory).toEqual({
      label: 'Tracking',
      description: DEFAULT_COOKIE_CONSENT.analyticsCategory.description,
    });
    expect(r.consent.necessaryCategory).toEqual(DEFAULT_COOKIE_CONSENT.necessaryCategory);
  });

  it('resolves a null category component to the full default category', () => {
    expect(mapLegal(null, { marketingCategory: null }).consent.marketingCategory).toEqual(
      DEFAULT_COOKIE_CONSENT.marketingCategory,
    );
  });
});
