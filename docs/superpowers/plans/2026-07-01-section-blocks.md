# Composite Section Blocks (`section.*`, v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an engine-owned palette of composite sections (`section.hero`, `section.cta`) that are admitted into the page `body` Dynamic Zone automatically, render as semantic HTML branded by the adopter's theme, and are overridable via `BlockRenderer`.

**Architecture:** Mirror the existing `press.*` mechanism into a new Strapi category `section.*`. CMS injects two flat components and lists them **statically** in the page DZ; the type-sync pipeline (serialize → generator → `generated.ts`) carries them with **zero** generator change (v1 fields are all scalar/media/enum). Web adds two renderers behind a **separate** `sectionBlocks` registry that `BlockRenderer` merges between `referenceBlocks` and the adopter's `components`, preserving the documented three-palette split (`press.*` / `section.*` / `custom.*`).

**Tech Stack:** Strapi 5 plugin (`@ogs-tech/press-cms`), Next.js host template (`@ogs-tech/press-web`), shared wire contract (`@ogs-tech/press-shared`), vitest + tsc as the quality gate, changesets for release.

## Global Constraints

Every task's requirements implicitly include this section.

- **Runtime:** Node 20.x, pnpm 10.x. Run all commands from the repo root.
- **Quality gate:** there is **no eslint**. The gate is `tsc --noEmit` (typecheck) + vitest. A task is done only when both pass for the touched package.
- **Engine ships TS source:** `web` and `shared` have echo-only `build`; only `cms` compiles (`strapi-plugin build`). Introduce no bundling.
- **Additive & non-breaking:** `press.*` and `custom.*` are untouched. Sections live under the `section.*` category — **never** `press.*` (do not reintroduce `press.hero`).
- **`PressSchema` is imported type-only** by both cms and web; it references no Strapi/React types.
- **`globalId` is always derived deterministically** via `toGlobalId('component_<uid>')` — never taken from JSON.
- **`theme.css` stays a pure `var(--press-*)` token consumer** — no hardcoded brand color/space/radius/font values.
- **Language:** all code, comments, identifiers, and test descriptions in English.
- **Comment convention:** cite deliberate design decisions as `Spec §…` matching this feature's design spec (`docs/superpowers/specs/2026-07-01-section-blocks-design.md`).

## File Structure

**Create:**
- `packages/cms/server/src/components/section/hero.json` — `section.hero` field schema (flat).
- `packages/cms/server/src/components/section/cta.json` — `section.cta` field schema (flat).
- `packages/web/src/sections/hero.tsx` — `Hero` renderer.
- `packages/web/src/sections/hero.test.ts` — hero render + tolerant empty-state tests.
- `packages/web/src/sections/cta.tsx` — `Cta` renderer.
- `packages/web/src/sections/cta.test.ts` — cta render + tolerant empty-state tests.
- `packages/web/src/section-blocks.ts` — the `sectionBlocks` registry map.
- `packages/web/src/block-renderer.test.tsx` — resolution-from-`sectionBlocks` + adopter-override tests.
- `.changeset/section-blocks.md` — minor bump for both engine packages.

**Modify:**
- `packages/cms/server/src/lib/inject-components.ts` — add two `section` entries + imports.
- `packages/cms/server/src/lib/inject-components.test.ts` — injection + static-admission tests.
- `packages/cms/server/src/content-types/page/schema.json` — list the two section uids in `body.components`.
- `packages/cms/server/src/lib/serialize-schema.test.ts` — sections serialize with flat attributes.
- `packages/web/src/generator/generate.test.ts` — a schema with `section.hero` emits `SectionHero` + union entry.
- `packages/web/src/types/base.ts` — hand-written `SectionHero` / `SectionCta` interfaces.
- `packages/web/src/block-renderer.tsx` — merge `sectionBlocks` into the registry.
- `packages/web/src/index.ts` — export `Hero`, `Cta`, `sectionBlocks`, `SectionHero`, `SectionCta`.
- `packages/web/theme.css` — `[data-block="section.hero"|"section.cta"]` token-consuming rules.
- `CLAUDE.md` — document the third palette + the `sectionBlocks` merge.

---

## Task 1: CMS — section component schemas + injection

**Files:**
- Create: `packages/cms/server/src/components/section/hero.json`
- Create: `packages/cms/server/src/components/section/cta.json`
- Modify: `packages/cms/server/src/lib/inject-components.ts`
- Test: `packages/cms/server/src/lib/inject-components.test.ts`

**Interfaces:**
- Consumes: `injectComponents({ strapi })` and `toGlobalId(input)` (existing).
- Produces: the injected component uids `section.hero` and `section.cta`, each with `category: 'section'`, `modelType: 'component'`, and `globalId: 'ComponentSectionHero' | 'ComponentSectionCta'`. Later tasks (serialize, generator, renderers) rely on these uids and their flat attribute sets from §4 of the spec.

- [ ] **Step 1: Create the `section.hero` component schema**

Create `packages/cms/server/src/components/section/hero.json`:

```json
{
  "collectionName": "components_section_heroes",
  "info": { "displayName": "Hero", "description": "A hero section shipped by the press engine" },
  "options": {},
  "attributes": {
    "eyebrow": { "type": "string" },
    "title": { "type": "string", "required": true },
    "subtitle": { "type": "text" },
    "image": { "type": "media", "multiple": false, "allowedTypes": ["images"] },
    "ctaLabel": { "type": "string" },
    "ctaHref": { "type": "string" },
    "align": { "type": "enumeration", "enum": ["left", "center"], "default": "left" }
  }
}
```

- [ ] **Step 2: Create the `section.cta` component schema**

Create `packages/cms/server/src/components/section/cta.json`:

```json
{
  "collectionName": "components_section_ctas",
  "info": { "displayName": "Call to Action", "description": "A call-to-action banner shipped by the press engine" },
  "options": {},
  "attributes": {
    "title": { "type": "string", "required": true },
    "subtitle": { "type": "text" },
    "buttonLabel": { "type": "string", "required": true },
    "buttonHref": { "type": "string", "required": true },
    "align": { "type": "enumeration", "enum": ["left", "center"], "default": "left" }
  }
}
```

- [ ] **Step 3: Write the failing injection test**

In `packages/cms/server/src/lib/inject-components.test.ts`, add a new test **inside the existing `describe('injectComponents')` block** (after the `injects press.nav-item but never admits it` test, before the block's closing `});`):

```ts
  it('injects section.hero and section.cta under category "section" with a derived globalId', () => {
    // Sections mirror the press.* injection mechanism but under a SEPARATE category
    // so the atomic press.* boundary stays intact (Spec §5.1).
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });

    expect(components.get('section.hero')?.modelType).toBe('component');
    expect(components.get('section.hero')?.category).toBe('section');
    expect(components.get('section.hero')?.globalId).toBe('ComponentSectionHero');

    expect(components.get('section.cta')?.modelType).toBe('component');
    expect(components.get('section.cta')?.category).toBe('section');
    expect(components.get('section.cta')?.globalId).toBe('ComponentSectionCta');

    // Sections are NOT press.hero — the removed atom stays removed (Spec §3).
    expect(components.get('press.hero')).toBeUndefined();
  });
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-cms test server/src/lib/inject-components.test.ts`
Expected: FAIL — `components.get('section.hero')` is `undefined` (not yet injected).

- [ ] **Step 5: Wire the sections into `ENGINE_COMPONENTS`**

In `packages/cms/server/src/lib/inject-components.ts`, add two imports after the `navItemSchema` import (line 13):

```ts
import heroSectionSchema from '../components/section/hero.json';
import ctaSectionSchema from '../components/section/cta.json';
```

Then add two entries to the `ENGINE_COMPONENTS` array. Insert them after the `press.spacer` entry (line 43), before the `// Configuration components` comment:

```ts
  // Composite sections: engine-owned, flat (scalar/media/enum) building blocks.
  // Separate category from press.* keeps the atomic palette intact (Spec §5.1).
  { category: 'section', name: 'hero', schema: heroSectionSchema as Record<string, unknown> },
  { category: 'section', name: 'cta', schema: ctaSectionSchema as Record<string, unknown> },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-cms test server/src/lib/inject-components.test.ts`
Expected: PASS — all `injectComponents` tests green, including the new one.

- [ ] **Step 7: Typecheck the CMS backend**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS — `tsc -p server/tsconfig.json --noEmit` reports no errors (JSON imports resolve via `resolveJsonModule`).

- [ ] **Step 8: Commit**

```bash
git add packages/cms/server/src/components/section packages/cms/server/src/lib/inject-components.ts packages/cms/server/src/lib/inject-components.test.ts
git commit -m "feat(cms): inject section.hero and section.cta components"
```

---

## Task 2: CMS — static DZ admission + serialization

**Files:**
- Modify: `packages/cms/server/src/content-types/page/schema.json`
- Test: `packages/cms/server/src/lib/inject-components.test.ts` (static-admission test)
- Test: `packages/cms/server/src/lib/serialize-schema.test.ts` (serialization test)

**Interfaces:**
- Consumes: the injected `section.hero` / `section.cta` uids from Task 1; `serializeSchema(strapi)` (existing).
- Produces: `page.body.components` now statically includes `"section.hero"` and `"section.cta"`; `serializeSchema` emits both under `schema.components` with their flat attributes. The generator (Task 3) and renderers depend on this admission.

- [ ] **Step 1: Write the failing static-admission test**

In `packages/cms/server/src/lib/inject-components.test.ts`, add an import at the top (after line 2, the existing `import { admitCustomBlocks, injectComponents }` line):

```ts
import pageSchema from '../content-types/page/schema.json';
```

Then add a new `describe` block at the end of the file (after the `describe('injectComponents')` block's closing `});`):

```ts
describe('page body dynamic zone (static section admission)', () => {
  it('lists section.hero and section.cta alongside the press.* atoms', () => {
    // Sections are engine-owned and deterministic, so they are admitted STATICALLY
    // in the page schema (not via the dynamic custom.* push) — Spec §5.1.
    const components = pageSchema.attributes.body.components as string[];
    expect(components).toContain('section.hero');
    expect(components).toContain('section.cta');
    // Additive: the press.* atoms remain admitted, unchanged (Spec §2).
    expect(components).toContain('press.paragraph');
    expect(components).toContain('press.image');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-cms test server/src/lib/inject-components.test.ts`
Expected: FAIL — `page.body.components` does not yet contain `"section.hero"`.

- [ ] **Step 3: Add the sections to the page Dynamic Zone**

In `packages/cms/server/src/content-types/page/schema.json`, extend the `body.components` array to append the two section uids after `"press.spacer"`:

```json
    "body": {
      "type": "dynamiczone",
      "components": [
        "press.paragraph",
        "press.heading",
        "press.list",
        "press.quote",
        "press.image",
        "press.button",
        "press.separator",
        "press.spacer",
        "section.hero",
        "section.cta"
      ]
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-cms test server/src/lib/inject-components.test.ts`
Expected: PASS — the static-admission test is green.

- [ ] **Step 5: Write the failing serialization test**

In `packages/cms/server/src/lib/serialize-schema.test.ts`, add a new test inside the `describe('serializeSchema')` block (after the existing `keeps only the contract attribute keys` test, before the throw-cases):

```ts
  it('serializes section.hero and section.cta with their flat attributes (runtime view)', () => {
    const components = new Map<string, any>([
      ['section.hero', {
        uid: 'section.hero',
        attributes: {
          eyebrow: { type: 'string' },
          title: { type: 'string', required: true },
          subtitle: { type: 'text' },
          image: { type: 'media', multiple: false, allowedTypes: ['images'] },
          ctaLabel: { type: 'string' },
          ctaHref: { type: 'string' },
          align: { type: 'enumeration', enum: ['left', 'center'], default: 'left' },
        },
      }],
      ['section.cta', {
        uid: 'section.cta',
        attributes: {
          title: { type: 'string', required: true },
          subtitle: { type: 'text' },
          buttonLabel: { type: 'string', required: true },
          buttonHref: { type: 'string', required: true },
          align: { type: 'enumeration', enum: ['left', 'center'], default: 'left' },
        },
      }],
    ]);
    const strapi = {
      contentType: () => ({
        uid: 'plugin::press-cms.page',
        info: {},
        attributes: { body: { type: 'dynamiczone', components: ['section.hero', 'section.cta'] } },
      }),
      get: (key: string) => (key === 'components' ? components : undefined),
    } as any;

    const out = serializeSchema(strapi);
    expect(Object.keys(out.components).sort()).toEqual(['section.cta', 'section.hero']);
    // Flat fields survive verbatim — no serialize-schema change is needed (Spec §5.1/§7).
    expect(out.components['section.hero'].attributes.title).toEqual({ type: 'string', required: true });
    expect(out.components['section.hero'].attributes.align).toEqual({
      type: 'enumeration', enum: ['left', 'center'], default: 'left',
    });
    expect(out.components['section.cta'].attributes.buttonHref).toEqual({ type: 'string', required: true });
  });
```

- [ ] **Step 6: Run the serialization test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-cms test server/src/lib/serialize-schema.test.ts`
Expected: PASS — sections serialize with flat attributes and no code change to `serialize-schema.ts` (this is the point of §7: the flat pipeline is untouched).

- [ ] **Step 7: Run the full CMS suite + backend typecheck**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS — all cms vitest suites green; backend `tsc` clean.

- [ ] **Step 8: Commit**

```bash
git add packages/cms/server/src/content-types/page/schema.json packages/cms/server/src/lib/inject-components.test.ts packages/cms/server/src/lib/serialize-schema.test.ts
git commit -m "feat(cms): admit section.* into page DZ and serialize them"
```

---

## Task 3: Generator — prove sections generate with zero change

**Files:**
- Test: `packages/web/src/generator/generate.test.ts`

**Interfaces:**
- Consumes: `generateTypes(schema)`, `pascalForUid(uid)`, `tsTypeForAttribute(attr)` (existing, unchanged).
- Produces: verification that `pascalForUid('section.hero') === 'SectionHero'` and that a schema containing `section.hero` emits a `SectionHero` interface plus a `PageBody` union entry. No production code changes — this task guards the §7 "type-sync impact: none" claim.

- [ ] **Step 1: Write the failing generator test**

In `packages/web/src/generator/generate.test.ts`, add a new `describe` block at the end of the file (after the existing `describe('generateTypes')` closing `});`):

```ts
describe('generateTypes with section.* blocks', () => {
  // v1 sections are FLAT (scalar/media/enum), so the existing generator emits them
  // with zero change — this test pins that contract (Spec §7).
  const schema = {
    contentTypes: {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: { singularName: 'page' },
        attributes: {
          title: { type: 'string', required: true },
          body: { type: 'dynamiczone', components: ['section.hero', 'section.cta'] },
        },
      },
    },
    components: {
      'section.hero': {
        uid: 'section.hero',
        attributes: {
          eyebrow: { type: 'string' },
          title: { type: 'string', required: true },
          subtitle: { type: 'text' },
          image: { type: 'media', multiple: false, allowedTypes: ['images'] },
          ctaLabel: { type: 'string' },
          ctaHref: { type: 'string' },
          align: { type: 'enumeration', enum: ['left', 'center'], default: 'left' },
        },
      },
      'section.cta': {
        uid: 'section.cta',
        attributes: {
          title: { type: 'string', required: true },
          subtitle: { type: 'text' },
          buttonLabel: { type: 'string', required: true },
          buttonHref: { type: 'string', required: true },
          align: { type: 'enumeration', enum: ['left', 'center'], default: 'left' },
        },
      },
    },
  };

  const out = generateTypes(schema);

  it('derives PascalCase interface names from the section uids', () => {
    expect(pascalForUid('section.hero')).toBe('SectionHero');
    expect(pascalForUid('section.cta')).toBe('SectionCta');
  });

  it('emits a SectionHero interface with correctly optional/required flat fields', () => {
    expect(out).toContain("__component: 'section.hero'");
    expect(out).toContain('title: string;');                 // required → no ?
    expect(out).toContain('eyebrow?: string;');              // optional
    expect(out).toContain('subtitle?: string;');             // text → string, optional
    expect(out).toContain('image?: PressMedia;');            // single media, optional
    expect(out).toContain("align?: 'left' | 'center';");     // enum union, optional (default ≠ required)
  });

  it('emits a SectionCta interface with required button fields', () => {
    expect(out).toContain("__component: 'section.cta'");
    expect(out).toContain('buttonLabel: string;');
    expect(out).toContain('buttonHref: string;');
  });

  it('includes both sections in the PageBody union', () => {
    expect(out).toContain('export type PageBody = (SectionHero | SectionCta)[];');
  });
});
```

- [ ] **Step 2: Run the test to verify it passes immediately (no code change)**

Run: `pnpm --filter @ogs-tech/press-web test src/generator/generate.test.ts`
Expected: PASS — the generator already handles scalar/enum/media (`tsTypeForAttribute`), so both interfaces and the union emit correctly with no edit to `generate.ts`. If any assertion fails, STOP: it means a flat field is NOT handled and the §7 assumption is wrong — do not "fix" by widening the generator; re-read the spec first.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/generator/generate.test.ts
git commit -m "test(web): pin zero-change section generation in the type generator"
```

---

## Task 4: Web — section types + Hero renderer

**Files:**
- Modify: `packages/web/src/types/base.ts`
- Create: `packages/web/src/sections/hero.tsx`
- Test: `packages/web/src/sections/hero.test.ts`

**Interfaces:**
- Consumes: `PressMedia` from `../types/base` (existing).
- Produces: `SectionHero` and `SectionCta` interfaces (both added here so Task 5 can consume `SectionCta`); a `Hero` renderer with signature `Hero(props: SectionHero): JSX.Element | null`, exported from `./sections/hero`.

- [ ] **Step 1: Add the hand-written section interfaces**

In `packages/web/src/types/base.ts`, append after the `PressSpacer` interface (line 103, before the `Block` interface comment block at line 105):

```ts
/**
 * Engine section `section.hero` — engine-owned (mirrors cms section/hero.json).
 * Hand-written here so the engine can type its own renderer; ALSO generated into
 * the adopter's generated.ts by the type-sync loop (Spec §5.2).
 */
export interface SectionHero {
  __component: 'section.hero';
  id: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image?: PressMedia;
  ctaLabel?: string;
  ctaHref?: string;
  align?: 'left' | 'center';
}

/** Engine section `section.cta` — engine-owned (mirrors cms section/cta.json). */
export interface SectionCta {
  __component: 'section.cta';
  id: number;
  title: string;
  subtitle?: string;
  buttonLabel: string;
  buttonHref: string;
  align?: 'left' | 'center';
}
```

- [ ] **Step 2: Write the failing Hero renderer tests**

Create `packages/web/src/sections/hero.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PressMedia } from '../types/base';
import { Hero } from './hero';

// Mirrors the press.image contract test: renderers are called as functions and
// resolve media absolute against CMS_URL (unset here → engine default).
const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(Hero({ __component: 'section.hero', id: 1, ...(props as any) }));

const img = (url: string, alternativeText?: string | null): PressMedia => ({ url, alternativeText });

describe('Hero renderer', () => {
  it('wraps output in a data-block="section.hero" section', () => {
    expect(render({ title: 'Ship faster' })).toContain('<section data-block="section.hero"');
  });

  it('renders the title as an h1', () => {
    expect(render({ title: 'Ship faster' })).toContain('<h1>Ship faster</h1>');
  });

  it('renders the optional eyebrow and subtitle when present', () => {
    const out = render({ eyebrow: 'New', title: 'Ship faster', subtitle: 'The engine' });
    expect(out).toContain('New');
    expect(out).toContain('The engine');
  });

  it('defaults align to "left" and honors "center"', () => {
    expect(render({ title: 'T' })).toContain('data-align="left"');
    expect(render({ title: 'T', align: 'center' })).toContain('data-align="center"');
  });

  it('resolves the hero image absolute against CMS_URL', () => {
    expect(render({ title: 'T', image: img('/uploads/h.png') }))
      .toContain('src="http://localhost:1337/uploads/h.png"');
  });

  it('omits the image when absent', () => {
    expect(render({ title: 'T' })).not.toContain('<img');
  });

  it('renders the CTA only when BOTH ctaLabel and ctaHref are present (Spec §8)', () => {
    expect(render({ title: 'T', ctaLabel: 'Go', ctaHref: '/go' })).toContain('href="/go"');
    expect(render({ title: 'T', ctaLabel: 'Go' })).not.toContain('data-hero="cta"');
    expect(render({ title: 'T', ctaHref: '/go' })).not.toContain('data-hero="cta"');
  });

  it('renders nothing when title is missing (tolerant draft, Spec §8)', () => {
    expect(render({ eyebrow: 'orphan' })).toBe('');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/sections/hero.test.ts`
Expected: FAIL — `Cannot find module './hero'` (renderer not written yet).

- [ ] **Step 4: Write the Hero renderer**

Create `packages/web/src/sections/hero.tsx`:

```tsx
import type { SectionHero } from '../types/base';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/**
 * Engine section `section.hero` — a hero band born branded by the adopter's theme
 * (theme.css consumes var(--press-*) tokens; no override required — Spec §2/§5.2).
 * Tolerant, mirroring press.image: a draft with no title renders nothing, and the
 * CTA renders only when BOTH label and href are present (no dead links — Spec §8).
 * Media is resolved ABSOLUTE against CMS_URL exactly like press.image.
 */
export function Hero({ eyebrow, title, subtitle, image, ctaLabel, ctaHref, align }: SectionHero) {
  if (!title) return null;
  const hasCta = Boolean(ctaLabel && ctaHref);
  return (
    <section data-block="section.hero" data-align={align ?? 'left'}>
      <div data-hero="content">
        {eyebrow ? <p data-hero="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {subtitle ? <p data-hero="subtitle">{subtitle}</p> : null}
        {hasCta ? (
          <a data-hero="cta" href={ctaHref}>
            {ctaLabel}
          </a>
        ) : null}
      </div>
      {image?.url ? (
        <img src={new URL(image.url, CMS_URL).toString()} alt={image.alternativeText ?? ''} />
      ) : null}
    </section>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/sections/hero.test.ts`
Expected: PASS — all Hero tests green.

- [ ] **Step 6: Typecheck the web package**

Run: `pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS — `tsc --noEmit` clean (both new interfaces + the renderer typecheck).

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/types/base.ts packages/web/src/sections/hero.tsx packages/web/src/sections/hero.test.ts
git commit -m "feat(web): add SectionHero/SectionCta types and the Hero renderer"
```

---

## Task 5: Web — Cta renderer

**Files:**
- Create: `packages/web/src/sections/cta.tsx`
- Test: `packages/web/src/sections/cta.test.ts`

**Interfaces:**
- Consumes: `SectionCta` from `../types/base` (added in Task 4).
- Produces: a `Cta` renderer with signature `Cta(props: SectionCta): JSX.Element | null`, exported from `./sections/cta`.

- [ ] **Step 1: Write the failing Cta renderer tests**

Create `packages/web/src/sections/cta.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Cta } from './cta';

const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(Cta({ __component: 'section.cta', id: 1, ...(props as any) }));

describe('Cta renderer', () => {
  it('wraps output in a data-block="section.cta" section', () => {
    expect(render({ title: 'Start now', buttonLabel: 'Go', buttonHref: '/go' }))
      .toContain('<section data-block="section.cta"');
  });

  it('renders the title as an h2', () => {
    expect(render({ title: 'Start now', buttonLabel: 'Go', buttonHref: '/go' }))
      .toContain('<h2>Start now</h2>');
  });

  it('renders the optional subtitle when present', () => {
    expect(render({ title: 'Start now', subtitle: 'No credit card', buttonLabel: 'Go', buttonHref: '/go' }))
      .toContain('No credit card');
  });

  it('defaults align to "left" and honors "center"', () => {
    expect(render({ title: 'T', buttonLabel: 'Go', buttonHref: '/go' })).toContain('data-align="left"');
    expect(render({ title: 'T', buttonLabel: 'Go', buttonHref: '/go', align: 'center' }))
      .toContain('data-align="center"');
  });

  it('renders the button only when BOTH buttonLabel and buttonHref are present (Spec §8)', () => {
    expect(render({ title: 'T', buttonLabel: 'Go', buttonHref: '/go' })).toContain('href="/go"');
    // Missing href → render heading/subtitle WITHOUT the button (no dead link).
    const noHref = render({ title: 'T', subtitle: 'Sub', buttonLabel: 'Go' });
    expect(noHref).toContain('<h2>T</h2>');
    expect(noHref).toContain('Sub');
    expect(noHref).not.toContain('data-cta="button"');
  });

  it('renders nothing when title is missing (tolerant draft, Spec §8)', () => {
    expect(render({ buttonLabel: 'Go', buttonHref: '/go' })).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/sections/cta.test.ts`
Expected: FAIL — `Cannot find module './cta'`.

- [ ] **Step 3: Write the Cta renderer**

Create `packages/web/src/sections/cta.tsx`:

```tsx
import type { SectionCta } from '../types/base';

/**
 * Engine section `section.cta` — a call-to-action banner, born branded by the
 * adopter's theme (theme.css token consumer — Spec §2/§5.2). Tolerant: a draft
 * with no title renders nothing, and the button renders only when BOTH label and
 * href are present, so a half-filled draft never emits a dead link (Spec §8).
 */
export function Cta({ title, subtitle, buttonLabel, buttonHref, align }: SectionCta) {
  if (!title) return null;
  const hasButton = Boolean(buttonLabel && buttonHref);
  return (
    <section data-block="section.cta" data-align={align ?? 'left'}>
      <h2>{title}</h2>
      {subtitle ? <p data-cta="subtitle">{subtitle}</p> : null}
      {hasButton ? (
        <a data-cta="button" href={buttonHref}>
          {buttonLabel}
        </a>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/sections/cta.test.ts`
Expected: PASS — all Cta tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/sections/cta.tsx packages/web/src/sections/cta.test.ts
git commit -m "feat(web): add the Cta section renderer"
```

---

## Task 6: Web — `sectionBlocks` registry + BlockRenderer merge + exports

**Files:**
- Create: `packages/web/src/section-blocks.ts`
- Modify: `packages/web/src/block-renderer.tsx`
- Modify: `packages/web/src/index.ts`
- Test: `packages/web/src/block-renderer.test.tsx`

**Interfaces:**
- Consumes: `Hero` (Task 4), `Cta` (Task 5), `referenceBlocks` (existing).
- Produces: `sectionBlocks: Record<string, ComponentType<any>>` mapping `'section.hero' → Hero`, `'section.cta' → Cta`; a `BlockRenderer` whose registry is `{ ...referenceBlocks, ...sectionBlocks, ...components }` (adopter `components` still wins last); index exports of `Hero`, `Cta`, `sectionBlocks`, and the `SectionHero` / `SectionCta` types.

- [ ] **Step 1: Create the `sectionBlocks` registry**

Create `packages/web/src/section-blocks.ts`:

```ts
import type { ComponentType } from 'react';
import { Hero } from './sections/hero';
import { Cta } from './sections/cta';

/**
 * Engine-owned SECTION registry (Spec §5.2). Kept SEPARATE from referenceBlocks
 * so the documented invariant "referenceBlocks is press.* only" holds, and the
 * three-palette split (press.* atoms / section.* sections / custom.* adopter) is
 * mirrored in code. BlockRenderer merges this between reference and adopter maps.
 */
export const sectionBlocks: Record<string, ComponentType<any>> = {
  'section.hero': Hero,
  'section.cta': Cta,
};
```

- [ ] **Step 2: Write the failing BlockRenderer tests**

Create `packages/web/src/block-renderer.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlockRenderer } from './block-renderer';

describe('BlockRenderer — section blocks', () => {
  it('resolves a section.* block from the sectionBlocks registry', () => {
    const blocks = [{ __component: 'section.hero', id: 1, title: 'Ship faster' } as any];
    const out = renderToStaticMarkup(<BlockRenderer blocks={blocks} />);
    expect(out).toContain('<section data-block="section.hero"');
    expect(out).toContain('Ship faster');
  });

  it('lets an adopter components map override a section renderer (last-wins, Spec §9)', () => {
    const blocks = [{ __component: 'section.hero', id: 1, title: 'Ship faster' } as any];
    const MyHero = ({ title }: { title: string }) => <div data-block="custom-hero">{title}</div>;
    const out = renderToStaticMarkup(<BlockRenderer blocks={blocks} components={{ 'section.hero': MyHero }} />);
    expect(out).toContain('data-block="custom-hero"');
    expect(out).not.toContain('data-block="section.hero"');
  });

  it('still resolves press.* reference blocks (sections are additive)', () => {
    const blocks = [{ __component: 'press.button', id: 1, label: 'Go', href: '/go', variant: 'primary' } as any];
    const out = renderToStaticMarkup(<BlockRenderer blocks={blocks} />);
    expect(out).toContain('data-block="press.button"');
  });

  it('skips an unknown component without crashing', () => {
    const blocks = [{ __component: 'section.does-not-exist', id: 1 } as any];
    expect(() => renderToStaticMarkup(<BlockRenderer blocks={blocks} />)).not.toThrow();
    expect(renderToStaticMarkup(<BlockRenderer blocks={blocks} />)).toBe('');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/block-renderer.test.tsx`
Expected: FAIL — the first test fails because `BlockRenderer` does not yet merge `sectionBlocks` (its registry is `{ ...referenceBlocks, ...components }`, so `section.hero` is unknown and renders nothing).

- [ ] **Step 4: Merge `sectionBlocks` into BlockRenderer**

In `packages/web/src/block-renderer.tsx`, add an import after the `referenceBlocks` import (line 2):

```tsx
import { sectionBlocks } from './section-blocks';
```

Then change the registry line (line 29) from:

```tsx
  const registry = { ...referenceBlocks, ...components };
```

to:

```tsx
  // Three-palette merge (Spec §5.2/§9): press.* atoms, then section.* sections,
  // then the adopter's explicit components — adopter wins last for per-key override.
  const registry = { ...referenceBlocks, ...sectionBlocks, ...components };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/block-renderer.test.tsx`
Expected: PASS — sections resolve from `sectionBlocks`, adopter override wins, `press.*` still resolves, unknown is skipped.

- [ ] **Step 6: Export the new public surface**

In `packages/web/src/index.ts`, add after the `export { Spacer } ...` line (line 13):

```ts
export { Hero } from './sections/hero';
export { Cta } from './sections/cta';
export { sectionBlocks } from './section-blocks';
```

Then add `SectionHero` and `SectionCta` to the `export type { ... } from './types/base';` block (after `PressSpacer,`):

```ts
  SectionHero,
  SectionCta,
```

- [ ] **Step 7: Typecheck + run the full web suite**

Run: `pnpm --filter @ogs-tech/press-web typecheck && pnpm --filter @ogs-tech/press-web test`
Expected: PASS — `tsc --noEmit` clean; every web vitest suite green.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/section-blocks.ts packages/web/src/block-renderer.tsx packages/web/src/block-renderer.test.tsx packages/web/src/index.ts
git commit -m "feat(web): merge sectionBlocks into BlockRenderer and export the palette"
```

---

## Task 7: Web — theme.css section rules (born branded)

**Files:**
- Modify: `packages/web/theme.css`

**Interfaces:**
- Consumes: existing `var(--press-*)` tokens emitted by `buildThemeStyle` (colors, space, text, radius). No new tokens are introduced.
- Produces: `[data-block="section.hero"]` and `[data-block="section.cta"]` style rules, plus their `[data-align="center"]` variants and the inner `data-hero`/`data-cta` hooks used by the renderers.

- [ ] **Step 1: Append the section rules**

At the end of `packages/web/theme.css` (after the `press.spacer` block, line 243), append:

```css
/* Engine section: section.hero — a branded hero band. Pure token consumer
   (Spec §5.2): every value derives from var(--press-*), so the section is born
   branded with the adopter's Site Settings theme, no override required. */
[data-block="section.hero"] {
  display: grid;
  gap: var(--press-space-5);
  align-items: center;
  margin: var(--press-space-7) 0;
}
[data-block="section.hero"][data-align="center"] {
  text-align: center;
  justify-items: center;
}
[data-block="section.hero"] h1 {
  margin: 0 0 var(--press-space-3);
}
[data-block="section.hero"] [data-hero="eyebrow"] {
  margin: 0 0 var(--press-space-2);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: var(--press-text-sm);
  color: var(--press-color-muted);
}
[data-block="section.hero"] [data-hero="subtitle"] {
  margin: 0 0 var(--press-space-4);
  font-size: var(--press-text-lg);
  color: var(--press-color-muted);
}
[data-block="section.hero"] [data-hero="cta"] {
  display: inline-flex;
  align-items: center;
  padding: var(--press-space-3) var(--press-space-5);
  border-radius: var(--press-radius-sm);
  background: var(--press-color-primary);
  color: var(--press-color-on-primary);
  font-weight: 600;
  text-decoration: none;
}
[data-block="section.hero"] img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--press-radius-md);
}

/* Engine section: section.cta — a call-to-action banner; 1px stroke over shadow,
   token-driven fill on the button. */
[data-block="section.cta"] {
  margin: var(--press-space-7) 0;
  padding: var(--press-space-6) var(--press-space-5);
  border: 1px solid var(--press-color-border);
  border-radius: var(--press-radius-md);
  background: var(--press-color-surface);
}
[data-block="section.cta"][data-align="center"] {
  text-align: center;
}
[data-block="section.cta"] h2 {
  margin: 0 0 var(--press-space-3);
}
[data-block="section.cta"] [data-cta="subtitle"] {
  margin: 0 0 var(--press-space-4);
  color: var(--press-color-muted);
}
[data-block="section.cta"] [data-cta="button"] {
  display: inline-flex;
  align-items: center;
  padding: var(--press-space-3) var(--press-space-5);
  border-radius: var(--press-radius-sm);
  background: var(--press-color-primary);
  color: var(--press-color-on-primary);
  font-weight: 600;
  text-decoration: none;
}
```

- [ ] **Step 2: Verify the rules are a pure token consumer (no hardcoded brand values)**

Run: `grep -nE '#[0-9a-fA-F]{3,6}|rgb\(|hsl\(' packages/web/theme.css`
Expected: no matches inside the two new `section.*` blocks (the only non-token literals allowed are structural, e.g. `1px`, `0.08em`, `600`, `100%`). Every color/space/radius reference must be a `var(--press-*)`.

- [ ] **Step 3: Confirm nothing else broke in the web suite**

Run: `pnpm --filter @ogs-tech/press-web test`
Expected: PASS — CSS is not unit-tested, but this confirms the earlier tasks are intact after the file addition.

- [ ] **Step 4: Commit**

```bash
git add packages/web/theme.css
git commit -m "feat(web): theme section.hero and section.cta from press-* tokens"
```

---

## Task 8: Docs + changeset

**Files:**
- Modify: `CLAUDE.md`
- Create: `.changeset/section-blocks.md`

**Interfaces:**
- Consumes: nothing (documentation + release metadata).
- Produces: the architecture reference describing the third palette and the `sectionBlocks` merge; a changeset marking both engine packages `minor`.

- [ ] **Step 1: Document the third palette in CLAUDE.md**

In `CLAUDE.md`, under `### Reference blocks + the custom-block extension point`, insert a new bullet **after** the `**Extension point:**` bullet (the one ending `only the custom category is the stable contract.`):

```markdown
- **Engine sections (`section.*`):** a second engine-owned palette of *composite*
  sections (`section.hero`, `section.cta`) — flat (scalar/media/enum) blocks
  injected under the `section` category and admitted into the page `body` Dynamic
  Zone **statically** (listed in `content-types/page/schema.json`), not via the
  dynamic `custom.*` push. They keep the `press.*` atoms intact and flow through the
  unchanged type-sync pipeline. `press.hero` stays removed — sections are never `press.*`.
```

Then replace the web-side `BlockRenderer` bullet (the one starting `On the web side, BlockRenderer merges referenceBlocks (press.*) with the adopter's explicit customBlocks map`) with:

```markdown
- On the web side, `BlockRenderer` merges three maps by `__component`:
  `{ ...referenceBlocks, ...sectionBlocks, ...components }` — engine `press.*` atoms,
  engine `section.*` sections (`src/section-blocks.ts`), then the adopter's
  **explicit** `customBlocks` map (no global registry). Adopter blocks win last, so
  any `section.*` is overridable via `components={{ 'section.hero': MyHero }}`. An
  unknown component is skipped with a dev-only warning, never a crash.
```

- [ ] **Step 2: Create the changeset**

Create `.changeset/section-blocks.md`:

```markdown
---
'@ogs-tech/press-cms': minor
'@ogs-tech/press-web': minor
---

feat: composite section blocks (section.*)

Adds an engine-owned palette of composite sections under a new `section.*`
category: `section.hero` and `section.cta`. CMS injects both components and lists
them statically in the page `body` Dynamic Zone; they flow through the unchanged
type-sync pipeline (all fields are flat scalar/media/enum), so `serialize-schema`
and the generator are untouched. Web ships `Hero`/`Cta` renderers behind a separate
`sectionBlocks` registry that `BlockRenderer` merges between `referenceBlocks` and
the adopter's `components` — each section is born branded by the Site Settings theme
(theme.css consumes `var(--press-*)` tokens) and overridable via
`components={{ 'section.hero': MyHero }}`. Additive and non-breaking: `press.*` and
`custom.*` are unchanged; adopters gain `section.*` on `press upgrade`.
```

- [ ] **Step 3: Sanity-check the changeset status**

Run: `pnpm changeset status`
Expected: reports `@ogs-tech/press-cms` and `@ogs-tech/press-web` will bump `minor` (no error about missing changesets).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .changeset/section-blocks.md
git commit -m "docs: document section.* palette and add changeset"
```

---

## Task 9: Playground dogfood verification

**Files:**
- (Regenerated) `apps/playground/packages/shared/types/generated.ts` — only if the live sync changes it.

**Interfaces:**
- Consumes: the whole feature end-to-end. The playground gets `section.*` for free — the injected components arrive via the `workspace:*` dependency, and `BlockRenderer` already merges `sectionBlocks` internally, so the host template needs **no** change.
- Produces: visual confirmation both sections render, branded by the Site Settings theme; an up-to-date committed `generated.ts` including `SectionHero`/`SectionCta`.

> This task is a **live dogfood verification**, not an automatable unit test — the demo page content is authored in the Strapi admin. Do not fabricate a "pass"; observe the running site.

- [ ] **Step 1: Run the full repo gate before booting**

Run: `pnpm -r test && pnpm -r --if-present typecheck && pnpm build`
Expected: PASS — all vitest suites across `cli`/`web`/`cms`, all typechecks, and the cms `strapi-plugin build` succeed.

- [ ] **Step 2: Boot the playground**

Run: `pnpm play`
Expected: cms comes up on `:1337/admin` and web on `:3000`. On boot, `press dev` re-syncs the schema; watch the logs for a sync that regenerates `apps/playground/packages/shared/types/generated.ts`.

- [ ] **Step 3: Confirm the sections reached the generated types**

Run: `grep -nE "SectionHero|SectionCta" apps/playground/packages/shared/types/generated.ts`
Expected: both `export interface SectionHero` and `export interface SectionCta` are present, and both appear in the `PageBody` union. If absent, the sync did not run — restart `pnpm play` and re-check.

- [ ] **Step 4: Author a demo page in the admin**

In `http://localhost:1337/admin`, open (or create) a page and add two blocks to its `body`:
- a `Hero` (`section.hero`) with at least a `title` (add `eyebrow`, `subtitle`, an `image`, `ctaLabel` + `ctaHref`, and set `align` to exercise the layout).
- a `Call to Action` (`section.cta`) with a `title`, `buttonLabel`, and `buttonHref`.

Publish the page.

- [ ] **Step 5: Verify the rendered output**

Open the page's URL on `http://localhost:3000`. Confirm:
- the hero renders as `<section data-block="section.hero">` with the title as `<h1>`, and the CTA link present (both label + href were set).
- the CTA renders as `<section data-block="section.cta">` with the button link.
- both are **branded**: colors/spacing/radius match the Site Settings theme (they consume `var(--press-*)`), with no unstyled/default-looking output. Inspect the elements to confirm the `data-block` anchors and computed styles come from the tokens.

- [ ] **Step 6: Commit the regenerated types if they changed**

Run: `git status --porcelain apps/playground/packages/shared/types/generated.ts`
If it shows the file as modified:

```bash
git add apps/playground/packages/shared/types/generated.ts
git commit -m "chore(playground): regenerate types with section.* blocks"
```

If unchanged, skip this step.

- [ ] **Step 7: Final gate confirmation**

Run: `pnpm -r test`
Expected: PASS — the complete suite is green with the feature integrated.

---

## Self-Review

**Spec coverage:**
- §4 field sets (hero/cta) → Task 1 JSON schemas + Task 4/5 types/renderers. ✅
- §5.1 CMS: `section/` folder + `ENGINE_COMPONENTS` category `section` + deterministic globalId → Task 1; static DZ admission in `page/schema.json` → Task 2; `serialize-schema` unchanged (test only) → Task 2. ✅
- §5.2 Web: `src/sections/hero.tsx` + `cta.tsx` with `data-block` → Tasks 4/5; separate `sectionBlocks` map → Task 6; three-way merge in `BlockRenderer` → Task 6; theme.css token-consumer rules → Task 7; index exports of `Hero`/`Cta`/`sectionBlocks`/`SectionHero`/`SectionCta` → Task 6. ✅
- §6 data flow → verified live in Task 9. ✅
- §7 type-sync impact none → Task 3 (test proves zero generator change). ✅
- §8 tolerant renderers (no title → nothing; CTA/button only when both parts present) → Task 4/5 tests + impl. ✅
- §9 override (adopter wins last) → Task 6 override test. ✅
- §10 testing (cms inject + serialize, web hero/cta + block-renderer, generator, playground dogfood) → Tasks 1,2,4,5,6,3,9. ✅
- §11 delivery (changeset minor both packages, CLAUDE.md third-palette docs) → Task 8. ✅

**Placeholder scan:** No `TBD`/`add error handling`/`similar to Task N`/`write tests for the above` — every code step carries complete code and every command has an expected result. ✅

**Type consistency:** `SectionHero`/`SectionCta` interface field optionality (Task 4) matches the CMS JSON `required` flags (Task 1), the generator assertions (Task 3), and the serialize test (Task 2) — `title` required; `buttonLabel`/`buttonHref` required; `image`/`align`/`eyebrow`/`subtitle`/`ctaLabel`/`ctaHref` optional. Registry keys `'section.hero'`/`'section.cta'` are identical across `sectionBlocks` (Task 6), `data-block` anchors (Tasks 4/5/7), and CMS uids (Tasks 1/2). `globalId` values `ComponentSectionHero`/`ComponentSectionCta` (Task 1) match `toGlobalId('component_section.hero'|'component_section.cta')`. ✅
