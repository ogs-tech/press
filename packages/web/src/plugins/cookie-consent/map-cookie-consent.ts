import { buildUrn } from '../../urn';
import { DEFAULT_COOKIE_CONSENT } from './default-cookie-consent';
import type {
  ConsentCategory,
  RawCookieConsent,
  ResolvedCookieCategory,
  ResolvedCookieConsentPlugin,
} from './types';

const PLUGIN_ID = 'cookie-consent' as const;
const CATEGORY_IDS: ConsentCategory[] = ['necessary', 'analytics', 'marketing'];

/**
 * Pure CMS-shape → ResolvedCookieConsentPlugin (cookie-consent Spec §3). Same
 * input → same output, no I/O — the mapSiteSettings pure-mapper discipline.
 *
 * FAILS OPEN — the deliberate exception to identity/SEO's fail-to-empty rule:
 * an absent/unreachable CMS still resolves `enabled: true` + total default
 * copy (the DEFAULT_THEME always-total precedent). A consent gate that
 * silently disappears on a CMS hiccup fails open on a legal obligation — the
 * worst failure mode under LGPD; blank brand text is an honest state, a
 * missing consent gate is not. Copy merges with `||` (not `??`) so an
 * editor-cleared '' also falls back — the preset-organism.footer `text || fallback`
 * precedent for copy that renders broken when blank.
 *
 * The urn is SYNTHETIC (`urn:plugin:cookie-consent`) — identity is never
 * CMS-sourced (canonical-urn Spec §3 applied to plugins, Spec §1).
 */
export function mapCookieConsent(
  raw: RawCookieConsent | null | undefined,
  homeSlug: string,
): ResolvedCookieConsentPlugin {
  const r = raw ?? {};
  const categories = {} as Record<ConsentCategory, ResolvedCookieCategory>;
  for (const id of CATEGORY_IDS) {
    const rc = r[id] ?? {};
    const fallback = DEFAULT_COOKIE_CONSENT.categories[id];
    categories[id] = {
      // `necessary` is exempt from consent — forced offered/true regardless of
      // the stored value (Spec §2).
      enabled: id === 'necessary' ? true : rc.enabled ?? fallback.enabled,
      label: rc.label || fallback.label,
      description: rc.description || fallback.description,
    };
  }
  // Same home-slug collapse as resolveNavItem: the privacy link reuses the
  // build-time routes.home anchor, CMS-independent.
  const slug = r.privacyPage?.slug;
  return {
    urn: buildUrn('plugin', PLUGIN_ID),
    id: PLUGIN_ID,
    enabled: r.enabled ?? true,
    texts: {
      title: r.title || DEFAULT_COOKIE_CONSENT.texts.title,
      description: r.description || DEFAULT_COOKIE_CONSENT.texts.description,
      acceptAllLabel: r.acceptAllLabel || DEFAULT_COOKIE_CONSENT.texts.acceptAllLabel,
      rejectAllLabel: r.rejectAllLabel || DEFAULT_COOKIE_CONSENT.texts.rejectAllLabel,
      manageLabel: r.manageLabel || DEFAULT_COOKIE_CONSENT.texts.manageLabel,
      saveLabel: r.saveLabel || DEFAULT_COOKIE_CONSENT.texts.saveLabel,
      privacyLinkLabel: r.privacyLinkLabel || DEFAULT_COOKIE_CONSENT.texts.privacyLinkLabel,
    },
    categories,
    privacyPolicyHref: slug ? (slug === homeSlug ? '/' : `/${slug}`) : undefined,
  };
}
