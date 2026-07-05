import { describe, expect, it } from 'vitest';
import { DEFAULT_COOKIE_CONSENT } from './default-cookie-consent';
import { mapCookieConsent } from './map-cookie-consent';

const HOME = 'home';

describe('mapCookieConsent (cookie-consent Spec §3)', () => {
  it('fails OPEN: a null CMS resolves enabled:true + total default copy + the synthetic urn', () => {
    const r = mapCookieConsent(null, HOME);
    expect(r.urn).toBe('urn:plugin:cookie-consent');
    expect(r.id).toBe('cookie-consent');
    expect(r.enabled).toBe(true);
    expect(r.texts).toEqual(DEFAULT_COOKIE_CONSENT.texts);
    expect(r.categories).toEqual(DEFAULT_COOKIE_CONSENT.categories);
    expect(r.privacyPolicyHref).toBeUndefined();
  });

  it('maps an empty {} CMS identically to null', () => {
    expect(mapCookieConsent({}, HOME)).toEqual(mapCookieConsent(null, HOME));
  });

  it('respects an editor-disabled banner (enabled:false is data, not absence)', () => {
    expect(mapCookieConsent({ enabled: false }, HOME).enabled).toBe(false);
  });

  it('merges copy per-field: an override wins, siblings keep the default', () => {
    const r = mapCookieConsent({ title: 'Cookies?' }, HOME);
    expect(r.texts.title).toBe('Cookies?');
    expect(r.texts.description).toBe(DEFAULT_COOKIE_CONSENT.texts.description);
    expect(r.texts.acceptAllLabel).toBe(DEFAULT_COOKIE_CONSENT.texts.acceptAllLabel);
  });

  it("falls back on an editor-cleared '' — || semantics, the preset-organism.footer precedent", () => {
    const r = mapCookieConsent({ title: '', acceptAllLabel: '' }, HOME);
    expect(r.texts.title).toBe(DEFAULT_COOKIE_CONSENT.texts.title);
    expect(r.texts.acceptAllLabel).toBe(DEFAULT_COOKIE_CONSENT.texts.acceptAllLabel);
  });

  it('forces necessary enabled:true even when the CMS stores false (Spec §2)', () => {
    const r = mapCookieConsent({ necessary: { enabled: false, label: 'Essential' } }, HOME);
    expect(r.categories.necessary.enabled).toBe(true);
    expect(r.categories.necessary.label).toBe('Essential'); // copy still editable
  });

  it('lets an editor hide an optional category (enabled:false) and override its copy', () => {
    const r = mapCookieConsent(
      { marketing: { enabled: false }, analytics: { label: 'Métricas' } },
      HOME,
    );
    expect(r.categories.marketing.enabled).toBe(false);
    expect(r.categories.marketing.label).toBe(DEFAULT_COOKIE_CONSENT.categories.marketing.label);
    expect(r.categories.analytics.enabled).toBe(true);
    expect(r.categories.analytics.label).toBe('Métricas');
    expect(r.categories.analytics.description).toBe(
      DEFAULT_COOKIE_CONSENT.categories.analytics.description,
    );
  });

  it('resolves the privacy page slug to /slug, collapsing the home slug to /', () => {
    expect(mapCookieConsent({ privacyPage: { slug: 'privacy-policy' } }, HOME).privacyPolicyHref).toBe(
      '/privacy-policy',
    );
    expect(mapCookieConsent({ privacyPage: { slug: 'home' } }, HOME).privacyPolicyHref).toBe('/');
    expect(mapCookieConsent({ privacyPage: null }, HOME).privacyPolicyHref).toBeUndefined();
    expect(mapCookieConsent({ privacyPage: {} }, HOME).privacyPolicyHref).toBeUndefined();
  });
});
