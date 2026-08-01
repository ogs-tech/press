# Plugin/Site for Company — Design Decisions

> Cited from code as `plugin-company Spec §N`. Per repo convention, this doc may
> be removed after merge — CLAUDE.md is the living architectural reference for
> these decisions.

**Goal:** ship the engine's fourth plugin and its first *archetype* plugin — a
boot-time-only plugin that materializes the "Company" shape of a site: five
seeded, published, fully editable pages (`home`, `services`, `about`, `cases`,
`contact`) composed exclusively from the existing preset palette, plus the
navigation that makes them reachable. Installing it means the site is born with
the Company shape; other shapes (Persona, Influencer) are other plugins,
additively.

**Depends on:** Base/Plugin (the `plugins/<id>/` structure, `PLUGIN_DEFINITIONS`
visibility index), Base/Pages (`page` content-type, the `seedPage` primitive),
Base/Components (`preset-organism.hero`/`cta`, the eight atoms,
`preset-molecule.link`), Grid System (`RowNode`/`ColumnNode` recursion).

**Consumed by:** the OGS site (this plugin is on its critical path).

## Corrections to the originating brief

The CRM task's scope was written before the composition tree landed. Three
premises are stale, and this spec reduces scope accordingly:

1. **"a partir dos organisms preset (hero, cta, logo-strip, cards, form...)"** —
   `logo-strip`, `card`, `stat`, `media-text` and `form` do not exist; they were
   deliberately deferred when Base/Components closed. The composition tree
   subsumes three of them outright: `media-text` is a two-column row,
   `logo-strip` is a row of image atoms, `stat` is a column holding a heading
   plus a paragraph. Only `card` adds something composition cannot express (a
   visual frame), and shipping it would trade a recomposable structure for an
   opaque block. **Decision: zero new components.** The templates compose from
   `hero`/`cta` + the eight atoms + grid recursion.
2. **"Chrome default (navbar/footer)"** — already delivered by
   `seedSiteSetting()` (Base), which seeds a bare navbar and footer into
   `pageDefaults` exactly once. This plugin does not re-seed chrome; it fills
   the existing navbar's `items` (§5).
3. **"tema default"** — out of scope. Colour and radius are adopter identity,
   already covered by `basicSettings` + `DEFAULT_THEME`, and already filled by
   the CLI seed. An archetype plugin dictating the palette would overwrite
   editor-owned values, violating the engine's "never rewrite what the editor
   touched" rule.

**Also deliberately deferred:** the Contact page ships **without** a form.
Plugin/Forms is a separate task (due 15/10 vs this one's 30/09); coupling them
would block the earlier deadline on the later one. Contact seeds contact details
plus a mailto CTA; when Plugin/Forms lands, an editor drops the form block into
a page that is already a published, editable document — no migration.

**Language.** Titles, body copy and slugs are **English**
(`home`/`services`/`about`/`cases`/`contact`), matching the `locale: 'en'` the
scaffold's own `SITE_SETTINGS` declares and the engine's status as a public npm
package. The OGS site rewrites the copy afterwards — the pages are seeded
published and editable, so that is content work, not a migration. Slugs are
permanent identifiers, which is why this is settled here rather than left to the
implementation.

## §1 — CMS schema

One new component, category `preset-config` (same category as
`basic-settings`/`seo`/`legal-pages`), plus one new `site-setting` attribute.

**`preset-config.company-site`** (`site-setting.companySite`):

| field | type | notes |
| --- | --- | --- |
| `enabled` | boolean, default `true` | gates the **seed** only (§4) — not a runtime toggle. Once the pages exist they are ordinary `page` documents; disabling later never deletes them. |

Enabled by default, following the `seo`/`legal` precedent ("core surface, not a
demo"), not `example`'s ships-disabled one. The consequence is explicit and
accepted: **every fresh scaffold is born a Company site.** This is correct for
v0.1, whose only consumer is the OGS site, and it is reversible per project via
the Site Settings toggle. The additive archetype model still holds — a future
Persona plugin adds its own pages rather than replacing these.

`PLUGIN_DEFINITIONS` (`sync-plugin-entries.ts`) gains one row:

```ts
{
  id: 'company-site',
  label: 'Site for Company',
  configHost: 'site-setting.companySite',
  defaultEnabled: true,
  readEnabled: (site) => site?.companySite?.enabled,
}
```

## §2 — Types and mapper (web side)

`packages/web/src/plugins/company/` — `types.ts`, `default-company-site.ts`,
`map-company-site.ts`, mirroring `plugins/legal/` exactly:

```ts
export interface RawCompanySite { enabled?: boolean }
export interface ResolvedCompanySite { enabled: boolean }

export const DEFAULT_COMPANY_SITE: ResolvedCompanySite = { enabled: true };

/** Pure CMS-shape → resolved. FAIL-OPEN, the established mapper convention. */
export function mapCompanySite(raw: RawCompanySite | null | undefined): ResolvedCompanySite {
  return { enabled: raw?.enabled ?? DEFAULT_COMPANY_SITE.enabled };
}
```

`ResolvedPressConfig.plugins` gains a required `company: ResolvedCompanySite`
key, and the plugin gets the synthetic `urn:plugin:company` identity of
`PressPlugin<'company'>`.

**This plugin is boot-time-only — the first of its kind.** Unlike
`example` (mounts a component), `seo` (drives metadata + JSON-LD) and `legal`
(mounts a banner), it has **no mount in `layout.tsx`** and nothing reads
`plugins.company` at runtime; Content-Manager visibility comes from
`PLUGIN_DEFINITIONS` on the cms side. The key is kept anyway, deliberately:
"one required key per wired plugin" is the invariant that keeps
`PLUGIN_DEFINITIONS` and `plugins` in lockstep, and the ~3 files it costs are
cheaper than the permanent exception the omission would introduce.

## §3 — What a "template" is

A template is a **`PressTree` literal built in TypeScript and materialized as a
seeded page** — exactly the mechanism Plugin/Legal proved with
`PRIVACY_POLICY_BODY`. Templates live in
`packages/cms/server/src/lib/templates/company/`, one module per page, each
exporting a factory (node ids are minted per call via `randomUUID`, and Home
additionally takes the uploaded cover's asset id).

Two alternatives were rejected:

- **Registering `preset-template.*` CMS components.** It would finally
  materialize the reserved layer, but a template carries no data fields — it
  would be an empty descriptor with no consumer, since the builder already
  excludes the whole `template` category from its palette via `NON_PLACEABLE`.
- **A runtime "apply template to a new page" catalog** (endpoint + admin UI).
  Real product value — the template would survive the boot instead of being a
  one-shot event — but far beyond the task's DONE, which is "installing the
  plugin brings the templates + pages."

**Consequence, stated plainly:** `preset-template` stays reserved and empty.
"Templates" are a code-side concept in this engine, not a registered CMS
category. If the applicable-catalog idea is ever built, that is when the layer
earns its components.

**The compositions** (every node from the existing palette). Rows are top-level,
so each carries `container.width` — `lg` throughout, the width the engine's
organisms already use, keeping one left rail across hero, cta and the atom prose
column. `col N` is the column's `span.md`; every column is full-width
(`span.base: 12`) on phones:

| Page | Composition |
| --- | --- |
| **`contact`** | hero → row [col 6: paragraph + list of contact details \| col 6: quote] → cta (mailto) |
| **`about`** | hero → row [col 7: paragraph \| col 5: quote] → row 3× col 4 (values: heading + paragraph) → cta |
| **`cases`** | hero → row 3× col 4 (heading + paragraph + button → Contact) → cta |
| **`services`** | hero → row 3× col 4 (heading + paragraph + list + button → Contact) → cta |
| **`home`** | hero **with cover image** (cta → Contact) → row 3× col 4 (service summary, button → Services) → row [col 6 \| col 6] (about blurb + quote) → cta |

Every row declares a tier-scaled gap (`{ base: 'md', lg: 'lg' }`, the Hero
pattern) rather than a flat `lg` — a 12-track grid carries 11 interior gaps, so
a flat 48px gap imposes a 528px minimum width that overflows phones.

## §4 — Seeding

`seed-company-site.ts`, called from `bootstrap()` between `seedLegalPages()` and
`syncPluginEntries()` (the index must mirror Site Settings *after* seeding).

### §4.1 — Two extensions to `seedPage`

```ts
export async function seedPage(
  strapi: Core.Strapi,
  opts: {
    slug: string; title: string; body: PressTree; flagKey: string;
    publish?: boolean;               // NEW — default false; Legal unchanged
  },
): Promise<string | undefined>       // NEW — documentId, created OR pre-existing
```

**`publish`.** With the CLI's demo home removed (§6), a fresh scaffold would
otherwise hold zero published pages and `press dev` would render 404 at `/`.
The "the engine never publishes content on its own" invariant was written for
Legal, where a privacy policy genuinely needs human review before going live;
for an archetype plugin whose DONE is "the site is born with the Company shape",
draft-only delivers an empty site. The flag is opt-in, so Legal's behavior is
untouched and the exception is legible at the call site. **All five Company
pages are seeded published** — a navbar linking to unpublished pages would 404.

**The return value.** It lets internal links use real `page` references
(`preset-molecule.link.page`, which survives renames and resolves to a fresh
slug) instead of raw URLs. It returns the pre-existing document's id on a slug
collision too, so links resolve even when the seed declines to write.

### §4.2 — Topological seed order

Each page is seeded only after the pages it links to:

```
contact → about → cases → services → home → navigation
```

### §4.3 — The cover image

The placeholder PNG upload migrates from the CLI's `seed.mjs` into the plugin
(base64 bytes embedded in the module, as the CLI did), runs once under Home's
flag, and feeds Home's hero. This keeps the engine's live proof that a `media`
field crosses the REST contract — the proof changes owner along with the page
that consumes it.

### §4.4 — Idempotency

One plugin-store flag per page (`companyHomeSeeded`, `companyServicesSeeded`,
`companyAboutSeeded`, `companyCasesSeeded`, `companyContactSeeded`), plus
`companyNavSeeded` for §5. The `enabled` gate is read on every boot and returns
**without writing a flag** when disabled, so enabling the plugin later seeds on
the next boot — the contract `seedLegalPages` already established. A slug
collision marks the flag done without writing: the adopter's page always wins.

## §5 — Navigation

`seedSiteSetting()` (Base) runs first and leaves a **bare**
`preset-organism.navbar` node in `pageDefaults.header`, then sets
`pageDefaultsSeeded`. A naive "fill the slot if empty" rule would therefore
never fire.

The correct rule is finer-grained: **locate that navbar node and fill its
`items` if they are absent or empty**, guarded by `companyNavSeeded`. The plugin
composes with the Base seed instead of contending for the slot.

- `items`: `preset-molecule.link` with a `page` reference each — Home, Services,
  About, Cases.
- `cta`: a `preset-atom.button` pointing at Contact.

If an editor has already added items, the plugin leaves them alone.

## §6 — What leaves Base/CLI

The pre-existing demo content is **removed**, not guarded — one owner instead of
two seeds negotiating. In `packages/cli/templates/cms/scripts/`:

| Symbol | Fate |
| --- | --- |
| `buildHomeBody({ imageAssetId })` | removed — Home is now a plugin template |
| `buildPageDefaults({ homeDocumentId })` | removed — navigation is now the plugin's |
| `REPO_URL` / `PRESS_SITE_URL` / `NPM_CREATE_URL` | removed — they only fed the two above |
| `SITE_SETTINGS` (identity + theme) | **kept** — theme is not the plugin's business (§Corrections) |
| the base64 PNG + `uploadImage()` | removed — migrated into the plugin (§4.3) |
| `findMany({ status: 'published' })` guard | removed — no page-creation block is left to guard |

`seed.mjs` collapses to a single job: fill Site Settings identity + theme, once,
skipping when `basicSettings.name` is already set.

**Note on the earlier plan:** an alternative considered changing that guard from
`status: 'published'` to "any page" so the two seeds could coexist. Removing the
demo outright makes the guard moot, which is the better outcome — it also
retires a latent bug where the CLI ignored drafts seeded by plugins (Legal's
privacy-policy) and could collide on a `slug`, which is `type: "uid"` and
therefore unique.

## §7 — Error handling

Fail-open throughout, matching Legal:

- **Unreadable/absent gate** → treated as enabled (`=== false`, never
  `!== true`), so a fresh install with nothing populated still seeds.
- **Upload failure** → log a warning and seed Home without the cover; `image` is
  optional on `preset-organism.hero`, so a transient upload problem must not
  abort the whole archetype.
- **Slug collision** → the adopter's page wins; the flag is marked done and the
  returned documentId still wires the links.
- **A seed throwing** must not take down `bootstrap()` for the other pages: each
  `seedPage` call is independent, and a failure is logged and skipped rather
  than propagated.
- **A missing link target.** Because the order is topological (§4.2), a page
  built later reads the documentIds of pages seeded earlier — and a failed or
  skipped seed returns `undefined`. Every internal link therefore degrades to a
  relative `url` (`/contact`) when its documentId is absent, rather than
  emitting a `page` reference with a null target. `preset-molecule.link` already
  defines this precedence in reverse (an internal `page` beats a raw `url`), so
  the fallback needs no new wire shape — the link simply carries the weaker of
  the two forms it already supports.

## §8 — Testing

cms (vitest, mocked `strapi.documents` + plugin store):

1. **Every template passes `validatePressTree` with zero `errors` *and* zero
   `warnings`.** The highest-value test here: the templates are hand-written
   JSON, and this is the same validator the cms write path runs — a template
   that fails would be rejected by `beforeCreate` in production.
2. Gate disabled → nothing seeded **and** no flag written (so re-enabling works).
3. Second run is a no-op (flags respected).
4. Topological order produces resolvable `page` references on every internal link.
5. Navbar `items` filled only when absent/empty; pre-existing items untouched.
6. Slug collision → no write, flag set, existing documentId returned.
7. Upload failure → Home still seeded, without `image`.
8. A missing link target degrades to a relative `url`, never a `page` reference
   with a null target.

web (vitest): `map-company-site.test.ts` — fail-open mapping, mirroring
`map-legal.test.ts`.

Gate: `pnpm -r --if-present typecheck` + `pnpm -r test` (there is no eslint).

## Out of scope (deliberate)

- New palette components (`card`, `stat`, `media-text`, `logo-strip`, `form`).
- A contact form on the Contact page — Plugin/Forms, separate task.
- `preset-template.*` CMS components; the layer stays reserved.
- A runtime "apply template" catalog and its admin UI.
- Theme presets.
- Other archetypes (Persona, Influencer) — additive, future plugins.
- Localized template copy: the templates ship one English string set (see
  "Language" above). Serving a second locale is i18n's job — its own roadmap
  item, and the place where that mechanism should be defined.

## Versioning

- `@ogs-tech/press-cms` — **minor**: new component, new seed, `seedPage`
  signature extended backward-compatibly.
- `@ogs-tech/press-web` — **major**: a new required key in
  `ResolvedPressConfig.plugins`, the documented discipline for every new plugin.
- `@ogs-tech/create-press` — **minor**: the scaffold's seed templates lose the
  demo page and navigation.
