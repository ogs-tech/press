# Cookie Consent Plugin — Design Decisions

> Cited from code as `cookie-consent Spec §N`. Per repo convention, this doc may
> be removed after merge — CLAUDE.md ("Engine plugins + cookie consent") is the
> living architectural reference for these decisions.

**Goal:** LGPD/GDPR cookie-consent for press sites — a category-based banner,
browser persistence, and a public consent API (`hasConsent('analytics')`) as
the seam for future consent-gated script loading. Ships as the FIRST member of
the engine's **plugin family**, introducing the `'plugin'` canonical entity.

## §1 — The `'plugin'` canonical + `PressPlugin` contract

- `Entity` gains `'plugin'` (additive, mirrors the ThemeName precedent).
- `PressPlugin<Id> extends Canonical<'plugin'>` fixes only what every engine
  plugin shares: a SYNTHETIC identity `urn:plugin:{id}` (the id is a
  compile-time constant per plugin — `'cookie-consent'` today — never
  CMS-sourced, mirroring `urn:site-setting:default`) and the `enabled` flag
  every plugin needs for the "seed active, editor-disable respected forever"
  pattern.
- **No runtime registry.** Each plugin is wired explicitly: config component on
  Site Settings → pure mapper → `ResolvedPressConfig.plugins.<key>` → explicit
  mount in the host layout. `plugins` is a NAMED map (like `chrome`), not an
  array: plugins are fixed engine features, not editor-composed content. Each
  new plugin adds a required key — a deliberate press-web major, same
  discipline as `urn`/`chrome`. A second plugin (e.g. consent-gated scripts)
  costs exactly what the first did: 1 CMS component + 1 mapper + 1 key + 1
  mount line.

## §2 — Closed consent categories

`ConsentCategory = 'necessary' | 'analytics' | 'marketing'` is a CLOSED code
union — the CMS edits per-category copy and offers on/off, never the key set.
`hasConsent('analytics')` must type-check against a compile-time constant that
cannot drift when an editor renames a row (the default-drift failure mode a
repeatable component would invite). A 4th category is an additive engine
change, ThemeName-style. `necessary` is exempt from consent and forced
enabled/true everywhere.

## §3 — Mapper fails OPEN (the deliberate exception)

`mapCookieConsent` diverges from identity/SEO's fail-to-empty rule: an
absent/unreachable CMS still resolves `enabled: true` + total default copy
(`DEFAULT_COOKIE_CONSENT`, the DEFAULT_THEME precedent). A consent gate that
silently disappears on a CMS hiccup fails *open* on a legal obligation — the
worst failure mode under LGPD; blank brand text is an honest state, a missing
consent gate is not. Copy merges with `||` (not `??`) so an editor-cleared
`''` also falls back — the `chrome.footer` `text || fallback` precedent for
copy that renders broken when blank. `hasConsent` stays fail-closed
independently: no stored decision ⇒ `false` for every optional category.

## §4 — Seed: booleans only, once

`seedCookieConsent` (plugin-store flag `cookieConsentSeeded`) writes only the
`enabled` booleans. Rationale: an unsaved Strapi boolean renders as an
unchecked toggle, which would contradict the live enabled-by-default banner —
a real admin-vs-site inconsistency. Text fields stay empty on purpose ("no
defaults duplicated in the CMS" — seed-site-setting precedent); default copy
lives web-side only. The seed does NOT set its flag when the Site Settings
record is missing (bootstrap order broken) so it self-heals next boot instead
of silently skipping forever.

## §5 — Client surface: first-party cookie + pre-paint hide

- Decision persists in a versioned first-party cookie (`press_consent`,
  `SameSite=Lax`, `Max-Age` 180d, `Secure` on https) — NOT localStorage: a
  cookie keeps the door open for server-adjacent consumers (middleware/route
  handlers) that the named evolution (script plugins) may need. Version
  mismatch/malformed ⇒ parsed as "no decision" (re-consent).
- **Never** read via `next/headers` `cookies()` in the RSC tree: that would
  force the whole route dynamic, killing static/ISR site-wide, and would bake
  one visitor's consent into cached HTML. The visitor's decision is
  client-only state.
- Anti-flash: `buildConsentBootstrapScript()` emits a tiny synchronous inline
  `<head>` script (the buildThemeStyle injection precedent) that stamps
  `<html data-press-consent="decided">` before first paint; theme.css hides
  the banner under that attribute. React state starts `null` on both sides
  (`useSyncExternalStore` with a `null` server snapshot — no hydration
  mismatch), then unmounts the banner after hydration. New visitors see the
  banner in the very first paint (it is in the SSR HTML); decided visitors
  never see it.
- `resetConsent()` (clears the cookie, re-shows the banner) is the minimal
  "change your mind" seam; a persistent reopen affordance (e.g. a footer link)
  is a known follow-up, deliberately out of scope.

## Out of scope (deliberate)

Script injection/gating (the API is the seam; no `<Script>` management yet),
cross-tab live sync (no `storage`-event equivalent for cookies; resolves on
next navigation), consent expiry/re-prompt policy, audit trail beyond the
`decidedAt` timestamp, adopter-defined categories, localized default copy (CMS
override is the localization path).

## Versioning

`@ogs-tech/press-web` **major**: `ResolvedPressConfig` gains the REQUIRED
`plugins` field (hand-constructed literals fail tsc — same justification as
canonical-urn). `Entity` extension is additive. `@ogs-tech/press-cms`
**minor**: purely additive (2 components, 1 attribute, populate, seed).
