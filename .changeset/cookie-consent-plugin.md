---
'@ogs-tech/press-web': major
'@ogs-tech/press-cms': minor
---

feat!: cookie-consent — the first engine plugin, introducing the `'plugin'` canonical

**Engine plugins (press-web).** `Entity` gains `'plugin'` (additive) and the
new `PressPlugin<Id>` contract (`extends Canonical<'plugin'>`, `id`, `enabled`)
formalizes the plugin family: an optional engine capability configured through
Site Settings, resolved by a pure mapper into the new
`ResolvedPressConfig.plugins` named map, and mounted explicitly by the host
layout — no runtime registry. Plugin identity is synthetic
(`urn:plugin:cookie-consent`), never CMS-sourced.

**Cookie consent (press-web).** New `CookieConsentBanner` (the engine's first
stateful client component), the `useConsent()` hook, and the consent store:
`hasConsent('analytics')` (fail-closed), `acceptAll`/`rejectAll`/`setConsent`/
`resetConsent`, `parseConsentCookie` (server-side seam), and
`buildConsentBootstrapScript()` — a pre-paint inline script the host layout
injects so a decided visitor never sees the banner flash. The decision lives
in a versioned first-party cookie (`press_consent`, SameSite=Lax, 180d), never
read via `cookies()` in the RSC tree (static/ISR stays intact). The resolved
plugin FAILS OPEN: an unreachable CMS still yields an enabled banner with the
engine's default copy — a consent gate must not vanish on a CMS hiccup.
Consent categories are a closed code union (`necessary | analytics |
marketing`); editors toggle and re-word them, never rename keys.

**Cookie consent (press-cms).** New `press.cookie-consent` +
`press.cookie-category` config components (injected, never DZ-admitted), a
`cookieConsent` attribute on Site Settings with deep populate (nested
categories + privacy page slug), and a run-once seed (`cookieConsentSeeded`
plugin-store flag) that writes only the `enabled` booleans — default copy
lives web-side; an editor-disabled banner is respected forever.

BREAKING (press-web): `ResolvedPressConfig` gains a REQUIRED `plugins` field.
Runtime is additive — every object produced by `getSiteConfig` carries it —
but adopter code that hand-constructs a literal (test fixtures, mocks) fails
`tsc` until it adds `plugins: { cookieConsent: ... }` (or builds the value
through `mapSiteSettings`). The host template's `layout.tsx` also changed
(bootstrap script + banner mount) and is re-materialized on the next
`press dev`/`build`.
