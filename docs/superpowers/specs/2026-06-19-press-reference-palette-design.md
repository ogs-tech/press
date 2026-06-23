---
title: "Spec — Reference palette: drop Hero, add Rich Text + Gallery"
internal_name: press-reference-palette
relates_to: docs/beta/prd.md
roadmap: docs/beta/roadmap.md
status: Design approved
created_at: 2026-06-19
updated_at: 2026-06-19
breaking: true
---

# Spec — Reference palette: drop Hero, add Rich Text + Gallery

> [!WARNING]
> **This is a BREAKING change.** It removes `press.hero` — the engine's only
> shipped reference block today and part of the published contract
> (`@ogs-tech/press-web@0.4.1`, `@ogs-tech/press-cms@0.3.2`) — including its
> public exports from `@ogs-tech/press-web` (`Hero`, `PressHero`). It lands a
> breaking-change **minor** changeset for both packages (pre-1.0: under `0.x`,
> `minor` is the bump that carries breaking changes — the break is recorded in the
> changeset body, not in a `major`→`1.0.0` jump).

> [!NOTE]
> Builds on the theming spec
> ([2026-06-19-press-default-theme-design.md](2026-06-19-press-default-theme-design.md)),
> which gave the engine a styling surface (`theme.css` + `var(--press-*)` tokens)
> but only `press.hero` to style. This spec **reshapes the reference palette** to
> a two-block editorial set — `press.rich-text` (prose) and `press.gallery`
> (image grid) — and **drops `press.hero`**.

**TL;DR** — The engine's reference palette is reshaped from `[press.hero]` to
`[press.rich-text, press.gallery]`. `press.hero` is **removed entirely** (schema,
renderer, base type, public exports, `theme.css` rules, contract example).
`press.rich-text` stores editorial prose in Strapi's **`blocks`** field and renders
it with a small **in-house server-component** renderer (no dependency — see §5.1).
`press.gallery` stores a **multiple-image** media field plus optional
heading/caption, renders a responsive grid, and **inherits Hero's role as the
media-serialization contract example** (it proves media crosses the REST boundary —
now with *multiple* images). Both new blocks are **flat** (no nested components), so
`serialize-schema.ts` and `generate.ts` need **no structural change**. The whole
feature adds **zero new dependencies** — Rich Text renders blocks JSON with our own
pure renderer (the official `@strapi/blocks-react-renderer` is `"use client"`,
which would break the engine's server-rendered, JS-free block principle), and
Gallery is plain media. The **playground seed is migrated** off
`press.hero`. A breaking **minor** changeset (pre-1.0) ships for
`@ogs-tech/press-web` and `@ogs-tech/press-cms`, with the break documented in its
body.

## 0. Foundation — why reshape, and why breaking is acceptable here

The theming spec made a press site *look* finished, but `press.hero` is an
opinionated marketing primitive. The desired default palette is **editorial**:
prose + images. Rather than carry Hero alongside the new blocks, this spec
**replaces** it — the engine ships exactly the two blocks the default site needs,
nothing it doesn't.

**Breaking is acceptable pre-1.0.** Both packages are `0.x`; the automated release
pipeline (changeset → PR → OIDC publish) is proven. Removing `press.hero` is a
deliberate contract change recorded as a breaking-flagged **minor** changeset
(pre-1.0). Adopters who placed
`press.hero` on a page degrade *gracefully*: `BlockRenderer` already tolerates an
unknown `__component` (renders nothing + a dev-only warning), so no page **crashes**
— the block simply disappears. The migration note (§10) makes this explicit.

**The contract shrinks then grows.** Removed from the public surface:
`press.hero` (UID + attributes), and the `@ogs-tech/press-web` exports `Hero` and
`PressHero`. Added: `press.rich-text` and `press.gallery` (UIDs + attribute shapes
in §2) and the exports `RichText`, `Gallery`, `PressRichText`, `PressGallery`.

## 1. Removal — `press.hero` (blast radius)

Every reference to `press.hero` / `Hero` / `PressHero`, classified.

### 1.1 Deleted files

- `packages/cms/server/src/components/hero.json`
- `packages/web/src/blocks/hero.tsx`

### 1.2 Functional edits (the contract surface)

- **`packages/web/src/index.ts`** — remove `export { Hero } from './blocks/hero';`
  and remove `PressHero` from the `export type { … } from './types/base'` line.
  **This is the public, breaking API change.**
- `packages/cms/server/src/lib/inject-components.ts` — remove the `heroSchema`
  import and the `press.hero` entry from `ENGINE_COMPONENTS`.
- `packages/cms/server/src/content-types/page/schema.json` — `body.components`
  drops `press.hero`.
- `packages/web/src/reference-blocks.ts` — remove the `Hero` import and the
  `'press.hero'` entry.
- `packages/web/src/types/base.ts` — remove the `PressHero` interface
  (keep `PressMedia`, `Block`, `PageBody`, `Page`).
- `packages/web/theme.css` — remove the `[data-block="press.hero"]` rule block.

### 1.3 Test edits

- `packages/cms/server/src/lib/inject-components.test.ts`,
  `dz-populate.test.ts`, `serialize-schema.test.ts` — drop `press.hero`
  fixtures/assertions, replace with the new blocks where the test needs a sample
  block.
- `packages/web/src/generator/generate.test.ts` — fixtures currently use
  `press.hero` and assert `PageBody = (PressHero | CustomCallout)[]`; update to the
  new palette (`press.rich-text` / `press.gallery`).
- `packages/web/src/block-key.test.ts` — uses `press.hero` as a key-uniqueness
  fixture; swap the literal for a current block UID (block-key is generic, so this
  is fixture hygiene, not behavior).

### 1.4 Comment-only references (cosmetic — update for accuracy, no behavior change)

`packages/cms/server/src/lib/dz-populate.ts` (the "hero image crosses the REST
contract" comment → gallery images), `global-id.ts`, `block-key.ts`,
`block-renderer.tsx` (PressHero named as an example in a comment),
`generator/generate.ts` (`press.hero → PressHero` JSDoc example).

## 2. New block schemas (`packages/cms/server/src/components/`)

Both mirror the existing component schema shape (`collectionName`, `info`,
`options`, `attributes`).

### 2.1 `press.rich-text` — `rich-text.json`

```json
{
  "collectionName": "components_press_rich_texts",
  "info": { "displayName": "Rich Text", "description": "Editorial prose block shipped by the press engine" },
  "options": {},
  "attributes": {
    "content": { "type": "blocks", "required": true }
  }
}
```

`type: "blocks"` is Strapi 5's structured block editor (not `richtext`/markdown);
XSS-safe by construction, maps cleanly to the `data-block` styling model.

### 2.2 `press.gallery` — `gallery.json`

```json
{
  "collectionName": "components_press_galleries",
  "info": { "displayName": "Gallery", "description": "Image grid block shipped by the press engine" },
  "options": {},
  "attributes": {
    "heading": { "type": "string" },
    "images": { "type": "media", "multiple": true, "allowedTypes": ["images"] },
    "caption": { "type": "string" }
  }
}
```

`images` is **multiple** media — Gallery is the new media-serialization contract
example (Hero proved single image; Gallery proves the multiple-media path across
the same REST contract). `heading`/`caption` optional.

## 3. Engine registration (CMS)

- **`inject-components.ts`** — after removing Hero, `ENGINE_COMPONENTS` is
  `[{ press, rich-text }, { press, gallery }]`. The existing injection loop does
  the rest (registry `set`, deterministic `globalId`, idempotent skip). Both are
  DZ blocks; no item-only components.
- **`content-types/page/schema.json`** — `body.components` becomes
  `["press.rich-text", "press.gallery"]`.
- **`dz-populate.ts`** — **no code change** (generic over the live DZ list);
  `populate: '*'` pulls `gallery.images` (first-level media). Comment updated per
  §1.4.

## 4. Engine mechanisms — explicitly UNCHANGED (structurally)

Both new blocks are flat, so:

- **`serialize-schema.ts`** — both are DZ members with no `type: 'component'`
  attributes; existing DZ-only serialization emits them in full. No transitive
  walk needed.
- **`generate.ts`** — `gallery.images` (`media`, `multiple`) already returns
  `PressMedia[]`; `rich-text.content` (`blocks`, `required`) is absent from
  `SCALARS` and falls through to the `unknown` fallback → `content: unknown`
  (required, no `?`) in the adopter's **generated** types. Intentional: the engine's
  own renderer types `content` precisely via the hand-written base type (§5).
  (Optional: a one-line comment documenting `blocks → unknown` is deliberate.)
- **`@ogs-tech/press-shared` `Attr`** — no new field.

## 5. Rendering (web)

Two new **class-free server components** in `packages/web/src/blocks/`, each with a
`data-block="press.<name>"` wrapper, following the former `hero.tsx` pattern.

### 5.1 `rich-text.tsx` + in-house blocks renderer

The Strapi `blocks` field is a documented, stable JSON tree. We render it with a
small **pure server-component** helper instead of `@strapi/blocks-react-renderer`
(that package is `"use client"` — it would turn static prose into a hydrated client
island and pull a runtime dependency, both against the engine's server-rendered,
JS-free block principle).

```tsx
import type { PressRichText, BlocksNode } from '../types/base';

function renderText(node, i) { /* text node → marks: bold/italic/underline/strikethrough/code */ }
function renderNode(node, i) {
  switch (node.type) {
    case 'paragraph': return <p key={i}>{node.children.map(renderText)}</p>;
    case 'heading':   /* node.level 1–6 → <h1..h6> */
    case 'list':      /* node.format 'ordered'|'unordered' → <ol>/<ul> of list-item */
    case 'quote':     /* <blockquote> */
    case 'code':      /* <pre><code> */
    case 'link':      /* inline <a href={node.url}> */
    default:          return null; // tolerant: unknown node → skip (mirrors BlockRenderer)
  }
}

export function RichText({ content }: PressRichText) {
  return <section data-block="press.rich-text">{content.map(renderNode)}</section>;
}
```

**Node coverage (in scope):** `paragraph`, `heading` (level 1–6), `list` +
`list-item` (ordered/unordered), `quote`, `code`, inline `link`, and `text` marks
(`bold`, `italic`, `underline`, `strikethrough`, `code`). **Out of scope:** `image`
nodes embedded *inside* the blocks field — images belong in `press.gallery`, and
embedded-media populate is a rabbit hole this cut avoids; an `image` node renders
nothing (tolerant skip). The renderer may live in `rich-text.tsx` or a sibling
`blocks-renderer.tsx` module — implementer's call — but it is **fully unit-tested**
(§9).

### 5.2 `gallery.tsx`

Resolves each image `src` **absolute** against `CMS_URL` (mirroring how Hero did
it — keeping the media-contract proof). Renders optional `heading`, the image
grid, optional `caption`. Raw `<img>` (no `next/image`) so contract tests need no
image-domain config.

### 5.3 Registry, base types, public exports

- **`reference-blocks.ts`** — `{ 'press.rich-text': RichText, 'press.gallery': Gallery }`.
- **`types/base.ts`** (engine-owned, hand-written) — add:

```ts
/** A single inline text run in the Strapi blocks tree (boolean marks omitted when false). */
export interface BlocksText {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

/** A block/inline node in the Strapi blocks tree. Structural — the renderer (§5.1)
 *  switches on `type`; unknown types are tolerated. Hand-written (no dependency). */
export interface BlocksNode {
  type: string;            // 'paragraph' | 'heading' | 'list' | 'list-item' | 'quote' | 'code' | 'link' | …
  level?: number;          // heading 1–6
  format?: 'ordered' | 'unordered'; // list
  url?: string;            // link
  children?: Array<BlocksNode | BlocksText>;
}

/** The `content` of a `press.rich-text` block: the top-level blocks array. */
export type BlocksContent = BlocksNode[];

/** Reference block `press.rich-text` — engine-owned (mirrors cms rich-text.json). */
export interface PressRichText {
  __component: 'press.rich-text';
  id: number;
  content: BlocksContent;
}

/** Reference block `press.gallery` — engine-owned (mirrors cms gallery.json). */
export interface PressGallery {
  __component: 'press.gallery';
  id: number;
  heading?: string;
  images?: PressMedia[];
  caption?: string;
}
```

- **`index.ts`** — replace the removed Hero exports with
  `export { RichText } from './blocks/rich-text';`,
  `export { Gallery } from './blocks/gallery';`, and add `PressRichText`,
  `PressGallery` to the `export type { … } from './types/base'` line.

## 6. Dependencies — none added

This feature adds **zero new runtime dependencies**. Rich Text renders the Strapi
`blocks` JSON with the in-house server-component renderer (§5.1); Gallery is plain
media + `<img>`. **Rejected alternatives** (brainstorm + adversarial review):
(a) markdown + `react-markdown` — a dependency, and markdown authoring instead of
the structured blocks editor; (b) `@strapi/blocks-react-renderer` — the official
renderer, but it is `"use client"`, so it would convert static prose into a
hydrated client island and add a runtime dependency, both against the engine's
server-rendered, JS-free block principle (the reason Hero used a plain server
component). Owning ~50–80 lines of pure, fully-tested rendering is the better trade
for an engine whose contract is "HTML on the server".

## 7. Styling (`packages/web/theme.css`)

- **Remove** the `[data-block="press.hero"]` rule block.
- **Add** `[data-block="press.rich-text"]` — spacing/typography for the elements
  the in-house renderer emits (paragraphs, headings, lists, links, blockquote,
  code), using the type-scale and color tokens; vertical rhythm via `--press-space-*`.
- **Add** `[data-block="press.gallery"]` — responsive grid
  (`display: grid; grid-template-columns: repeat(auto-fit, minmax(...))`),
  `--press-radius-md` on images, `--press-color-muted` + `--press-text-sm` on the
  caption.

Engine-owned, regenerated by `upgrade`.

## 8. Playground seed migration (REQUIRED — dogfood)

`apps/playground/packages/cms/scripts/seed.mjs` currently seeds a published "E2E
Home" with a `press.hero` (using an uploaded `hero.png`) + `custom.callout`. Once
Hero is removed this seed would attempt to create an **unregistered** component →
boot/seed failure.

Migrate the `body` array to the new palette, **reusing the uploaded image** in the
gallery so the dogfood still proves media crosses the contract:

```js
body: [
  {
    __component: 'press.rich-text',
    content: [
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello from press — server-rendered end-to-end.' }] },
    ],
  },
  { __component: 'press.gallery', heading: 'Gallery', images: [fileId], caption: 'Seeded image' },
  { __component: 'custom.callout', message: 'Adopter callout renders via the Project-zone block map', variant: 'success' },
],
```

The generated playground type files (`apps/playground/packages/shared/types/generated.ts`,
`packages/cms/types/generated/*`) are **regenerated** by `press dev` / Strapi boot
— not hand-edited.

**Required reset step.** The seed is **skip-if-empty** (it bails when a published
page already exists; reset = delete the CMS DB at `apps/playground/packages/cms/.tmp`).
The current dev DB already holds the old `press.hero` home, so after the palette
change the seed would skip *and* the admin Content Manager would carry an orphaned,
now-unregistered `press.hero` entry. Migration therefore **must** reset the
playground DB (`rm -rf apps/playground/packages/cms/.tmp`) so the new seed runs and
no orphaned Hero block remains. (This is a local dev DB — adopters' production data
is governed by the §10 migration note, not this step.)

## 9. Tests (Vitest, following existing patterns)

- **CMS** — `inject-components.test.ts`: assert `press.rich-text` + `press.gallery`
  injected and present in the page DZ; assert `press.hero` is **gone**.
  `serialize-schema.test.ts`: the two new blocks serialize with their attributes.
- **Web** — `generate.test.ts`: `PageBody` union is `(PressRichText | PressGallery | …)[]`
  (no `PressHero`); `gallery.images` → `PressMedia[]`; `rich-text.content` → `unknown`.
  New renderer tests: each emits its `data-block` wrapper; Gallery resolves absolute
  `src` and tolerates missing/empty `images`. `reference-blocks`/`block-renderer`
  test: registry has the two new keys and **not** `press.hero`.
- **Web — in-house blocks renderer** (the new, owned code → the most test-worthy
  surface): a dedicated unit test covering each node type (`paragraph`, `heading`
  levels, `list` ordered/unordered + `list-item`, `quote`, `code`, inline `link`),
  each text mark (`bold`/`italic`/`underline`/`strikethrough`/`code`), nested
  children, an unknown node type (tolerant skip, no throw), and an embedded `image`
  node (skipped, out of scope).

## 10. Delivery

- **Changeset** — **minor** for `@ogs-tech/press-web` **and** `@ogs-tech/press-cms`
  (`0.4.1 → 0.5.0`, `0.3.2 → 0.4.0`). Rationale: under semver `0.x`, breaking
  changes ride a **minor** bump — there is no breaking-vs-feature distinction
  pre-1.0 (the repo already uses `minor` for additive features). A `major`
  changeset would jump both packages to **`1.0.0`**, prematurely declaring API
  stability — explicitly **not** wanted here. The break is signalled by the
  migration note in the changeset body, not by the version number. (If the team
  ever decides to *declare* stability, that is a separate, deliberate `major`/1.0
  decision — out of scope for this spec.)
- **Migration note (in the changeset body)** — `press.hero` is removed; pages
  still referencing it render nothing (tolerant fallback, dev-only warning), they
  do not crash. Authors should replace Hero blocks with `press.rich-text` /
  `press.gallery`. CMS entries already storing `press.hero` data remain in the DB
  but are no longer editable as that component.

## 11. Acceptance criteria

1. **AC1 — Palette reshaped.** In the CMS, the page `body` dynamic zone offers
   exactly `press.rich-text` and `press.gallery` under "press"; `press.hero` is
   absent.
2. **AC2 — Hero fully removed.** No `press.hero` schema, renderer, base type,
   `theme.css` rule, or `@ogs-tech/press-web` export (`Hero`, `PressHero`) remains;
   a repo-wide search finds only intentional historical/changeset mentions.
3. **AC3 — Rich Text round-trip.** A `press.rich-text` block authored in the CMS
   blocks editor renders as semantic HTML **on the server** (a true server
   component, no client hydration) via the in-house renderer, inside a
   `[data-block="press.rich-text"]` wrapper, styled by `theme.css` tokens.
4. **AC4 — Gallery media (new contract example).** A `press.gallery` with multiple
   images serializes all images across the REST contract; the renderer resolves
   each `src` absolute against `CMS_URL` in a token-styled grid.
5. **AC5 — Types.** After `press dev` sync, the adopter's generated `PageBody`
   union includes `PressRichText` and `PressGallery` and **not** `PressHero`;
   `gallery.images` is typed `PressMedia[]`.
6. **AC6 — No structural engine change, no new dependency.** `serialize-schema.ts`,
   `generate.ts`, `dz-populate.ts` change only in comments/tests; the feature adds
   **zero** new runtime dependencies (Rich Text uses the in-house renderer).
7. **AC7 — Dogfood boots.** After resetting the playground DB (`rm -rf
   apps/playground/packages/cms/.tmp`), the migrated seed runs clean against the
   reshaped palette and the demo page renders Rich Text + Gallery + the custom
   callout — with **no** orphaned `press.hero` entry in the admin.
8. **AC8 — Breaking shipped honestly.** A `minor` changeset for both packages
   (pre-1.0 breaking; `0.4.1 → 0.5.0`, `0.3.2 → 0.4.0`) with a migration note in
   its body — not a `major`/`1.0.0` jump.
