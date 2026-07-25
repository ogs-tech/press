# Site-Level Layout Defaults — design spec

Date: 2026-07-25
Status: approved direction, pre-implementation
Breaking: YES — `ResolvedPressConfig` gains a required `layout` key (press-web major);
`shared`/`cms` are additive minors. No wire migration: `PRESS_TREE_VERSION` stays `2`.

## 1. Problem

Two complaints, one root cause.

1. **The builder speaks engine, not editorial.** Every container-attr select in the
   composition builder shows the placeholder `engine default` and the clear action
   `Reset to engine default` (`packages/cms/admin/src/components/tree-editor.tsx:125,129`).
   An editor has no way to learn what "the engine" decided, and the option values
   below it are raw wire tokens — `prose | lg | full`, `compact | normal | spacious`.
   `lg` means nothing to a person writing a page.

2. **There is nowhere to change those defaults.** They are hardcoded fallbacks inside
   the render-side pickers (`packages/web/src/tree/container-attrs.ts`):
   `attrs?.width ?? 'lg'`, `attrs?.gap ?? 'normal'`, `attrs?.verticalAlign ?? 'top'`.
   Adjusting a site's baseline rhythm means editing engine source and redeploying —
   the exact opposite of the identity/SEO/theme model, where values are CMS-owned and
   picked up on the next ISR cycle.

The fix is one move: **promote the hardcoded fallbacks to a CMS-owned "Layout" section
in Site Settings**, then let the builder name the resolved value instead of the word
"engine". `engine default` becomes `Site default · Content width`.

A third, smaller defect rides along: the demo home page seeded by the CLI calls the
feature "Grid layout", but its name across the specs is **Grid System**
(`docs/superpowers/specs/2026-07-16-layout-grid-system-design.md`).

## 2. Decisions (brainstorm outcomes)

| Decision | Choice |
| --- | --- |
| Where defaults live | CMS **Site Settings**, a new `layout` section — the `themeColors` precedent, not `press.config.ts` |
| Section shape | **One group per tree level** — `page` / `row` / `column` — mirroring how the renderer actually behaves |
| Why not one shared group | `gap` is two different physical axes: space BETWEEN columns on a row (`--press-grid-gap`), vertical rhythm WITHIN a stack on a column/page (`--press-cell-gap` / `--press-tree-gap`). One field would force one label onto both, and setting it would flip every column cell from per-block margins to flex stacking — a silent visual regression |
| Where the constant lives | `@ogs-tech/press-shared` — the cms (serving) and web (rendering) need the SAME resolved value; the `validatePressTree` precedent ("one shared implementation both sides import") |
| How the builder learns them | Served in the existing `GET /api/press/schema` payload — the builder already makes exactly this one fetch, module-cached (`admin/src/lib/press-data.ts`). Zero new request, zero new failure mode |
| Failure posture | **Fail-to-default**, not fail-to-empty. CMS down/empty → `DEFAULT_LAYOUT`. Same call as `DEFAULT_THEME`; unlike identity/SEO, an unstyled layout is not a meaningful "empty" |
| Page-level override | **In scope.** `LayoutNode.container` already exists on the wire and is already read by `TreeRenderer`; only the builder UI is missing. Shipping a site default for the one level that cannot override it would read as a bug |
| Option labels | Humanized in the builder AND matched to the Site Settings labels, so an editor can connect `Site default · Normal` to the field they set |
| Seeding | **Nothing seeded.** An unset enum select renders as an empty placeholder, which is already truthful ("use the engine default"). Contrast with `seedCookieConsent`, which seeds booleans precisely because an unsaved toggle renders as OFF and contradicts the live default |
| Row card regrouping | **Out of scope** — a separate PR. Purely visual, no payoff to the stored model, and per the repo's own rule: separate concerns get separate PRs |

Explicitly rejected: reusing `preset-layout.container` three times (§4 explains);
a second admin fetch against `/api/site-setting`; an enum value meaning "no stack"
(§8b); renaming the placeholder without surfacing the value (leaves `Site default · lg`
just as opaque as `engine default`).

## 3. Contract — `@ogs-tech/press-shared`

New file `src/layout-defaults.ts`:

```ts
/** Site-level layout defaults, one group per tree level. Each level is the
 *  SUBSET of ContainerAttrs that actually applies there (Spec §3 of the tree
 *  design: a non-applicable attr is ignored by the renderer and hidden by the
 *  builder form — here it is absent from the type outright). */
export interface LayoutDefaults {
  page:   Pick<ContainerAttrs, 'gap'>;
  row:    ContainerAttrs;
  column: Pick<ContainerAttrs, 'gap' | 'verticalAlign'>;
}

/** The fallbacks that were hardcoded in web/src/tree/container-attrs.ts,
 *  promoted to contract. An ABSENT gap on page/column is meaningful, not a
 *  hole: the renderer emits no stack attribute and the legacy per-block
 *  margins apply. */
export const DEFAULT_LAYOUT: LayoutDefaults = {
  page:   {},
  row:    { width: 'lg', gap: 'normal', verticalAlign: 'top' },
  column: { verticalAlign: 'top' },
};

/** CMS shape → a TOTAL LayoutDefaults. Sanitizing, never throwing: an
 *  unrecognized enum value falls back to the engine default for that key
 *  (the validate-tree discipline — an attr-level failure is never a
 *  document-level failure). */
export function resolveLayoutDefaults(raw: unknown): LayoutDefaults;
```

Reuses the enum guards `src/validate-tree.ts` already owns for `Gap`,
`VerticalAlign` and `ContainerWidth` — no second copy of the allowed values.

`PressSchema` (`src/index.ts`) gains an OPTIONAL key, matching how `tree` is
declared so an older cms simply omits it:

```ts
export interface PressSchema {
  tree?: { version: number };
  layoutDefaults?: LayoutDefaults;   // ← new
  contentTypes: …;
  components: …;
}
```

The `index.ts` header comment still claims the package is "consumed type-only …
never enters either package's runtime artifact". That has been false since
`validate-tree` shipped; exporting a runtime const makes it conspicuously false.
Corrected in the same change.

## 4. CMS — components, registration, serving

Four new component schemas under `packages/cms/server/src/components/config/`:

| File | uid | Attributes (label) |
| --- | --- | --- |
| `layout.json` | `preset-config.layout` | `page`, `row`, `column` — `component:` refs |
| `layout-page.json` | `preset-config.layout-page` | `gap` ("Vertical rhythm") |
| `layout-row.json` | `preset-config.layout-row` | `width` ("Width"), `gap` ("Column gap"), `verticalAlign` ("Vertical align") |
| `layout-column.json` | `preset-config.layout-column` | `gap` ("Vertical rhythm"), `verticalAlign` ("Content align") |

**Why purpose-built instead of reusing `preset-layout.container` three times.**
Reuse is tempting — same three attrs, same enums, one file instead of four, and
CLAUDE.md explicitly praises `container` as the descriptor "defined exactly once and
shared by both node types". But that sharing happens in the PLUGIN's builder form,
which filters fields through `applicableContainerAttrs`. Site Settings is edited in
Strapi's NATIVE single-type form, which has no such filter — reuse would render
"Width" under `page` and `column`, where the renderer ignores it. Shipping a field
that silently does nothing is the exact defect this spec exists to remove. The
four-file shape mirrors the existing `preset-config.cookie-consent` →
`preset-config.cookie-category` nesting.

Storage shape, wire shape, and the `LayoutDefaults` type are then identical — no
mapping layer to keep in sync.

**Registration.** `ENGINE_COMPONENTS` in `lib/inject-components.ts` lists every
preset component explicitly (four `import … from '../components/…'` lines plus four
entries, layer `config`). `PRESET_LAYERS` is unchanged — `config` already exists.

**Site Settings.** `content-types/site-setting/schema.json` gains:

```json
"layout": { "type": "component", "repeatable": false, "component": "preset-config.layout" }
```

with `config.metadatas.layout.edit.label = "Layout"` and a description naming it as
the baseline every row/column inherits unless overridden per node.

**Serving.** `serializeSchema()` stays exactly as it is — synchronous, registry-only.
Its docblock makes that character load-bearing ("Reading the live registry … means the
generator can never disagree with what Strapi actually serves"); a database read does
not belong there. The merge happens one level up, in `controllers/schema.ts`:

```ts
async get(ctx) {
  ctx.body = { ...serializeSchema(strapi), layoutDefaults: await readLayoutDefaults(strapi) };
}
```

`readLayoutDefaults` (new, `lib/read-layout-defaults.ts`) reads the single type, pipes
it through `resolveLayoutDefaults`, and returns `DEFAULT_LAYOUT` when the record is
absent — so a pre-bootstrap or wiped database still serves a complete payload.

`controllers/site-setting.ts` adds the populate. A shallow populate does not reach two
levels, the same reason `seo.image` is spelled out today:

```ts
layout: { populate: { page: true, row: true, column: true } },
```

## 5. Web — mapper and renderer

`config/types.ts`:

- `SiteSettingsData.layout?: unknown` — raw, tolerated, sanitized downstream.
- `ResolvedPressConfig.layout: LayoutDefaults` — total, always present.

`map-site-settings.ts` adds one line, `layout: resolveLayoutDefaults(c.layout)`.
This is a **fail-to-default** key, joining `theme` and `plugins.cookieConsent` rather
than the identity/SEO fail-to-empty rule: a site with an unreachable CMS should render
with the engine's layout, not with no layout.

`tree/container-attrs.ts` — the pickers stop owning the fallback:

```ts
-export const rowGap   = (attrs?: ContainerAttrs) => GAP_TIERS[attrs?.gap ?? 'normal'];
+export const rowGap   = (attrs: ContainerAttrs | undefined, d: LayoutDefaults['row']) =>
+  GAP_TIERS[attrs?.gap ?? d.gap ?? 'normal'];
```

The trailing literal stays as a TYPE terminator only — `ContainerAttrs.gap` is
optional, so TS needs a total value — never as a second source of truth. Same shape
for `rowWidth`, `rowAlign`, `stackGap`, `cellAlign`. `spanFor` is untouched (span is
node-owned, never site-defaulted).

`tree/tree-renderer.tsx` threads `site.layout` alongside the existing `registry` prop
through `NodeList` → `RowView` / `ColumnView`, and passes `layout.page` to the
`stackGap` call that builds `--press-tree-gap`. Explicit props, not React context:
this subtree is server-first and uses no context today, and four signatures is a
smaller cost than introducing a provider.

## 6. Builder

No new fetch: `fetchPressSchema()` already returns the payload, module-cached.

- `TreeCtx` gains `layoutDefaults`, sourced once in `TreeEditor` as
  `schema.layoutDefaults ?? DEFAULT_LAYOUT` (an older cms omits the key).
- `ContainerSection` takes the defaults for ITS level and renders
  `placeholder={`Site default · ${containerOptionLabel(key, defaults[key])}`}`,
  with `clearLabel="Use site default"`.
- `palette-labels.ts` gains two presentation-only functions, consistent with the
  file's existing charter:
  - `containerFieldLabel(nodeType, key)` — the per-level naming ("Column gap" on a
    row, "Vertical rhythm" on a column). These strings must match the Site Settings
    labels in §4 verbatim; that correspondence is what makes `Site default · Normal`
    traceable to the field that set it.
  - `containerOptionLabel(key, value)` — `prose` → "Reading width", `lg` → "Content
    width", `full` → "Full bleed", `compact|normal|spacious` → title case, and
    `undefined` → "per-block spacing".
- **Body gains "Layout options".** `builder-input.tsx` renders
  `<ContainerSection nodeType="layout" …>` inside the Body `Section`, writing
  `tree.root.container` through the `setRoot` helper already there. This activates
  the `applicableContainerAttrs('layout') → ['gap']` branch in `form-model.ts:71`,
  which no caller reaches today. Slots mode (Site Settings `pageDefaults`) has no
  root node and is unaffected.
- To avoid duplicating the "empty container object disappears" rule, the body of
  `setContainerAttr` is extracted into a pure `patchContainer(container, key, value)`
  in `tree-ops.ts`; the path-addressed `setContainerAttr` and the root-addressed
  `builder-input.tsx` call both go through it.

## 7. Seed copy — Grid layout → Grid system

`packages/cli/templates/cms/scripts/seed-content.mjs`: the `preset-atom.heading` text
(L62), the paragraph body (L67), and the two comments (L41, L63).
`packages/cli/templates/cms/scripts/seed.mjs`: the header comment (L8).
Both mirrored in the committed scaffold output under
`apps/playground/packages/cms/scripts/`.

Historical `.changeset/` entries and `docs/superpowers/plans/` files keep the old
wording — they are a record of what happened, not live copy.

## 8. Accepted trade-offs

**a) `press dev` would re-sync types on every layout edit.** `watchSchema`
(`web/src/util/watch-schema.ts:47`) compares the entire response body as text, so
serving editable values from `/api/press/schema` makes an editorial change look like
a schema change. The generator only walks `contentTypes`/`components`, so the re-sync
would be a no-op — but it is churn and a misleading log line. Fix: `watchSchema`
parses the body and compares `JSON.stringify({ contentTypes, components, tree })`
instead of the raw text, falling back to the raw body when the payload does not parse
(a cms mid-restart already returns non-JSON, and that path must keep behaving exactly
as it does today — compare, retry, never tear down). This preserves the invariant
"type-sync runs when TYPES change", and is required to avoid regressing the dev loop
rather than opportunistic cleanup.

**b) A single node cannot opt back out to per-block spacing.** If the site sets
`column.gap = normal`, no individual column can return to legacy per-block margins:
`undefined` means "inherit". Identical to how `width` and `verticalAlign` already
behave. A fix would need an explicit `none` enum member, rejected here as unearned
complexity — revisit if an editor actually hits it.

**c) `ResolvedPressConfig` gains a required key.** By the discipline CLAUDE.md states
for `plugins` and `pageDefaults`, that is a deliberate **press-web major**.
`press-shared` and `press-cms` are minors (additive). Changesets accordingly.

## 9. Test plan

| Package | Coverage |
| --- | --- |
| `shared` | `resolveLayoutDefaults`: per-key merge over `DEFAULT_LAYOUT`; unknown enum value falls back per key without throwing; `null` / `undefined` / non-object → `DEFAULT_LAYOUT`; a present `page.gap` survives |
| `web` | `container-attrs.test.ts` retargeted at the new signatures (node attr wins → site default wins → engine literal); `map-site-settings.test.ts` for `layout` present, empty, and CMS-null |
| `cms` | `controllers/schema` returns `layoutDefaults`, and returns `DEFAULT_LAYOUT` when the single type is missing; `tree-editor.test.tsx` asserts the `Site default · …` placeholder and the per-level field labels |
| `cli` | The existing seed-regression guard validates the tree shape; confirm no test asserts the "Grid layout" heading string before changing it |

Gate before done, per CLAUDE.md: `pnpm -r --if-present typecheck`, `pnpm -r test`, and
`pnpm --filter @ogs-tech/press-cms test:ts:back`. `press-cms` must be rebuilt before any
playground boot — `strapi develop` loads `dist/`, not TS source.

## 10. Documentation

CLAUDE.md needs two edits once implemented:

- The "Layout primitives" section states container attrs are "editorial intents only,
  mapped to `Responsive<T>` layout-primitive props by `web/src/tree/container-attrs.ts`".
  Still true, but the DEFAULTS are no longer code-side — add that they resolve against
  CMS-owned `LayoutDefaults`.
- The "Build-time anchors vs. runtime Site Settings" section enumerates what Site
  Settings owns ("Identity, SEO, theme color/radius VALUES, and the two `pageDefaults`
  composition-tree slots"). Add layout defaults to that list.
