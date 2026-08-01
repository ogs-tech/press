# Plugin/Legal — Design Decisions

> Cited from code as `plugin-legal Spec §N`. Per repo convention, this doc may
> be removed after merge — CLAUDE.md ("Engine plugins") is the living
> architectural reference for these decisions.

**Goal:** LGPD/GDPR compliance end-to-end as the engine's third real plugin —
a seeded privacy-policy page (Eixo A) and a category-based cookie-consent
banner + a public `hasConsent()` gate (Eixo B), both wired under one
`ResolvedPressConfig.plugins.legal` key, following the canonical structure
`example`/`seo` already proved (config component(s) on Site Settings → pure
mapper → `plugins.<key>` → explicit mount in the host). Cookie consent is
**not** the first plugin — `example` shipped first; a cookie-consent design
was drafted 2026-07-04 and retired before implementation. This spec
supersedes it: reuses its cookie-contract and `useSyncExternalStore`
mechanics, but drops the `PressPlugin<Id>`-implementing ambition (still
RESERVED — `example`/`seo` didn't implement it either, one more data point
short of a generalizable shape) and the "seed the enabled booleans" step
(§3.2 below).

**Depends on:** Base/Pages (`page` content-type, `seedPage` primitive),
Base/Plugin (the `plugins/<id>/` structure, `plugin::press-cms.plugin`
visibility index), Base/Components (`preset-atom.heading`/`paragraph` for
the seeded page body).

**Corrects a stale premise:** the originating brief's Eixo A asked to
"migrate `seed-page-privacy-policy.ts` out of core." That migration already
happened — `packages/cms/server/src/lib/seed-page.ts` is already the
generic, idempotent, exported-but-unused primitive, and `bootstrap.ts`
already seeds no pages. Eixo A's only remaining work is a `seedPage()` call
site plus its own gate (§3).

## §1 — CMS schema

Three new components, category `preset-config` (same category as
`basic-settings`/`seo`/`example-plugin`), plus two new `site-setting`
attributes:

**`preset-config.legal-pages`** (`site-setting.legalPages`):

| field | type | notes |
| --- | --- | --- |
| `enabled` | boolean, default `true` | gates the privacy-policy **seed** only (§3) — not a runtime toggle, no content field. The page's actual text is edited normally in Content Manager, like any other `page`. |

**`preset-config.cookie-consent`** (`site-setting.cookieConsent`):

| field | type | notes |
| --- | --- | --- |
| `enabled` | boolean, default `true` | the banner's gate — ships on, same "core surface, not a demo" reasoning as SEO |
| `bannerTitle` | string | e.g. "We use cookies" |
| `bannerDescription` | text | |
| `acceptAllLabel` | string | sets analytics+marketing on, saves, dismisses |
| `savePreferencesLabel` | string | saves whatever the two toggles are currently set to — an all-off save is a one-click full rejection, exactly as prominent as Accept All (no buried "reject" behind a second click) |
| `reopenTriggerLabel` | string | label on the persistent floating trigger shown once a decision exists (§5) |
| `necessaryCategory` | component (`preset-config.cookie-category`, non-repeatable) | copy only — always shown as locked-on, never a stored toggle |
| `analyticsCategory` | component (`preset-config.cookie-category`, non-repeatable) | |
| `marketingCategory` | component (`preset-config.cookie-category`, non-repeatable) | |

Three **named** category fields, not a repeatable list — `ConsentCategory =
'necessary' | 'analytics' | 'marketing'` is a closed code union (a 4th
category is an additive engine change, ThemeName-style), and named fields
make it structurally impossible for an editor to add one from the admin.

**`preset-config.cookie-category`** (nested, reused 3×): `label` (string),
`description` (text). No `enabled` field — whether a category is
user-toggleable is runtime UI logic (necessary is always locked on), not
CMS content; this keeps the schema uniform across all three named fields
with no special-casing.

**`site-setting/schema.json`** gains:
```json
"legalPages": { "type": "component", "repeatable": false, "component": "preset-config.legal-pages" },
"cookieConsent": { "type": "component", "repeatable": false, "component": "preset-config.cookie-consent" }
```

**Controller populate** (`site-setting.ts`'s `settingsPopulate()`):
```ts
legalPages: true,
cookieConsent: { populate: { necessaryCategory: true, analyticsCategory: true, marketingCategory: true } },
```

**No explicit boolean-seed step.** The retired 2026-07-04 spec planned a
`seedCookieConsent` pass that wrote `enabled: true` into the record so the
admin toggle wouldn't render unchecked against a live-enabled banner. Neither
shipped plugin (`example`, disabled by default; `seo`, enabled by default —
the closer precedent) does this today, and `seo`'s admin toggle has shipped
without it. Following the established precedent over the retired spec's
extra step: `mapLegal`'s fail-open default (§2) already makes the *runtime*
behavior correct regardless; if the admin-display gap turns out to matter in
practice, it's a `seo`-and-`legal` fix together, not a reason to diverge now.

## §2 — Types and mapper (web side)

`packages/web/src/plugins/legal/`:

- `types.ts` — `ConsentCategory`, `RawLegalPages`/`ResolvedLegalPages`
  (`{ enabled: boolean }`), `RawCookieCategory`/`ResolvedCookieCategory`
  (`{ label: string; description: string }`), `RawCookieConsent`/
  `ResolvedCookieConsent`, and the top-level `ResolvedLegalPlugin = { pages:
  { privacyPolicy: ResolvedLegalPages }; consent: ResolvedCookieConsent }`.
- `default-legal-pages.ts` — `DEFAULT_LEGAL_PAGES = { enabled: true }`.
- `default-cookie-consent.ts` — `DEFAULT_COOKIE_CONSENT`: `enabled: true`,
  English copy (the engine's usual default-copy language — the earlier draft
  of this spec defaulted to Portuguese since the brief centers LGPD, but the
  brief's own TIPO line already scopes this as LGPD **and** GDPR; English
  matches every other engine default and the editor localizes in Site
  Settings same as everything else).
- `map-legal.ts` — `mapLegal(pages: RawLegalPages | null | undefined, consent: RawCookieConsent | null | undefined): ResolvedLegalPlugin`,
  fail-open on both inputs, identical to `mapExamplePlugin` (not a deliberate
  exception to fail-to-empty as the originating brief framed it — this is
  just the established plugin-mapper convention).
- `ResolvedPressConfig.plugins` gains `legal: ResolvedLegalPlugin` (`config/types.ts`)
  — another required key, the same press-web major discipline every prior
  plugin key followed.
- `SiteSettingsData` gains `legalPages?: RawLegalPages | null` and
  `cookieConsent?: RawCookieConsent | null`; `map-site-settings.ts` calls
  `legal: mapLegal(c.legalPages, c.cookieConsent)`.
- **Plugin visibility index:** `PLUGIN_DEFINITIONS` (cms) gains **two**
  entries — `legal-pages` (`configHost: 'site-setting.legalPages'`,
  `defaultEnabled: true`) and `legal-consent` (`configHost:
  'site-setting.cookieConsent'`, `defaultEnabled: true`) — kept separate
  because they're independently toggleable (an adopter can want the page
  without the banner, or vice versa); `SiteSettingSnapshot` and
  `syncPluginEntries`'s populate call gain both fields.

## §3 — Eixo A: the privacy-policy seed

`packages/cms/server/src/lib/seed-legal-pages.ts`:

```ts
export async function seedLegalPages(strapi: Core.Strapi): Promise<void> {
  const site = (await strapi.documents(SITE_SETTING_UID).findFirst({
    populate: { legalPages: true },
  })) as { legalPages?: { enabled?: boolean } | null } | null;

  if (site?.legalPages?.enabled === false) return;

  await seedPage(strapi, {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    body: PRIVACY_POLICY_BODY,
    flagKey: 'legalPrivacyPolicySeeded',
  });
}
```

- **§3.1 Gate semantics:** `legalPages.enabled` is read once, at seed time —
  same "checked once" contract as `seedPage`'s own flag. Disabling it *after*
  the page already exists does not retroactively remove the page (matches
  "editor-deleted page respected forever"); it only prevents the seed on a
  fresh install. Absent component (fresh record, nothing populated yet) reads
  as `true` (`=== false` check, not `!== true`), matching the default.
- **§3.2 Placeholder body must be a real `PressTree`, not the old DZ shape.**
  `seed-page.test.ts`'s fixture (`[{ __component: 'preset-atom.paragraph',
  content: [] }]`) is the pre-tree Dynamic Zone array shape — it only passes
  because the test's fake `strapi` never runs the real `assertValidPageWrite`
  lifecycle guard. A real call must build a valid `PressTree` or the
  `beforeCreate` guard (already active on every `page` write) rejects it:
  ```ts
  const PRIVACY_POLICY_BODY: PressTree = {
    version: PRESS_TREE_VERSION,
    root: {
      type: 'layout',
      header: { mode: 'inherit' },
      footer: { mode: 'inherit' },
      children: [
        { id: randomUUID(), type: 'block', component: 'preset-atom.heading', data: { text: 'Privacy Policy', level: '1' } },
        { id: randomUUID(), type: 'block', component: 'preset-atom.paragraph', data: { content: 'This page is a placeholder — replace it with your actual privacy policy before launch.' } },
      ],
    },
  };
  ```
- Called from `bootstrap.ts` right after `seedSiteSetting(strapi)` (before
  `syncPluginEntries`, which stays last per its existing "Last" comment).
- Terms of service / cookie-policy pages: explicitly out of scope (§ below) —
  fast-follow, not this spec.

## §4 — Eixo B: the consent store

`packages/web/src/plugins/legal/consent-store.ts` — carries forward the
retired spec's cookie contract and hydration mechanics, which were already
sound:

- **Cookie:** `press_consent`, `SameSite=Lax`, `Secure` on https, `Path=/`,
  `Max-Age` 180 days. Value: `{ v: 1, analytics: boolean, marketing: boolean,
  decidedAt: number }` (JSON, URI-encoded) — `decidedAt` (`Date.now()` at
  decision time) is the minimal audit trail; `necessary` is never stored
  (always `true`). Version mismatch or malformed value parses as **no
  decision** (re-consent), never a throw.
- **Never read via `next/headers` `cookies()`** — that would force the whole
  route dynamic (killing ISR) and bake one visitor's decision into cached
  HTML. The decision is client-only state, full stop.
- **A tiny pub-sub store**, read through `useSyncExternalStore` — this is the
  React-native way to say "this value legitimately differs between server
  and first client paint," which is exactly the hydration problem here:
  ```ts
  function getSnapshot(): ConsentDecision | null { return readConsentCookie(); }
  function getServerSnapshot(): ConsentDecision | null { return null; }
  export function useConsentDecision() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }
  ```
  Server (and first client paint, to avoid a hydration-mismatch warning)
  always sees `null` ("no decision"); React swaps to the real cookie value
  immediately after hydration commits.
- **`setConsent({ analytics, marketing })`** and **`resetConsent()`** write/clear
  the cookie and notify subscribers — `resetConsent` is the primitive the
  reopened preferences panel (§5) calls on save-with-different-values, and
  what a future "forget me" affordance would call too.
- **`hasConsent(category: ConsentCategory): boolean`** — fail-closed: `'necessary'`
  is always `true`; any other category is `false` when `document` is undefined
  (SSR) or no decision is stored yet, else the stored boolean. **Exported,
  tested, no consumer wired in this plugin** — same "ready, not yet called"
  posture `seedPage` had before this spec, since no analytics/script plugin
  exists yet to gate.
- **Why `useSyncExternalStore` doesn't fully solve the flash on its own:** its
  server-snapshot trick prevents a *hydration-mismatch warning*, but a
  returning visitor's browser still paints the server HTML (full banner,
  `null` snapshot) for one frame before React corrects it post-hydration.
  The anti-flash script below closes that specific gap; the two mechanisms
  solve different problems (visual flash vs. React correctness) and are both
  needed.

## §5 — Eixo B: the banner component

`packages/web/src/plugins/legal/banner.tsx` — `'use client'`, the engine's
**second** client component (after `mobile-nav`), same hand-rolled-not-DZ
precedent `ExamplePlugin` set: this is global, always-mounted UI, not
something an editor places in the composition tree, so it is not built from
`preset-atom`/`preset-molecule` tree blocks.

Three states, driven by `useConsentDecision()` plus one local `panelOpen`
flag:

1. **No decision** (`decision === null`) — full banner: category rows
   (necessary locked-on, analytics/marketing toggles) + Accept All / Save
   Preferences buttons.
2. **Decision exists, panel closed** — a small persistent floating trigger
   (`reopenTriggerLabel`), fixed-position, satisfying GDPR/LGPD's
   right-to-withdraw without touching the Footer organism or adding any new
   cross-cutting plumbing into `TreeRenderer` (no plugin passes global state
   into tree-rendered blocks today — `site.layout` is the only precedent,
   and only for layout defaults).
3. **Trigger clicked** (`panelOpen === true`) — the same form as state 1,
   pre-filled from the current decision; saving calls `setConsent()` and
   closes the panel.

**Anti-flash:** a small inline `<script>` (raw text, not React — the
`buildThemeStyle` injection precedent), mounted in `layout.tsx`'s `<head>`
next to the theme style tag, that runs before hydration: reads
`document.cookie`, and if a decision already exists, stamps
`<html data-press-consent-decided>`. `theme.css` gains one rule hiding the
full-banner state under that attribute — closing the one-frame gap noted in
§4.

**Mount** (`templates/host/app/layout.tsx`):
```tsx
{site.plugins.legal.consent.enabled && <CookieConsentBanner {...site.plugins.legal.consent} />}
```
gated the same way `ExamplePlugin` is.

**A11y:** category rows are labeled checkboxes/switches; the banner is
`role="region" aria-label="Cookie preferences"` — not a modal dialog (it
doesn't block page interaction, an explicit simplification over a hard gate;
easy to escalate later if required). The floating trigger is a plain
`<button>` with the configured label.

## §6 — Package export surface

`packages/web/src/index.ts` gains:
```ts
export { CookieConsentBanner } from './plugins/legal/banner';
export { hasConsent, resetConsent } from './plugins/legal/consent-store';
export type { ResolvedLegalPlugin } from './plugins/legal/types';
```
`setConsent`/`useConsentDecision` stay internal to `banner.tsx` — no
external consumer needs them yet.

## §7 — Testing

- `seed-legal-pages.test.ts` (cms) — same fake-`strapi` harness as
  `seed-page.test.ts`: gate respected (`enabled: false` → no `seedPage`
  call), gate absent → seeds, idempotent across repeated boots.
- `sync-plugin-entries.test.ts` (cms) — the two new entries, same
  create-then-update coverage as `example`/`seo`.
- `map-legal.test.ts` (web) — fail-open on both `pages` and `consent` inputs
  independently; category copy passthrough.
- `consent-store.test.ts` (web, jsdom) — cookie round-trip; malformed/wrong-
  version value → `null`; `hasConsent('necessary')` always `true`;
  `hasConsent('analytics'|'marketing')` fail-closed with no cookie; SSR
  (`document` undefined) → `false` for non-necessary categories.
- `banner.test.tsx` (web, jsdom, hand-rolled `act()`+`createRoot` harness —
  the `mobile-nav` precedent, not `@testing-library`) — renders full banner
  with no decision; Accept All persists `{analytics:true,marketing:true}`
  and swaps to the floating trigger; Save Preferences with both toggles off
  persists an all-`false` decision (one-click full rejection); clicking the
  trigger reopens the panel pre-filled from the stored decision.
- `packages/cms` backend `tsc` typecheck covers the three new component
  schemas structurally, as it already does for every `preset-config.*`
  addition.

## Out of scope (deliberate)

Terms of service / cookie-policy pages (Eixo A fast-follow — `seedLegalPages`
is written as a single-page call, not a loop/array, until a second page seed
actually needs that shape). Any real script/analytics consumer of
`hasConsent()` (waits on a future Analytics/Forms plugin). Cross-tab live
sync (no `storage`-event equivalent for cookies; resolves on next
navigation). Consent expiry/re-prompt policy beyond the 180-day cookie
lifetime. Audit trail beyond the single `decidedAt` timestamp. Adopter-
defined consent categories (closed union by design). A hard-gating modal
that blocks page interaction until a decision is made. Implementing
`PressPlugin<Id>`/`urn:plugin:legal` (stays RESERVED, same as `example`/
`seo`).

## Versioning

`@ogs-tech/press-web` **major**: `ResolvedPressConfig.plugins` gains the
required `legal` key (hand-constructed literals fail `tsc`, same
justification as every prior plugin key). `@ogs-tech/press-cms` **minor**:
additive only (3 new components, 2 new `site-setting` attributes, 1
populate change, 2 new `PLUGIN_DEFINITIONS` entries, 1 new bootstrap call).
