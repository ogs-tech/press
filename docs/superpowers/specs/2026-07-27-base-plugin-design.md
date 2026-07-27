# Base/Plugin — Design Decisions

> Cited from code as `base-plugin Spec §N`. Per repo convention, this doc may
> be removed after merge — CLAUDE.md ("Engine plugins") is the living
> architectural reference for these decisions.

**Goal:** the reusable plugin framework every future engine plugin (Legal,
Forms, SMTP, i18n, SEO, Plugin/Site for Company, Marketplace) builds on. Not a
single feature — the *contract* (`PressPlugin<Id>`, already merged and
RESERVED-unimplemented since the cookie-consent retirement) plus the
*canonical structure* every plugin author copies, proven by one concrete
example plugin wired through the real pipeline, plus a Content-Manager
visibility index of installed plugins.

**Depends on:** Base/Canonical (`Canonical<E>`, `Urn<E>`, `buildUrn` — already
shipped in `packages/web/src/urn.ts`).

**Prior art:** an earlier attempt (`0baed37`, branch `feat/canonical-consolidation`)
sketched this same shape while cookie-consent was still plugin #1 — a
mapper/domain-store split, `DEFAULT_*` constants, a `plugin` collection type.
That branch was abandoned mid-work (the collection-type schema and
`sync-plugin-entries.ts` were referenced from `bootstrap.ts` but never
actually committed) when cookie-consent was fully retired instead. This spec
re-derives the design against today's requirements — informed by that
prior art, not a resurrection of it.

## §1 — The `PressPlugin<Id>` contract (unchanged)

`packages/web/src/plugin.ts` already fixes the whole contract and does not
change: `extends Canonical<'plugin'>` (synthetic `urn:plugin:{id}`, the id a
compile-time constant, never CMS-sourced) + `enabled: boolean`. No runtime
registry — every plugin is wired by hand (§3).

## §2 — Canonical plugin structure: convention, not shared code

A plugin lives at `packages/web/src/plugins/<plugin-id>/`:

| file | role |
| --- | --- |
| `types.ts` | `Raw<Plugin>` (CMS wire shape) and `Resolved<Plugin>` (TOTAL, render-ready) |
| `default-<plugin>.ts` | one `DEFAULT_<PLUGIN>` constant (includes `enabled`) |
| `map-<plugin>.ts` | pure `Raw → Resolved` mapper, **fail-open** — resolves a total, well-typed value even when the CMS component is `null`/absent, no I/O |
| a domain store | **optional** — only when the plugin has runtime/visitor DECISIONS beyond config (the cookie-consent precedent: `hasConsent`, fail-closed). Most plugins (template/page installers, SEO, i18n) won't have one. |
| React component(s) | dumb shell — receives the already-resolved `Resolved<Plugin>` and renders; never re-resolves defaults itself |

This is deliberately **not** enforced by a shared base class, factory, or
helper — only `PressPlugin<Id>` and the `Canonical`/`buildUrn` primitives are
shared runtime code (§1). One example plugin isn't enough evidence to know
what generalizes across a template-installer plugin, a config-only plugin
(SEO), and a stateful one (a future consent/legal plugin) — a shared helper
gets revisited once a second real plugin exists and the common shape is
visible from two data points, not one.

Business rules never live in the CMS component (that's data/a form) or in the
React component (that's a shell) — they live in the mapper (config-resolution
rules) and, if present, the domain store (decision rules).

## §3 — Wiring: the `example` plugin, end to end

The example plugin is synthetic (no product value) but wired for real — it
touches the actual `site-setting` schema and the actual host `layout.tsx`
template, the same files a real plugin would. It ships **disabled by
default** (`DEFAULT_EXAMPLE_PLUGIN.enabled = false`): fully wired and
provably works when toggled on, but a fresh adopter site shows nothing extra
out of the box. It carries one boolean (`enabled`) and one string (`message`)
— no client interactivity, so its React component is a plain server
component, not a `'use client'` shell (a better structural precedent for most
future plugins than cookie-consent's client-heavy banner was).

The six wiring points, in pipeline order:

1. **CMS component** — `preset-config.example-plugin`
   (`packages/cms/server/src/components/config/example-plugin.json`), same
   category as `basic-settings`/`layout`. Fields: `enabled: boolean`,
   `message: string`. `config.metadatas` sets `edit.label`/`edit.description`
   per field (the `Field.Hint` convention already used by `basic-settings.json`).
2. **Site Settings attribute** — `examplePlugin` on
   `site-setting/schema.json`, alongside `basicSettings`/`layout`.
3. **Controller populate** — `settingsPopulate()` in
   `controllers/site-setting.ts` gains `examplePlugin: true` (scalar fields
   only, no media/nested component to deep-populate).
4. **Raw type** — `RawExamplePlugin` in `config/types.ts`;
   `SiteSettingsData.examplePlugin?: RawExamplePlugin | null`.
5. **Mapper** — `mapExamplePlugin(raw): ResolvedExamplePlugin`
   (`plugins/example/map-example-plugin.ts`), merges over
   `DEFAULT_EXAMPLE_PLUGIN`. Called from `mapSiteSettings`, feeding a new
   required field `ResolvedPressConfig.plugins: { example: ResolvedExamplePlugin }`
   — TOTAL, required (press-web **major**, the same discipline `pageDefaults`/
   `layout` already follow).
6. **Mount** — one line in `packages/web/templates/host/app/layout.tsx`:
   `{site.plugins.example.enabled && <ExamplePlugin message={site.plugins.example.message} />}`.

## §4 — Entity plugin: a read-only installed-plugins index

**Goal:** Content-Manager visibility of what plugins the engine knows about
and their configured state — a VIEW, never a second source of truth.

**Schema** — new collection type `plugin::press-cms.plugin`
(`content-types/plugin/schema.json`):

| field | type | source |
| --- | --- | --- |
| `pluginId` | string, unique | code (`PLUGIN_DEFINITIONS`) |
| `label` | string | code |
| `configHost` | string (e.g. `"site-setting.examplePlugin"`) | code — **display-only pointer**, not a Strapi relation (a singleType relation target is unsupported/risky) and not parsed/walked by code |
| `enabled` | boolean | mirror of the live Site Settings value |

Every field is `editable: false` in `config.metadatas` (visible, not editable
in the admin). `config.settings` is declared with the full required shape
(`bulkable`/`filterable`/`pageSize`/`searchable`) per this repo's own
gotcha — a partial override throws.

**Sync** — `syncPluginEntries(strapi)` (`lib/sync-plugin-entries.ts`), wired
**last** in `bootstrap.ts`. Runs every boot (not seed-once — an editor toggle
would go stale under a run-once flag). Upserts one row per entry of a
code-side array:

```ts
const PLUGIN_DEFINITIONS = [
  {
    id: 'example',
    label: 'Example Plugin',
    configHost: 'site-setting.examplePlugin',
    defaultEnabled: false, // mirrors DEFAULT_EXAMPLE_PLUGIN.enabled (web) — kept in sync by hand
    readEnabled: (site) => site?.examplePlugin?.enabled,
  },
];
```

**Deliberate trade-off:** the `enabled` mirror does not re-derive the "true
resolved" fail-open value by importing the web-side mapper or promoting
plugin defaults to `packages/shared` (the `layout-defaults.ts` precedent
would allow this, but is more machinery than one boolean justifies). Instead
each definition carries its own `defaultEnabled` literal and an explicit
`readEnabled` closure — no generic string-path walker over `configHost`.
This keeps `cms` and `web` decoupled at the cost of a small, manually-synced
duplicate. Revisit only if a plugin's resolution logic grows non-trivial
enough that drift risk outweighs the coupling cost.

**Accepted limitation (inherited from the abandoned prior attempt):** the
mirror only refreshes on boot. An editor toggling a plugin without a CMS
restart leaves the Content-Manager view stale until the next boot. A
lifecycle-hook refresh is a named follow-up, out of scope here.

This adds `+ 1 PLUGIN_DEFINITIONS entry` to the "cost of a new plugin" line
in CLAUDE.md, on top of the existing "1 CMS component + 1 mapper + 1 key + 1
mount line."

## §5 — Testing

- `packages/shared`: unchanged — the example plugin's fields are plain
  scalars, never touch `PressTree`/validators.
- `packages/web` (**major**): `map-example-plugin.test.ts` covers fail-open
  (CMS `null`/absent component → still resolves `DEFAULT_EXAMPLE_PLUGIN`
  total, `enabled: false`); `map-site-settings.test.ts` asserts
  `plugins.example` is present. The React component is tested as a pure
  function (no client state) — it does not need the `act()`+`createRoot`
  harness reserved for stateful client components.
- `packages/cms` (**minor**): `sync-plugin-entries.test.ts` covers
  create-on-first-boot then update-on-next-boot (idempotent upsert).

## Out of scope (deliberate)

A shared plugin-authoring helper (`definePlugin()` or similar) — revisit once
a second real plugin exists (§2). A lifecycle-hook refresh for the entity
mirror, so it stays live between boots (§4). Any real plugin's product logic
(Legal/consent, SEO, i18n, Forms, SMTP, Site for Company, Marketplace) — this
spec ships the framework and one throwaway example only. A generic
`configHost` resolution mechanism (string-path walking) — every plugin's
`readEnabled` stays hand-written.

## Versioning

`@ogs-tech/press-web` **major**: `ResolvedPressConfig` gains the REQUIRED
`plugins` field (hand-constructed literals fail `tsc`, same discipline as
`pageDefaults`/`layout`). `@ogs-tech/press-cms` **minor**: additive only (1
component, 1 site-setting attribute, 1 populate key, 1 new collection type,
1 bootstrap step).
