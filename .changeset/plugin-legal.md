---
'@ogs-tech/press-web': major
'@ogs-tech/press-cms': minor
---

feat: Plugin/Legal — seeded privacy-policy page + category-based cookie-consent banner

The engine's third real plugin, built on the Base/Plugin framework: LGPD/GDPR
compliance end-to-end under one `ResolvedPressConfig.plugins.legal` key.

**Eixo A — privacy-policy seed.** A new `preset-config.legal-pages` Site
Settings component (`enabled`, default true) gates `seedLegalPages`, a
bootstrap step built on the existing `seedPage` primitive: it creates a DRAFT
"Privacy Policy" page (slug `privacy-policy`, a placeholder heading +
paragraph) exactly once, respecting an adopter's own page on that slug and
never re-seeding after an editor deletes it. `seedPage`'s `body` parameter is
also corrected from the pre-tree Dynamic Zone array shape (`unknown[]`) to
`PressTree` — a stale type nobody had exercised since the composition-tree
migration, since `seedPage` had no real caller until this plugin.

**Eixo B — cookie-consent banner + hasConsent() gate.** A new
`preset-config.cookie-consent` Site Settings component (banner copy + three
named category fields — necessary/analytics/marketing, a closed union, not a
repeatable list) feeds a client-only `press_consent` cookie store
(`useSyncExternalStore`, 180-day `SameSite=Lax` cookie, version-guarded
parsing that treats any malformed value as no decision) and a hand-rolled
`'use client'` `CookieConsentBanner` — the engine's second client component
after `MobileNav`. Three states: full banner (no decision), a floating reopen
trigger (decision exists), and the same form reopened pre-filled. An inline
anti-flash `<script>` (the `buildThemeStyle` `<style>`-injection precedent)
stamps `data-press-consent-decided` on `<html>` before hydration so a
returning visitor never sees the full banner flash. `hasConsent(category)` is
exported, tested, fail-closed — no consumer wired in this plugin yet (same
"ready, not yet called" posture `seedPage` had before this spec).

Both toggles are mirrored into the read-only `plugin::press-cms.plugin`
Content-Manager index as two independently-toggleable entries (`legal-pages`,
`legal-consent`), same as every prior plugin.

**Ships enabled by default** — the "core surface, not a demo" reasoning `seo`
already established, not `example`'s "ships disabled" precedent.

BREAKING (press-web): `ResolvedPressConfig.plugins` gains the required
`legal: ResolvedLegalPlugin` key.

press-cms is additive only: three new components, two new Site Settings
attributes, one controller populate change, one bootstrap step, two new
`PLUGIN_DEFINITIONS` entries.
