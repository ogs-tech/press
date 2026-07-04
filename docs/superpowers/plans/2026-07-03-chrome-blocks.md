# Chrome Blocks (`chrome.*`, block-composable header & footer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the site header and footer block-composable in the CMS admin — two new Dynamic Zones on the `site-setting` single type rendered through the existing block pipeline — replacing the hardcoded chrome and the `headerNav` repeatable (breaking change).

**Architecture:** Mirror the `section.*` mechanism into a fourth engine category `chrome.*` (`chrome.navbar`, `chrome.footer`), injected during `register()` but admitted **only** into the new `site-setting.header`/`site-setting.footer` DZs — never the page `body`. The serializer walks all three DZs and follows nested component references (`chrome.navbar` → `press.nav-item`, `press.button`); the generator learns `type: 'component'` references, skips `relation`s, emits nested-only components without `__component`, and adds `HeaderBlocks`/`FooterBlocks` unions. On the web side, hydration lives in `mapSiteSettings` (brand injection + nav-item resolution); `BlockRenderer` stays dumb and gains a `chromeBlocks` map in its merge; the host `layout.tsx` swaps hardcoded chrome for two `BlockRenderer` calls. The plugin `bootstrap()` seeds a default composition exactly once (plugin-store flag).

**Tech Stack:** Strapi 5 plugin (`@ogs-tech/press-cms`), Next.js host template (`@ogs-tech/press-web`), shared wire contract (`@ogs-tech/press-shared`), vitest + tsc as the quality gate, changesets for release.

## Global Constraints

Every task's requirements implicitly include this section.

- **Runtime:** Node 20.x, pnpm 10.x. Run all commands from the repo root.
- **Quality gate:** there is **no eslint**. The gate is `tsc --noEmit` (typecheck) + vitest. A task is done only when both pass for the touched package.
- **Engine ships TS source:** `web` and `shared` have echo-only `build`; only `cms` compiles (`strapi-plugin build`). Introduce no bundling.
- **BREAKING CHANGE:** `site-setting.headerNav` is removed with **no automated data migration** (Spec §Migration — two-step scheme rejected). `SiteNav` leaves `press-web`'s public surface; `ResolvedPressConfig.nav` becomes `ResolvedPressConfig.chrome`. Versioning: `press-cms` **major**, `press-web` **major**, `press-shared` **minor**.
- **`chrome.*` is never admitted into the page `body`** — only into `site-setting.header`/`footer`. `press.hero` stays removed; chrome blocks are never `press.*` or `section.*`.
- **Composite chrome blocks, not atoms** (Spec §Decisions 6): the bar's internal layout is owned by the renderer; editors compose blocks, not bar internals.
- **Brand (logo + site name) is never stored on a chrome block** — the renderer receives it via hydration from Site Settings identity fields (no duplicated data).
- **`PressSchema` is imported type-only** by both cms and web; it references no Strapi/React types. The generator references **no Strapi types**.
- **`globalId` is always derived deterministically** via `toGlobalId('component_<uid>')` — never taken from JSON.
- **`theme.css` stays a pure `var(--press-*)` token consumer** — no hardcoded brand color/space/radius/font values.
- **CMS failure maps as empty** — unreachable/malformed CMS → `header`/`footer` render nothing (no `press.config` fallback; unbranded over synthetic).
- **Language:** all code, comments, identifiers, and test descriptions in English.
- **Comment convention:** cite deliberate design decisions as `Spec §…` referencing this feature's design spec (`docs/superpowers/specs/2026-07-03-chrome-blocks-design.md`).

## File Structure

**Create:**
- `packages/cms/server/src/components/chrome/navbar.json` — `chrome.navbar` field schema (nested `press.nav-item[]` + optional `press.button`).
- `packages/cms/server/src/components/chrome/footer.json` — `chrome.footer` field schema (optional `text`).
- `packages/web/src/chrome/nav-links.tsx` — `NavLinks` client component (migrated from `src/nav.tsx`, internal).
- `packages/web/src/chrome/nav-links.test.ts` — migrated from `src/nav.test.ts`.
- `packages/web/src/chrome/navbar.tsx` — `Navbar` renderer (brand + links + CTA).
- `packages/web/src/chrome/navbar.test.ts` — navbar render + tolerance tests.
- `packages/web/src/chrome/footer.tsx` — `Footer` renderer (text with brand·year fallback).
- `packages/web/src/chrome/footer.test.ts` — footer render + fallback tests.
- `packages/web/src/chrome-blocks.ts` — the `chromeBlocks` registry map.
- `.changeset/chrome-blocks.md` — major/major/minor bump documenting the breaking change.

**Modify:**
- `packages/shared/src/index.ts` — `Attr` gains typed `component?` / `repeatable?` keys (additive).
- `packages/cms/server/src/content-types/site-setting/schema.json` — remove `headerNav`; add `header`/`footer` DZs with static admissions.
- `packages/cms/server/src/lib/inject-components.ts` — inject `chrome.*`; `admitCustomBlocks` pushes `custom.*` into all three DZs.
- `packages/cms/server/src/lib/inject-components.test.ts` — chrome injection + three-DZ admission tests.
- `packages/cms/server/src/lib/serialize-schema.ts` — serialize `site-setting` + walk three DZs + follow nested component refs.
- `packages/cms/server/src/lib/serialize-schema.test.ts` — three-DZ + nested-ref + fail-fast tests.
- `packages/cms/server/src/lib/dz-populate.ts` — add `buildChromeDzPopulate` (deep populate for `chrome.navbar`).
- `packages/cms/server/src/lib/dz-populate.test.ts` — chrome populate tests.
- `packages/cms/server/src/controllers/site-setting.ts` — populate `header`/`footer` DZs; drop `headerNav` populate.
- `packages/cms/server/src/controllers/site-setting.test.ts` — chrome populate contract tests.
- `packages/cms/server/src/lib/seed-site-setting.ts` — seed default chrome composition (run-once flag).
- `packages/cms/server/src/lib/seed-site-setting.test.ts` — seed/never-overwrite tests.
- `packages/web/src/generator/generate.ts` — component refs, relation skip, nested-only without `__component`, `HeaderBlocks`/`FooterBlocks`.
- `packages/web/src/generator/generate.test.ts` — generator tests for the above.
- `packages/web/src/config/types.ts` — `ChromeBlock`/`ResolvedNavLink`/`ResolvedChromeNavbar`/`ResolvedChromeFooter`; `SiteSettingsData.header/footer`; `ResolvedPressConfig.chrome`.
- `packages/web/src/map-site-settings.ts` — chrome hydration replaces `headerNav` resolution.
- `packages/web/src/map-site-settings.test.ts` — hydration tests replace the `headerNav` describe.
- `packages/web/src/get-site-config.test.ts` — end-to-end chrome payload test.
- `packages/web/src/config/build-metadata.test.ts` + `packages/web/src/config/build-theme-style.test.ts` — fixture `nav:` → `chrome:`.
- `packages/web/src/block-renderer.tsx` — merge `chromeBlocks` into the registry.
- `packages/web/src/block-renderer.test.tsx` — chrome resolution + adopter-override tests.
- `packages/web/src/index.ts` — remove `SiteNav`; export `Navbar`, `Footer`, `chromeBlocks` + chrome types.
- `packages/web/theme.css` — navbar/cta/footer chrome rules (token-only).
- `packages/web/templates/host/app/layout.tsx` — chrome via `BlockRenderer`.
- `CLAUDE.md` — document the `chrome.*` palette, four-map merge, seed, and the breaking change.

**Delete:**
- `packages/web/src/nav.tsx` (becomes `src/chrome/nav-links.tsx`).
- `packages/web/src/nav.test.ts` (becomes `src/chrome/nav-links.test.ts`).

**Deviation from the spec's letter (Spec §4 "if a DZ is null"):** Strapi cannot distinguish a never-touched DZ from an editor-emptied one — both read back as `[]` through the document service. The plan implements the spec's *intent* ("runs once; never overwrites; an emptied `[]` is respected") with a run-once plugin-store flag: the seeding pass runs a single time per database; after it, the DZs are never written again. Task 6 carries the details.

---

## Task 1: CMS — chrome component schemas + injection

**Files:**
- Create: `packages/cms/server/src/components/chrome/navbar.json`
- Create: `packages/cms/server/src/components/chrome/footer.json`
- Modify: `packages/cms/server/src/lib/inject-components.ts`
- Test: `packages/cms/server/src/lib/inject-components.test.ts`

**Interfaces:**
- Consumes: `injectComponents({ strapi })`, `toGlobalId(input)` and the `ENGINE_COMPONENTS` array (all existing in `inject-components.ts`).
- Produces: injected component uids `chrome.navbar` and `chrome.footer`, each with `category: 'chrome'`, `modelType: 'component'`, and `globalId: 'ComponentChromeNavbar' | 'ComponentChromeFooter'`. `chrome.navbar` has attributes `items` (repeatable `press.nav-item`) and `cta` (single `press.button`); `chrome.footer` has `text` (optional string). Tasks 2–5 rely on these uids and attribute shapes.

- [ ] **Step 1: Create the `chrome.navbar` component schema**

Create `packages/cms/server/src/components/chrome/navbar.json`:

```json
{
  "collectionName": "components_chrome_navbars",
  "info": {
    "displayName": "Navbar",
    "description": "The site header bar shipped by the press engine: nav links plus an optional call-to-action. Brand (logo + name) comes from Site Settings identity, never from this block."
  },
  "options": {},
  "attributes": {
    "items": { "type": "component", "repeatable": true, "component": "press.nav-item" },
    "cta": { "type": "component", "repeatable": false, "component": "press.button" }
  },
  "config": {
    "metadatas": {
      "items": { "edit": { "label": "Navigation items" } },
      "cta": { "edit": { "label": "Call to action", "description": "Optional button rendered at the end of the bar." } }
    }
  }
}
```

- [ ] **Step 2: Create the `chrome.footer` component schema**

Create `packages/cms/server/src/components/chrome/footer.json`:

```json
{
  "collectionName": "components_chrome_footers",
  "info": {
    "displayName": "Footer",
    "description": "The site footer line shipped by the press engine. Empty text falls back to \"site name · current year\"."
  },
  "options": {},
  "attributes": {
    "text": { "type": "string" }
  },
  "config": {
    "metadatas": {
      "text": { "edit": { "label": "Copyright line", "description": "Leave empty to show \"site name · current year\"." } }
    }
  }
}
```

- [ ] **Step 3: Write the failing injection test**

In `packages/cms/server/src/lib/inject-components.test.ts`, add inside the existing `describe('injectComponents')` block (after the `injects section.hero and section.cta …` test, before the block's closing `});`):

```ts
  it('injects chrome.navbar and chrome.footer under category "chrome" with a derived globalId', () => {
    // Chrome blocks mirror the section.* injection mechanism under their own
    // category: composite bars admitted only into the site-setting chrome DZs,
    // never the page body (Spec §1).
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });

    expect(components.get('chrome.navbar')?.modelType).toBe('component');
    expect(components.get('chrome.navbar')?.category).toBe('chrome');
    expect(components.get('chrome.navbar')?.globalId).toBe('ComponentChromeNavbar');
    // Composite shape (Spec §1): nested nav items + optional CTA, no brand fields.
    expect(components.get('chrome.navbar')?.attributes).toMatchObject({
      items: { type: 'component', repeatable: true, component: 'press.nav-item' },
      cta: { type: 'component', repeatable: false, component: 'press.button' },
    });

    expect(components.get('chrome.footer')?.modelType).toBe('component');
    expect(components.get('chrome.footer')?.category).toBe('chrome');
    expect(components.get('chrome.footer')?.globalId).toBe('ComponentChromeFooter');
    expect(components.get('chrome.footer')?.attributes).toMatchObject({ text: { type: 'string' } });
  });
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-cms test -- src/lib/inject-components.test.ts`
Expected: FAIL — `components.get('chrome.navbar')` is `undefined`.

- [ ] **Step 5: Inject the chrome components**

In `packages/cms/server/src/lib/inject-components.ts`:

Add two imports after the `ctaSectionSchema` import:

```ts
import chromeNavbarSchema from '../components/chrome/navbar.json';
import chromeFooterSchema from '../components/chrome/footer.json';
```

Add two entries to `ENGINE_COMPONENTS`, after the two `section` entries and before the "Configuration components" comment:

```ts
  // Composite chrome blocks: header/footer bars admitted ONLY into the
  // site-setting chrome DZs, never the page body (Spec §1). The bar's internal
  // layout is renderer-owned so editors cannot break the chrome (Spec §Decisions 6).
  { category: 'chrome', name: 'navbar', schema: chromeNavbarSchema as Record<string, unknown> },
  { category: 'chrome', name: 'footer', schema: chromeFooterSchema as Record<string, unknown> },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-cms test -- src/lib/inject-components.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: exit 0.

```bash
git add packages/cms/server/src/components/chrome packages/cms/server/src/lib/inject-components.ts packages/cms/server/src/lib/inject-components.test.ts
git commit -m "feat(cms): add chrome.navbar and chrome.footer engine components"
```

---

## Task 2: CMS — site-setting chrome DZs, `headerNav` removal, custom.* into all three DZs

**Files:**
- Modify: `packages/cms/server/src/content-types/site-setting/schema.json`
- Modify: `packages/cms/server/src/lib/inject-components.ts` (the `admitCustomBlocks` function)
- Test: `packages/cms/server/src/lib/inject-components.test.ts`

**Interfaces:**
- Consumes: the `chrome.navbar`/`chrome.footer` uids from Task 1.
- Produces: `site-setting` attributes `header` and `footer`, both `{ type: 'dynamiczone', components: [...] }` statically listing `chrome.* + press.* atoms + section.*`; `headerNav` gone (BREAKING). `admitCustomBlocks({ strapi })` (same signature) now pushes every `custom.*` uid into the page `body` AND both chrome DZs. Tasks 3 and 5 read these DZ component lists from the live registry.

- [ ] **Step 1: Rewrite the site-setting schema**

Replace the full contents of `packages/cms/server/src/content-types/site-setting/schema.json` with:

```json
{
  "kind": "singleType",
  "collectionName": "site_setting",
  "info": {
    "singularName": "site-setting",
    "pluralName": "site-settings",
    "displayName": "Site Settings",
    "description": "Whitelabel identity, SEO, theme values, and block-composed site chrome served at runtime by the press engine"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {},
  "attributes": {
    "name": { "type": "string" },
    "url": { "type": "string" },
    "locale": { "type": "string" },
    "logo": { "type": "media", "multiple": false, "allowedTypes": ["images"] },
    "favicon": { "type": "media", "multiple": false, "allowedTypes": ["images"] },
    "seo": { "type": "component", "repeatable": false, "component": "press.seo" },
    "themeColors": { "type": "component", "repeatable": false, "component": "press.theme-colors" },
    "themeRadius": { "type": "component", "repeatable": false, "component": "press.theme-radius" },
    "header": {
      "type": "dynamiczone",
      "components": [
        "chrome.navbar",
        "chrome.footer",
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
    },
    "footer": {
      "type": "dynamiczone",
      "components": [
        "chrome.navbar",
        "chrome.footer",
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
  },
  "config": {
    "metadatas": {
      "name": { "edit": { "label": "Site Name" } },
      "url": { "edit": { "label": "Site URL" } },
      "locale": { "edit": { "label": "Locale" } },
      "logo": { "edit": { "label": "Logo" } },
      "favicon": { "edit": { "label": "Favicon" } },
      "seo": { "edit": { "label": "SEO" } },
      "themeColors": { "edit": { "label": "Theme Colors" } },
      "themeRadius": { "edit": { "label": "Theme Radius" } },
      "header": { "edit": { "label": "Header", "description": "Block-composed site header. The Navbar block renders brand + links + CTA." } },
      "footer": { "edit": { "label": "Footer", "description": "Block-composed site footer." } }
    }
  }
}
```

Note what changed: `headerNav` attribute AND its `metadatas` entry are gone (BREAKING, Spec §Migration); `header`/`footer` DZs statically admit `chrome.*` + the eight `press.*` atoms + `section.*` (same static pattern as `section.*` in the page `body` — Spec §1). `custom.*` arrives dynamically in Step 5.

- [ ] **Step 2: Update the test helper and write the failing three-DZ admission tests**

In `packages/cms/server/src/lib/inject-components.test.ts`:

**(a)** Add after the existing `import pageSchema …` line:

```ts
import siteSettingSchema from '../content-types/site-setting/schema.json';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';
```

**(b)** Replace the top-level `makeStrapi` helper (the one taking `opts: { page?: any; componentUids?: string[] }`) and the `pageWithBody` helper with:

```ts
/**
 * Minimal Strapi double exposing only what admitCustomBlocks touches: the
 * content-types + components registries (`strapi.get`) and a no-op logger.
 */
const makeStrapi = (opts: { page?: any; siteSetting?: any; componentUids?: string[] }) => {
  const contentTypes = new Map<string, any>();
  if (opts.page) contentTypes.set(PAGE_UID, opts.page);
  if (opts.siteSetting) contentTypes.set(SITE_SETTING_UID, opts.siteSetting);
  const components = new Map<string, any>((opts.componentUids ?? []).map((uid) => [uid, { uid }]));
  return {
    get: (key: string) =>
      key === 'content-types' ? contentTypes : key === 'components' ? components : undefined,
    log: { warn() {}, info() {}, debug() {}, error() {} },
  } as any;
};

const pageWithBody = (components: string[]) => ({
  uid: PAGE_UID,
  attributes: { body: { type: 'dynamiczone', components } },
});

const siteSettingWithChrome = (header: string[] = ['chrome.navbar'], footer: string[] = ['chrome.footer']) => ({
  uid: SITE_SETTING_UID,
  attributes: {
    header: { type: 'dynamiczone', components: header },
    footer: { type: 'dynamiczone', components: footer },
  },
});
```

**(c)** Replace the entire `describe('admitCustomBlocks', …)` block with:

```ts
describe('admitCustomBlocks', () => {
  it('admits every custom.* component into the page body AND both chrome DZs', () => {
    const page = pageWithBody(['press.paragraph']);
    const siteSetting = siteSettingWithChrome();
    const strapi = makeStrapi({
      page,
      siteSetting,
      componentUids: ['press.paragraph', 'custom.callout', 'custom.banner'],
    });

    admitCustomBlocks({ strapi });

    // The adopter contract is unchanged: only the custom CATEGORY is stable, now
    // flowing into all three engine DZs (Spec §1).
    expect(page.attributes.body.components).toEqual(['press.paragraph', 'custom.callout', 'custom.banner']);
    expect(siteSetting.attributes.header.components).toEqual(['chrome.navbar', 'custom.callout', 'custom.banner']);
    expect(siteSetting.attributes.footer.components).toEqual(['chrome.footer', 'custom.callout', 'custom.banner']);
  });

  it('is idempotent: an already-admitted custom.* block is not duplicated in any DZ', () => {
    const page = pageWithBody(['press.paragraph', 'custom.callout']);
    const siteSetting = siteSettingWithChrome(['chrome.navbar', 'custom.callout'], ['chrome.footer', 'custom.callout']);
    const strapi = makeStrapi({ page, siteSetting, componentUids: ['press.paragraph', 'custom.callout'] });

    admitCustomBlocks({ strapi });

    expect(page.attributes.body.components).toEqual(['press.paragraph', 'custom.callout']);
    expect(siteSetting.attributes.header.components).toEqual(['chrome.navbar', 'custom.callout']);
    expect(siteSetting.attributes.footer.components).toEqual(['chrome.footer', 'custom.callout']);
  });

  it('never pushes chrome.* into the page body (chrome is not a custom category)', () => {
    const page = pageWithBody(['press.paragraph']);
    const siteSetting = siteSettingWithChrome();
    const strapi = makeStrapi({
      page,
      siteSetting,
      componentUids: ['press.paragraph', 'chrome.navbar', 'chrome.footer'],
    });

    admitCustomBlocks({ strapi });

    expect(page.attributes.body.components).toEqual(['press.paragraph']);
  });

  it('throws (aborts boot) when the page content-type is absent from the registry', () => {
    const strapi = makeStrapi({ siteSetting: siteSettingWithChrome(), componentUids: ['custom.callout'] });
    expect(() => admitCustomBlocks({ strapi })).toThrow(/plugin::press-cms\.page.*absent/);
  });

  it('throws (aborts boot) when the site-setting content-type is absent from the registry', () => {
    const strapi = makeStrapi({ page: pageWithBody(['press.paragraph']), componentUids: ['custom.callout'] });
    expect(() => admitCustomBlocks({ strapi })).toThrow(/plugin::press-cms\.site-setting.*absent/);
  });

  it('throws (aborts boot) when page.body is not a dynamic zone', () => {
    const strapi = makeStrapi({
      page: { uid: PAGE_UID, attributes: { body: { type: 'string' } } },
      siteSetting: siteSettingWithChrome(),
      componentUids: ['custom.callout'],
    });
    expect(() => admitCustomBlocks({ strapi })).toThrow(/no 'body' dynamic zone/);
  });

  it('throws (aborts boot) when a chrome DZ is missing or malformed', () => {
    const strapi = makeStrapi({
      page: pageWithBody(['press.paragraph']),
      siteSetting: { uid: SITE_SETTING_UID, attributes: { header: { type: 'string' } } },
      componentUids: ['custom.callout'],
    });
    expect(() => admitCustomBlocks({ strapi })).toThrow(/no 'header' dynamic zone/);
  });
});
```

**(d)** In the `injectComponents` describe, the existing test `injects press.nav-item but never admits it into the page Dynamic Zone` builds its own strapi double with only the page content-type — `admitCustomBlocks` will now throw there. Update that test's setup to also register the site-setting: replace its `const contentTypes = …` line with:

```ts
    const contentTypes = new Map<string, any>([
      [PAGE_UID, page],
      [SITE_SETTING_UID, siteSettingWithChrome()],
    ]);
```

**(e)** Add a new top-level describe at the end of the file (after the `page body dynamic zone` describe), pinning the static admissions:

```ts
describe('site-setting chrome dynamic zones (static admission)', () => {
  it('admits chrome.* + press.* atoms + section.* into header and footer, statically', () => {
    // Chrome DZs admit everything except custom.* (which arrives dynamically) —
    // listed statically like section.* in the page body (Spec §1).
    for (const zone of ['header', 'footer'] as const) {
      const components = (siteSettingSchema.attributes as any)[zone].components as string[];
      expect(components).toContain('chrome.navbar');
      expect(components).toContain('chrome.footer');
      expect(components).toContain('press.paragraph');
      expect(components).toContain('press.button');
      expect(components).toContain('section.hero');
      expect(components).toContain('section.cta');
    }
  });

  it('no longer carries the removed headerNav attribute (BREAKING, Spec §Migration)', () => {
    expect((siteSettingSchema.attributes as any).headerNav).toBeUndefined();
  });

  it('keeps chrome.* out of the page body Dynamic Zone', () => {
    expect(pageSchema.attributes.body.components).not.toContain('chrome.navbar');
    expect(pageSchema.attributes.body.components).not.toContain('chrome.footer');
  });
});
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `pnpm --filter @ogs-tech/press-cms test -- src/lib/inject-components.test.ts`
Expected: FAIL — the three-DZ admission tests fail (custom.* not pushed into header/footer; no site-setting invariant error yet). The static-admission tests should already PASS (Step 1 changed the JSON).

- [ ] **Step 4: Generalize `admitCustomBlocks` to all three DZs**

In `packages/cms/server/src/lib/inject-components.ts`, replace the entire `admitCustomBlocks` function (keep its doc comment position) with:

```ts
/**
 * Engine Dynamic Zones that accept adopter custom.* blocks. The page body plus
 * the two site-setting chrome zones (Spec §1) — the adopter contract is
 * unchanged: only the "custom" CATEGORY is the stable extension point, never
 * individually named blocks.
 */
const CUSTOM_DZ_TARGETS: Array<{ uid: string; attribute: string }> = [
  { uid: 'plugin::press-cms.page', attribute: 'body' },
  { uid: 'plugin::press-cms.site-setting', attribute: 'header' },
  { uid: 'plugin::press-cms.site-setting', attribute: 'footer' },
];

/**
 * Admits all adopter custom.* components into the engine's Dynamic Zones.
 *
 * Contract: any component the adopter places under <host>/src/components/custom/
 * is automatically admitted into every engine DZ (page body + site-setting
 * header/footer). The engine NEVER names specific adopter blocks; only the
 * "custom" category is the stable extension-point contract.
 *
 * Timing: loadApplicationContext runs loadPlugins + loadComponents in parallel
 * (Promise.all). module.load() registers plugin content-types synchronously when
 * the plugin module is added, so both engine content-types ARE present in the
 * content-types registry by the time plugin register() fires.
 */
export const admitCustomBlocks = ({ strapi }: { strapi: Core.Strapi }): void => {
  const componentRegistry = strapi.get('components');
  const customUids = [...componentRegistry.keys()].filter((uid) => uid.startsWith('custom.'));

  for (const { uid, attribute } of CUSTOM_DZ_TARGETS) {
    const contentType = strapi.get('content-types').get(uid);

    // Invariant: the engine ships both content-types, so they MUST be registered
    // by the time this register hook fires. If one isn't, custom.* admission
    // cannot happen and the engine would boot half-broken (blocks silently absent
    // from the DZ → incomplete types → unknown components). Fail loud, abort boot.
    if (!contentType) {
      throw new Error(
        `[press-cms] invariant violated: '${uid}' is absent from the content-types ` +
          'registry at register time — custom.* blocks cannot be admitted, aborting boot. ' +
          'Likely an engine content-type load failure or a Strapi version mismatch.',
      );
    }

    const dzAttr = (contentType.attributes as Record<string, { type: string; components?: string[] }>)?.[attribute];

    if (!dzAttr || dzAttr.type !== 'dynamiczone' || !Array.isArray(dzAttr.components)) {
      throw new Error(
        `[press-cms] invariant violated: '${uid}' has no '${attribute}' dynamic zone ` +
          '(or it has an unexpected shape) at register time. The engine Dynamic Zones are the ' +
          'extension point for custom.* blocks — aborting boot. Likely a changed schema or a ' +
          'Strapi version mismatch.',
      );
    }

    const admitted: string[] = [];
    for (const customUid of customUids) {
      if (!dzAttr.components.includes(customUid)) {
        dzAttr.components.push(customUid);
        admitted.push(customUid);
      }
    }

    if (admitted.length > 0) {
      strapi.log.info(`[press-cms] admitted custom blocks into ${uid}#${attribute}: ${admitted.join(', ')}`);
    } else {
      strapi.log.debug(`[press-cms] no custom.* components to admit into ${uid}#${attribute}`);
    }
  }
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test -- src/lib/inject-components.test.ts`
Expected: PASS (all tests, including the pre-existing page-only ones).

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: exit 0.

```bash
git add packages/cms/server/src/content-types/site-setting/schema.json packages/cms/server/src/lib/inject-components.ts packages/cms/server/src/lib/inject-components.test.ts
git commit -m "feat(cms)!: site-setting chrome DZs replace headerNav; custom.* admitted into all engine DZs"
```

---

## Task 3: Shared + CMS — serializer walks three DZs and follows nested component refs

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/cms/server/src/lib/serialize-schema.ts`
- Test: `packages/cms/server/src/lib/serialize-schema.test.ts`

**Interfaces:**
- Consumes: the site-setting `header`/`footer` DZ attributes from Task 2; the existing `pickAttributes` / `KEEP` machinery (KEEP already retains `component` and `repeatable` — no change needed there).
- Produces: `Attr` gains typed optional keys `component?: string` and `repeatable?: boolean` (additive — they were already legal via the index signature). `serializeSchema(strapi)` (same signature) now returns BOTH content-types (`plugin::press-cms.page`, `plugin::press-cms.site-setting`) and a `components` map covering all three DZs' admissions PLUS every component reachable via nested `type: 'component'` references (e.g. `press.nav-item`, `press.button` via `chrome.navbar`). Task 4's generator consumes exactly this shape.

- [ ] **Step 1: Extend `Attr` in the shared contract**

In `packages/shared/src/index.ts`, replace the `Attr` interface body with:

```ts
export interface Attr {
  type?: string;
  required?: boolean;
  enum?: string[];
  multiple?: boolean;
  components?: string[];
  /** For `type: 'component'`: the referenced component uid (e.g. `press.nav-item`). */
  component?: string;
  /** For `type: 'component'`: repeatable → array on the wire (Spec §2). */
  repeatable?: boolean;
  [k: string]: unknown;
}
```

Run: `pnpm --filter @ogs-tech/press-shared typecheck`
Expected: exit 0.

- [ ] **Step 2: Write the failing serializer tests**

In `packages/cms/server/src/lib/serialize-schema.test.ts`:

**(a)** The existing `fakeStrapi()` helper's `contentType` only knows the page. Replace the whole `fakeStrapi` helper with a version that carries both content-types (the site-setting with empty chrome DZs keeps the pre-existing tests' expectations unchanged):

```ts
const fakeStrapi = () => {
  const components = new Map<string, any>([
    ['press.paragraph', {
      uid: 'press.paragraph',
      attributes: {
        content: { type: 'blocks', required: true },
        // noise that must be stripped:
        createdAt: { type: 'datetime', private: true },
      },
    }],
    ['press.image', {
      uid: 'press.image',
      attributes: {
        image: { type: 'media', multiple: false, allowedTypes: ['images'], required: true },
        caption: { type: 'string' },
      },
    }],
    ['custom.callout', {
      uid: 'custom.callout',
      attributes: {
        message: { type: 'string', required: true },
        variant: { type: 'enumeration', enum: ['info', 'warning', 'success'], default: 'info' },
      },
    }],
    ['press.unused', { uid: 'press.unused', attributes: { x: { type: 'string' } } }],
  ]);
  const contentTypes: Record<string, any> = {
    'plugin::press-cms.page': {
      uid: 'plugin::press-cms.page',
      info: { singularName: 'page', pluralName: 'pages', displayName: 'Page' },
      attributes: {
        title: { type: 'string', required: true },
        slug: { type: 'uid', targetField: 'title' },
        body: { type: 'dynamiczone', components: ['press.paragraph', 'press.image', 'custom.callout'] },
      },
    },
    'plugin::press-cms.site-setting': {
      uid: 'plugin::press-cms.site-setting',
      info: { singularName: 'site-setting', pluralName: 'site-settings', displayName: 'Site Settings' },
      attributes: {
        name: { type: 'string' },
        header: { type: 'dynamiczone', components: [] },
        footer: { type: 'dynamiczone', components: [] },
      },
    },
  };
  return {
    contentType: (uid: string) => contentTypes[uid],
    get: (key: string) => (key === 'components' ? components : undefined),
  } as any;
};
```

**(b)** Update the first pre-existing test — the serializer now emits two content-types. Replace its `expect(Object.keys(out.contentTypes)).toEqual(['plugin::press-cms.page']);` line with:

```ts
    expect(Object.keys(out.contentTypes).sort()).toEqual([
      'plugin::press-cms.page',
      'plugin::press-cms.site-setting',
    ]);
```

**(c)** The pre-existing test `throws … when the page content-type is not registered` still passes (a `contentType` returning `undefined` fails on the page first). Add a new describe at the end of the file:

```ts
describe('serializeSchema — chrome dynamic zones', () => {
  const chromeStrapi = () => {
    const components = new Map<string, any>([
      ['chrome.navbar', {
        uid: 'chrome.navbar',
        attributes: {
          items: { type: 'component', repeatable: true, component: 'press.nav-item' },
          cta: { type: 'component', repeatable: false, component: 'press.button' },
        },
      }],
      ['chrome.footer', { uid: 'chrome.footer', attributes: { text: { type: 'string' } } }],
      ['press.nav-item', {
        uid: 'press.nav-item',
        attributes: {
          label: { type: 'string', required: true },
          page: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' },
          url: { type: 'string' },
          newTab: { type: 'boolean', default: false },
        },
      }],
      ['press.button', {
        uid: 'press.button',
        attributes: {
          label: { type: 'string', required: true },
          href: { type: 'string', required: true },
          variant: { type: 'enumeration', enum: ['primary', 'secondary'], default: 'primary', required: true },
        },
      }],
      ['press.paragraph', { uid: 'press.paragraph', attributes: { content: { type: 'blocks', required: true } } }],
    ]);
    const contentTypes: Record<string, any> = {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: {},
        attributes: {
          title: { type: 'string', required: true },
          body: { type: 'dynamiczone', components: ['press.paragraph', 'press.button'] },
        },
      },
      'plugin::press-cms.site-setting': {
        uid: 'plugin::press-cms.site-setting',
        info: {},
        attributes: {
          name: { type: 'string' },
          header: { type: 'dynamiczone', components: ['chrome.navbar', 'press.paragraph'] },
          footer: { type: 'dynamiczone', components: ['chrome.footer'] },
        },
      },
    };
    return {
      contentType: (uid: string) => contentTypes[uid],
      get: (key: string) => (key === 'components' ? components : undefined),
    } as any;
  };

  it('serializes the site-setting content-type with its two chrome DZ attributes', () => {
    const out = serializeSchema(chromeStrapi());
    const siteSetting = out.contentTypes['plugin::press-cms.site-setting'];
    expect(siteSetting.attributes.header).toEqual({
      type: 'dynamiczone', components: ['chrome.navbar', 'press.paragraph'],
    });
    expect(siteSetting.attributes.footer).toEqual({
      type: 'dynamiczone', components: ['chrome.footer'],
    });
  });

  it('walks all three DZs into the components map', () => {
    const out = serializeSchema(chromeStrapi());
    for (const uid of ['press.paragraph', 'press.button', 'chrome.navbar', 'chrome.footer']) {
      expect(out.components[uid]).toBeDefined();
    }
  });

  it('follows nested component references — press.nav-item enters the map without being a DZ member (Spec §2)', () => {
    const out = serializeSchema(chromeStrapi());
    expect(out.components['press.nav-item']).toBeDefined();
    expect(out.components['press.nav-item'].attributes.label).toEqual({ type: 'string', required: true });
    // The nested reference keeps its component/repeatable keys so the generator
    // can type it (Spec §2).
    expect(out.components['chrome.navbar'].attributes.items).toEqual({
      type: 'component', repeatable: true, component: 'press.nav-item',
    });
    expect(out.components['chrome.navbar'].attributes.cta).toEqual({
      type: 'component', repeatable: false, component: 'press.button',
    });
  });

  it('does NOT pull site-setting config components (press.seo & co.) into the map', () => {
    // Nested-ref walking starts from DZ admissions only — content-type component
    // attributes (seo, themeColors…) are not part of the block contract.
    const out = serializeSchema(chromeStrapi());
    expect(out.components['press.seo']).toBeUndefined();
  });

  it('fail-fast covers nested refs: a referenced component missing from the registry throws', () => {
    const strapi = chromeStrapi();
    (strapi.get('components') as Map<string, any>).delete('press.nav-item');
    expect(() => serializeSchema(strapi)).toThrow(/press\.nav-item.*absent from the components registry/);
  });

  it('throws when the site-setting content-type is not registered', () => {
    const strapi = chromeStrapi();
    const inner = strapi.contentType;
    strapi.contentType = (uid: string) =>
      uid === 'plugin::press-cms.site-setting' ? undefined : inner(uid);
    expect(() => serializeSchema(strapi)).toThrow(/plugin::press-cms\.site-setting.*not registered/);
  });
});
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `pnpm --filter @ogs-tech/press-cms test -- src/lib/serialize-schema.test.ts`
Expected: FAIL — site-setting missing from `contentTypes`, `press.nav-item` missing from `components`.

- [ ] **Step 4: Rewrite `serializeSchema`**

In `packages/cms/server/src/lib/serialize-schema.ts`, keep the imports, `KEEP`, and `pickAttributes` unchanged. Replace the `PAGE_UID` constant and the `serializeSchema` function with:

```ts
const PAGE_UID = 'plugin::press-cms.page';
const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

const requireContentType = (strapi: Core.Strapi, uid: string) => {
  const ct = strapi.contentType(uid as any) as any;
  // Loud failure beats a cryptic `Cannot read 'uid' of undefined` downstream: if
  // an engine content-type is gone, the type-sync contract cannot be produced.
  if (!ct) {
    throw new Error(
      `[press-cms] cannot serialize schema: content-type '${uid}' is not registered — ` +
        'is @ogs-tech/press-cms loaded? The type-sync contract cannot be produced.',
    );
  }
  return ct;
};

/**
 * Serializes the engine's RUNTIME view (Spec §5.2 golden rule of the type-sync
 * loop): the page AND site-setting content-types plus exactly the components
 * currently admitted into the three engine Dynamic Zones (page `body`,
 * site-setting `header`/`footer`), FOLLOWING nested component references —
 * `chrome.navbar` references `press.nav-item` and `press.button`, so those enter
 * the map even though they are not direct DZ members (Spec §2). Reading the live
 * registry (not loose JSON on disk) means the generator can never disagree with
 * what Strapi actually serves.
 */
export const serializeSchema = (strapi: Core.Strapi): PressSchema => {
  const page = requireContentType(strapi, PAGE_UID);
  const siteSetting = requireContentType(strapi, SITE_SETTING_UID);

  const registry = strapi.get('components') as Map<string, any>;
  const dzComponents: string[] = [
    ...(page.attributes?.body?.components ?? []),
    ...(siteSetting.attributes?.header?.components ?? []),
    ...(siteSetting.attributes?.footer?.components ?? []),
  ];

  const components: PressSchema['components'] = {};
  // Breadth-first over DZ admissions + nested `type: 'component'` references, so
  // nested-only components (press.nav-item) enter the map exactly once.
  const queue = [...new Set(dzComponents)];
  while (queue.length > 0) {
    const uid = queue.shift()!;
    if (components[uid]) continue;
    const comp = registry.get(uid);
    // A uid reachable from an engine DZ but missing from the components registry
    // is a contract violation (Spec §5.2: the schema must never disagree with
    // what Strapi serves). Fail loud rather than silently emit incomplete types.
    if (!comp) {
      throw new Error(
        `[press-cms] cannot serialize schema: component '${uid}' is admitted into an engine ` +
          'Dynamic Zone (or referenced by an admitted component) but absent from the components ' +
          'registry — the generated types would be incomplete. Aborting the schema response.',
      );
    }
    const attributes = pickAttributes(comp.attributes);
    components[uid] = { uid, attributes };
    for (const attr of Object.values(attributes)) {
      if (attr.type === 'component' && typeof attr.component === 'string') queue.push(attr.component);
    }
  }

  return {
    contentTypes: {
      [page.uid]: { uid: page.uid, info: page.info, attributes: pickAttributes(page.attributes) },
      [siteSetting.uid]: { uid: siteSetting.uid, info: siteSetting.info, attributes: pickAttributes(siteSetting.attributes) },
    },
    components,
  };
};
```

Note: the pre-existing error-message regex `/absent from the components registry/` still matches — keep the wording above intact.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test -- src/lib/serialize-schema.test.ts`
Expected: PASS (all, including the pre-existing tests updated in Step 2b).

- [ ] **Step 6: Typecheck both packages and commit**

Run: `pnpm --filter @ogs-tech/press-shared typecheck && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: exit 0.

```bash
git add packages/shared/src/index.ts packages/cms/server/src/lib/serialize-schema.ts packages/cms/server/src/lib/serialize-schema.test.ts
git commit -m "feat(cms): serialize site-setting chrome DZs and follow nested component refs"
```

---

## Task 4: Web — generator learns component refs, relation skip, and chrome unions

**Files:**
- Modify: `packages/web/src/generator/generate.ts`
- Test: `packages/web/src/generator/generate.test.ts`

**Interfaces:**
- Consumes: the `PressSchema` shape from Task 3 (two content-types; `components` map with nested refs; `Attr.component`/`Attr.repeatable` typed).
- Produces: `generateTypes(schema)` (same signature) emits — `type: 'component'` attributes as interface references (`PressNavItem[]` when `repeatable`, `PressButton` when single); `relation` attributes skipped entirely; components that are NOT members of any DZ emitted **without** the `__component` line; `export type HeaderBlocks = (...)[]` and `export type FooterBlocks = (...)[]` unions when the site-setting content-type is present (omitted when absent — version-skew tolerance); `PageBody` and `Page` unchanged. Adopter code and the playground's `generated.ts` rely on these emitted names.

- [ ] **Step 1: Write the failing generator tests**

In `packages/web/src/generator/generate.test.ts`:

**(a)** Add to the `describe('tsTypeForAttribute')` block:

```ts
  it('maps a component reference to its interface name, honoring `repeatable` (Spec §2)', () => {
    expect(tsTypeForAttribute({ type: 'component', component: 'press.nav-item', repeatable: true }))
      .toBe('PressNavItem[]');
    expect(tsTypeForAttribute({ type: 'component', component: 'press.button', repeatable: false }))
      .toBe('PressButton');
  });
```

**(b)** Add a new top-level describe at the end of the file:

```ts
describe('generateTypes with chrome blocks (site-setting DZs)', () => {
  const schema = {
    contentTypes: {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: { singularName: 'page' },
        attributes: {
          title: { type: 'string', required: true },
          body: { type: 'dynamiczone', components: ['press.paragraph', 'press.button'] },
        },
      },
      'plugin::press-cms.site-setting': {
        uid: 'plugin::press-cms.site-setting',
        info: { singularName: 'site-setting' },
        attributes: {
          name: { type: 'string' },
          header: { type: 'dynamiczone', components: ['chrome.navbar', 'press.paragraph', 'custom.callout'] },
          footer: { type: 'dynamiczone', components: ['chrome.footer'] },
        },
      },
    },
    components: {
      'press.paragraph': {
        uid: 'press.paragraph',
        attributes: { content: { type: 'blocks', required: true } },
      },
      'press.button': {
        uid: 'press.button',
        attributes: {
          label: { type: 'string', required: true },
          href: { type: 'string', required: true },
          variant: { type: 'enumeration', enum: ['primary', 'secondary'], default: 'primary', required: true },
        },
      },
      'custom.callout': {
        uid: 'custom.callout',
        attributes: { message: { type: 'string', required: true } },
      },
      'chrome.navbar': {
        uid: 'chrome.navbar',
        attributes: {
          items: { type: 'component', repeatable: true, component: 'press.nav-item' },
          cta: { type: 'component', repeatable: false, component: 'press.button' },
        },
      },
      'chrome.footer': {
        uid: 'chrome.footer',
        attributes: { text: { type: 'string' } },
      },
      'press.nav-item': {
        uid: 'press.nav-item',
        attributes: {
          label: { type: 'string', required: true },
          page: { type: 'relation' },
          url: { type: 'string' },
          newTab: { type: 'boolean', default: false },
        },
      },
    },
  };

  const out = generateTypes(schema);

  it('types nested component references (repeatable → array, single → plain)', () => {
    expect(out).toContain('items?: PressNavItem[];');
    expect(out).toContain('cta?: PressButton;');
  });

  it('emits a nested-only component WITHOUT __component — Strapi sends no discriminator for nested components (Spec §2)', () => {
    expect(out).toContain('export interface PressNavItem {');
    expect(out).not.toContain("__component: 'press.nav-item'");
    // Its scalar fields survive with correct optionality.
    expect(out).toContain('label: string;');
    expect(out).toContain('url?: string;');
    expect(out).toContain('newTab?: boolean;');
  });

  it('keeps __component on a component that IS a DZ member somewhere (press.button in body)', () => {
    expect(out).toContain("__component: 'press.button'");
  });

  it('skips relation attributes — resolved at runtime by the web side, never consumed raw (Spec §2)', () => {
    expect(out).not.toContain('page?:');
    expect(out).not.toContain('page:');
  });

  it('emits HeaderBlocks and FooterBlocks unions alongside PageBody (Spec §2)', () => {
    expect(out).toContain('export type HeaderBlocks = (ChromeNavbar | PressParagraph | CustomCallout)[];');
    expect(out).toContain('export type FooterBlocks = (ChromeFooter)[];');
    expect(out).toContain('export type PageBody = (PressParagraph | PressButton)[];');
  });

  it('omits the chrome unions when the schema has no site-setting entry (version-skew tolerance)', () => {
    const pageOnly = { contentTypes: { 'plugin::press-cms.page': schema.contentTypes['plugin::press-cms.page'] }, components: { 'press.paragraph': schema.components['press.paragraph'], 'press.button': schema.components['press.button'] } };
    const legacy = generateTypes(pageOnly);
    expect(legacy).not.toContain('HeaderBlocks');
    expect(legacy).not.toContain('FooterBlocks');
    expect(legacy).toContain('export type PageBody');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/generator/generate.test.ts`
Expected: FAIL — `items` currently maps to `unknown`, `page` is emitted, no `HeaderBlocks`.

- [ ] **Step 3: Implement the generator changes**

In `packages/web/src/generator/generate.ts`:

**(a)** Add after the `SCALARS` constant:

```ts
const PAGE_UID = 'plugin::press-cms.page';
const SITE_SETTING_UID = 'plugin::press-cms.site-setting';
```

**(b)** In `tsTypeForAttribute`, add a branch before the `media` branch:

```ts
  if (attr.type === 'component' && typeof attr.component === 'string') {
    // A nested component reference (Spec §2). NOTE: Strapi sends no __component
    // discriminator for nested components; when the referenced component is also
    // a DZ member (so its interface carries __component), the nested value simply
    // omits that field on the wire — never discriminate a nested value on it.
    const ref = pascalForUid(attr.component);
    return attr.repeatable ? `${ref}[]` : ref;
  }
```

**(c)** In `emitInterfaceBody`, add a skip right after the dynamiczone skip:

```ts
      // Relations are out of generator scope (Spec §2): the nav-item `page`
      // relation is resolved at runtime by the web side, never consumed raw.
      if (attr.type === 'relation') return null;
```

**(d)** Replace the whole `generateTypes` function with:

```ts
export const generateTypes = (schema: PressSchema): string => {
  const blocks: string[] = [
    '// AUTO-GENERATED by @ogs-tech/press-web sync-types — DO NOT EDIT.',
    '// Regenerate with: pnpm --filter @ogs-tech/press-web sync-types',
    '',
    PRESS_MEDIA,
    '',
  ];

  const page = schema.contentTypes[PAGE_UID] ?? Object.values(schema.contentTypes)[0];
  const siteSetting = schema.contentTypes[SITE_SETTING_UID];

  const bodyUids = page.attributes.body?.components ?? [];
  const headerUids = siteSetting?.attributes.header?.components ?? [];
  const footerUids = siteSetting?.attributes.footer?.components ?? [];
  // Strapi sends the __component discriminator ONLY for dynamic-zone entries; a
  // component that appears solely nested inside another must not claim one (Spec §2).
  const dzMembers = new Set([...bodyUids, ...headerUids, ...footerUids]);

  const componentTypeNames: Record<string, string> = {};
  for (const [uid, comp] of Object.entries(schema.components)) {
    const name = pascalForUid(uid);
    componentTypeNames[uid] = name;
    blocks.push(
      `export interface ${name} {`,
      ...(dzMembers.has(uid) ? [`  __component: '${uid}';`] : []),
      `  id: number;`,
      emitInterfaceBody(comp.attributes),
      `}`,
      '',
    );
  }

  const union = (uids: string[]): string =>
    uids.map((uid) => componentTypeNames[uid]).filter(Boolean).join(' | ');

  blocks.push(`export type PageBody = (${union(bodyUids) || 'never'})[];`, '');

  // Chrome DZ unions (Spec §2). Emitted only when the cms serves the site-setting
  // entry — an older press-cms without chrome must not break type-sync.
  if (siteSetting) {
    blocks.push(`export type HeaderBlocks = (${union(headerUids) || 'never'})[];`, '');
    blocks.push(`export type FooterBlocks = (${union(footerUids) || 'never'})[];`, '');
  }

  const pageFields = Object.entries(page.attributes)
    .map(([name, attr]) => {
      if (name === 'body') return `  body: PageBody;`;
      const optional = attr.required ? '' : '?';
      return `  ${name}${optional}: ${tsTypeForAttribute(attr)};`;
    })
    .join('\n');

  blocks.push(
    `export interface Page {`,
    `  id: number;`,
    `  documentId: string;`,
    pageFields,
    `}`,
    '',
  );

  return blocks.join('\n');
};
```

- [ ] **Step 4: Run the full generator suite to verify everything passes**

Run: `pnpm --filter @ogs-tech/press-web test src/generator/generate.test.ts`
Expected: PASS — new chrome tests AND all pre-existing tests (the pre-existing schemas have every component as a body DZ member, so `__component` emission is unchanged for them).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm --filter @ogs-tech/press-web typecheck`
Expected: exit 0.

```bash
git add packages/web/src/generator/generate.ts packages/web/src/generator/generate.test.ts
git commit -m "feat(web): generator types nested component refs and emits chrome DZ unions"
```

---

## Task 5: CMS — chrome DZ populate in the site-setting controller

**Files:**
- Modify: `packages/cms/server/src/lib/dz-populate.ts`
- Modify: `packages/cms/server/src/controllers/site-setting.ts`
- Test: `packages/cms/server/src/lib/dz-populate.test.ts`
- Test: `packages/cms/server/src/controllers/site-setting.test.ts`

**Interfaces:**
- Consumes: the site-setting `header`/`footer` DZ attributes (Task 2), read from the live content-type at request time (same pattern as the page controller's `bodyPopulate()`).
- Produces: `buildChromeDzPopulate(components: string[]): { on: Record<string, unknown> }` — the populate VALUE for one chrome DZ. The controller's `find` populates `header`/`footer` (deep for `chrome.navbar`: `items.page` → slug + `cta`) and no longer populates `headerNav`. Task 7's `mapSiteSettings` depends on this wire shape (`items[].page.slug` present, `cta` present).

- [ ] **Step 1: Write the failing `buildChromeDzPopulate` test**

Add to `packages/cms/server/src/lib/dz-populate.test.ts` (new describe; also add `buildChromeDzPopulate` to the import):

```ts
describe('buildChromeDzPopulate', () => {
  it("populates one level ('*') per component, EXCEPT chrome.navbar which needs a deep populate", () => {
    // `populate: '*'` is SHALLOW: chrome.navbar's `items.page` relation (internal
    // link → slug) and `cta` component sit one level deeper — without the deep
    // populate every internal nav link silently falls back to its raw url (Spec §1/§3).
    expect(buildChromeDzPopulate(['chrome.navbar', 'chrome.footer', 'custom.callout'])).toEqual({
      on: {
        'chrome.navbar': { populate: { items: { populate: { page: { fields: ['slug'] } } }, cta: true } },
        'chrome.footer': { populate: '*' },
        'custom.callout': { populate: '*' },
      },
    });
  });

  it('produces an empty `on` map when the dynamic zone has no components', () => {
    expect(buildChromeDzPopulate([])).toEqual({ on: {} });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-cms test -- src/lib/dz-populate.test.ts`
Expected: FAIL — `buildChromeDzPopulate` is not exported.

- [ ] **Step 3: Implement `buildChromeDzPopulate`**

Append to `packages/cms/server/src/lib/dz-populate.ts`:

```ts
/**
 * Builds the document-service `populate` VALUE for one site-setting chrome
 * dynamic zone (`header`/`footer`). Like the body, each admitted component gets
 * `populate: '*'` — EXCEPT `chrome.navbar`: its `items.page` relation (internal
 * link, resolved to its slug by the web side) and its `cta` component sit one
 * level below what `'*'` reaches, so they are deep-populated explicitly
 * (Spec §1/§3). Without this, every internal nav link silently falls back to
 * its raw `url` field — the exact failure the old headerNav populate prevented.
 */
export const buildChromeDzPopulate = (components: string[]): { on: Record<string, unknown> } => ({
  on: Object.fromEntries(
    components.map((uid) =>
      uid === 'chrome.navbar'
        ? [uid, { populate: { items: { populate: { page: { fields: ['slug'] } } }, cta: true } }]
        : [uid, { populate: '*' as const }],
    ),
  ),
});
```

Run: `pnpm --filter @ogs-tech/press-cms test -- src/lib/dz-populate.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing controller tests**

In `packages/cms/server/src/controllers/site-setting.test.ts`:

**(a)** Replace the `run()` helper with one whose strapi double also serves the content-type (the controller now reads the DZ admissions at request time):

```ts
  function run(record: unknown = { name: 'Acme' }) {
    const findFirst = vi.fn().mockResolvedValue(record);
    const documents = vi.fn(() => ({ findFirst }));
    const contentType = vi.fn(() => ({
      uid: SITE_SETTING_UID,
      attributes: {
        header: { type: 'dynamiczone', components: ['chrome.navbar', 'press.paragraph', 'custom.callout'] },
        footer: { type: 'dynamiczone', components: ['chrome.footer', 'custom.callout'] },
      },
    }));
    const strapi = { documents, contentType } as any;
    const ctx: any = {};
    return { strapi, ctx, documents, findFirst };
  }
```

**(b)** Replace the `deep-populates headerNav.page …` test with:

```ts
  it('populates both chrome DZs with a per-component `on` map read from the live content-type', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    // custom.* flows through with the same shallow '*' as body blocks.
    expect(populate.header.on['press.paragraph']).toEqual({ populate: '*' });
    expect(populate.header.on['custom.callout']).toEqual({ populate: '*' });
    expect(populate.footer.on['chrome.footer']).toEqual({ populate: '*' });
  });

  it('deep-populates chrome.navbar (items.page slug + cta) so internal nav links resolve to their slug', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.header.on['chrome.navbar']).toEqual({
      populate: { items: { populate: { page: { fields: ['slug'] } } }, cta: true },
    });
  });

  it('no longer populates the removed headerNav (BREAKING, Spec §Migration)', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.headerNav).toBeUndefined();
  });
```

Also update the file's doc comment: replace the sentence mentioning `headerNav.page` with `chrome.navbar's items.page` (same rationale, new field).

- [ ] **Step 5: Run the tests to verify the new ones fail**

Run: `pnpm --filter @ogs-tech/press-cms test -- src/controllers/site-setting.test.ts`
Expected: FAIL — `populate.header` is undefined; `populate.headerNav` still present.

- [ ] **Step 6: Rewrite the controller populate**

Replace the contents of `packages/cms/server/src/controllers/site-setting.ts` with:

```ts
import type { Core } from '@strapi/strapi';
import { buildChromeDzPopulate } from '../lib/dz-populate';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * Engine-owned single-type controller. Reads the one always-live Site Settings
 * record (draftAndPublish: false → no published filter) and returns it under
 * `{ data }` — the wire shape the web resolver (`getSiteConfig`) maps.
 *
 * The engine owns the populate (Spec §5.1 of the site-settings spec): `ctx.query`
 * is NOT honored (public `auth: false` route). `populate: '*'` is SHALLOW, so
 * `seo.image` and the chrome DZs' nested content (`chrome.navbar` items.page +
 * cta) are deep-populated explicitly. The chrome DZ component lists are read from
 * the live content-type at request time — like the page controller — so admitted
 * custom.* blocks populate too.
 */
const siteSetting = ({ strapi }: { strapi: Core.Strapi }) => {
  const chromePopulate = () => {
    const ct = strapi.contentType(SITE_SETTING_UID as any) as any;
    const header: string[] = ct?.attributes?.header?.components ?? [];
    const footer: string[] = ct?.attributes?.footer?.components ?? [];
    return {
      logo: true,
      favicon: true,
      seo: { populate: { image: true } },
      themeColors: true,
      themeRadius: true,
      header: buildChromeDzPopulate(header),
      footer: buildChromeDzPopulate(footer),
    };
  };

  return {
    async find(ctx: any) {
      const data = await strapi
        .documents(SITE_SETTING_UID as any)
        .findFirst({ populate: chromePopulate() as any });
      ctx.body = { data };
    },
  };
};

export default siteSetting;
```

- [ ] **Step 7: Run the tests to verify they pass, typecheck, commit**

Run: `pnpm --filter @ogs-tech/press-cms test -- src/controllers/site-setting.test.ts src/lib/dz-populate.test.ts && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS + exit 0.

```bash
git add packages/cms/server/src/lib/dz-populate.ts packages/cms/server/src/lib/dz-populate.test.ts packages/cms/server/src/controllers/site-setting.ts packages/cms/server/src/controllers/site-setting.test.ts
git commit -m "feat(cms)!: site-setting controller populates chrome DZs, drops headerNav"
```

---

## Task 6: CMS — seed the default chrome composition (run-once)

**Files:**
- Modify: `packages/cms/server/src/lib/seed-site-setting.ts`
- Test: `packages/cms/server/src/lib/seed-site-setting.test.ts`

**Interfaces:**
- Consumes: `strapi.documents(uid)` (`findFirst`/`create`/`update`) and `strapi.store({ type: 'plugin', name: 'press-cms' })` (`get`/`set`).
- Produces: `seedSiteSetting(strapi): Promise<void>` (same signature, still called from `bootstrap.ts` — no bootstrap change needed) and exported constants `SITE_SETTING_UID`, `DEFAULT_CHROME` (`{ header: [{ __component: 'chrome.navbar' }], footer: [{ __component: 'chrome.footer' }] }`). Behavior: fresh DB → one record created WITH the default chrome; existing DB → a single seeding pass fills still-empty DZs, then a plugin-store flag (`chromeSeeded`) prevents any future write, so an editor-emptied `[]` is respected forever.

**Spec adaptation (Spec §4):** the spec says "if a DZ is `null` (never touched)". Strapi's document service does not distinguish a never-touched DZ from an editor-emptied one — both read back as `[]`. The run-once store flag implements the spec's intent literally: the seed *runs once* and *never overwrites*; after the single pass, an emptied DZ stays empty.

- [ ] **Step 1: Rewrite the seed tests (failing)**

Replace the contents of `packages/cms/server/src/lib/seed-site-setting.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CHROME, seedSiteSetting, SITE_SETTING_UID } from './seed-site-setting';

/**
 * Minimal Document-Service + plugin-store fake: a mutable record, recording
 * create/update, and a Map-backed store for the run-once chrome flag.
 */
function fakeStrapi(record: any = null, flags: Record<string, unknown> = {}) {
  const creates: Array<{ data: unknown }> = [];
  const updates: Array<{ documentId: string; data: unknown }> = [];
  let current = record;
  const store = new Map<string, unknown>(Object.entries(flags));
  const strapi = {
    documents: (uid: string) => {
      expect(uid).toBe(SITE_SETTING_UID); // helper must target the single-type UID
      return {
        findFirst: async (params: any) => {
          // The chrome DZs are invisible without populate — pin that the seed asks.
          expect(params?.populate).toMatchObject({ header: true, footer: true });
          return current;
        },
        create: async (params: { data: any }) => {
          creates.push(params);
          current = { documentId: 'doc-1', ...params.data };
          return current;
        },
        update: async (params: { documentId: string; data: any }) => {
          updates.push(params);
          current = { ...current, ...params.data };
          return current;
        },
      };
    },
    store: ({ type, name }: { type: string; name: string }) => {
      expect(type).toBe('plugin');
      expect(name).toBe('press-cms');
      return {
        get: async ({ key }: { key: string }) => store.get(key),
        set: async ({ key, value }: { key: string; value: unknown }) => void store.set(key, value),
      };
    },
  } as any;
  return { strapi, creates, updates, store };
}

describe('seedSiteSetting — chrome composition (Spec §4)', () => {
  it('creates the record WITH the default chrome on a fresh DB and marks the seed done', async () => {
    const { strapi, creates, updates, store } = fakeStrapi(null);
    await seedSiteSetting(strapi);
    expect(creates).toEqual([{ data: DEFAULT_CHROME }]);
    expect(updates).toEqual([]);
    expect(store.get('chromeSeeded')).toBe(true);
  });

  it('fills still-empty DZs on an existing record (upgrade path) exactly once', async () => {
    const { strapi, updates, store } = fakeStrapi({ documentId: 'doc-1', header: [], footer: [] });
    await seedSiteSetting(strapi);
    expect(updates).toEqual([{ documentId: 'doc-1', data: DEFAULT_CHROME }]);
    expect(store.get('chromeSeeded')).toBe(true);
  });

  it('never overwrites a composed DZ — only the empty sibling is seeded', async () => {
    const composed = [{ __component: 'chrome.navbar', id: 7, items: [{ label: 'Docs' }] }];
    const { strapi, updates } = fakeStrapi({ documentId: 'doc-1', header: composed, footer: [] });
    await seedSiteSetting(strapi);
    expect(updates).toEqual([{ documentId: 'doc-1', data: { footer: DEFAULT_CHROME.footer } }]);
  });

  it('respects an editor-emptied [] once the seed has run (flag set → no writes)', async () => {
    const { strapi, creates, updates } = fakeStrapi(
      { documentId: 'doc-1', header: [], footer: [] },
      { chromeSeeded: true },
    );
    await seedSiteSetting(strapi);
    expect(creates).toEqual([]);
    expect(updates).toEqual([]);
  });

  it('is idempotent across repeated runs — one create, no later writes', async () => {
    const { strapi, creates, updates } = fakeStrapi(null);
    await seedSiteSetting(strapi);
    await seedSiteSetting(strapi);
    await seedSiteSetting(strapi);
    expect(creates).toHaveLength(1);
    expect(updates).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test -- src/lib/seed-site-setting.test.ts`
Expected: FAIL — `DEFAULT_CHROME` not exported; old implementation uses `count`, not `findFirst`.

- [ ] **Step 3: Rewrite the seed**

Replace the contents of `packages/cms/server/src/lib/seed-site-setting.ts` with:

```ts
import type { Core } from '@strapi/strapi';

/** UID of the engine's Site Settings single type (plugin name `press-cms`). */
export const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/** Default chrome composition (Spec §4): a navbar (empty items) + a footer (empty text). */
export const DEFAULT_CHROME = {
  header: [{ __component: 'chrome.navbar' }],
  footer: [{ __component: 'chrome.footer' }],
};

const CHROME_SEED_KEY = 'chromeSeeded';

type PluginStore = {
  get: (params: { key: string }) => Promise<unknown>;
  set: (params: { key: string; value: unknown }) => Promise<void>;
};

// `strapi.store` exists at runtime but is not on the Core.Strapi typing surface
// this plugin compiles against — hence the narrow local cast.
const pluginStore = (strapi: Core.Strapi): PluginStore =>
  (strapi as any).store({ type: 'plugin', name: 'press-cms' });

/**
 * Seeds the Site Settings single type (Spec §4/§5 of the site-settings spec):
 *
 * 1. Fresh DB → exactly one record, created WITH the default chrome composition.
 *    Identity/SEO stay empty on purpose: no defaults duplicated in the CMS.
 * 2. Existing record (upgrade path: the chrome DZs just appeared via schema
 *    sync) → a single seeding pass fills each still-empty DZ.
 *
 * "Runs once; never overwrites" (Spec §4) is made literal with a plugin-store
 * flag: Strapi cannot distinguish a never-touched DZ from an editor-emptied one
 * (both read back as []), so after the one seeding pass the DZs are never
 * written again — an editor-emptied [] is respected forever.
 */
export async function seedSiteSetting(strapi: Core.Strapi): Promise<void> {
  const docs = strapi.documents(SITE_SETTING_UID);
  const store = pluginStore(strapi);

  // DZ content is invisible without populate — findFirst({}) would report the
  // zones as undefined and the seed could clobber real content.
  const existing = (await docs.findFirst({ populate: { header: true, footer: true } as any })) as any;

  if (!existing) {
    await docs.create({ data: { ...DEFAULT_CHROME } as any });
  } else if (!(await store.get({ key: CHROME_SEED_KEY }))) {
    const data: Record<string, unknown> = {};
    if (!existing.header?.length) data.header = DEFAULT_CHROME.header;
    if (!existing.footer?.length) data.footer = DEFAULT_CHROME.footer;
    if (Object.keys(data).length > 0) {
      await docs.update({ documentId: existing.documentId, data: data as any });
    }
  } else {
    return; // seeded before — never touch the chrome again
  }

  await store.set({ key: CHROME_SEED_KEY, value: true });
}
```

- [ ] **Step 4: Run the tests to verify they pass, typecheck, commit**

Run: `pnpm --filter @ogs-tech/press-cms test -- src/lib/seed-site-setting.test.ts && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS + exit 0.

```bash
git add packages/cms/server/src/lib/seed-site-setting.ts packages/cms/server/src/lib/seed-site-setting.test.ts
git commit -m "feat(cms): seed default chrome composition once via plugin-store flag"
```

---

## Task 7: Web — chrome config types + `mapSiteSettings` hydration

**Files:**
- Modify: `packages/web/src/config/types.ts`
- Modify: `packages/web/src/map-site-settings.ts`
- Test: `packages/web/src/map-site-settings.test.ts`
- Test: `packages/web/src/get-site-config.test.ts`
- Modify: `packages/web/src/config/build-metadata.test.ts` and `packages/web/src/config/build-theme-style.test.ts` (fixture only)

**Interfaces:**
- Consumes: the controller wire shape from Task 5 (`data.header`/`data.footer` arrays; `chrome.navbar` entries carrying `items[].{label,page.slug,url,newTab}` and `cta`).
- Produces (relied on by Tasks 8–11):
  - `ResolvedNavLink` = `{ label: string; href: string; external: boolean; newTab: boolean }` (exported).
  - `ChromeBlock` = `{ __component: string; id: number; [k: string]: unknown }` (exported).
  - `ResolvedChromeNavbar` = `{ __component: 'chrome.navbar'; id: number; brand: { name: string; logo?: string }; links: ResolvedNavLink[]; cta?: { label?: string; href?: string; variant?: 'primary' | 'secondary' } | null }` (exported).
  - `ResolvedChromeFooter` = `{ __component: 'chrome.footer'; id: number; text?: string | null; brand: { name: string } }` (exported).
  - `SiteSettingsData` loses `headerNav`; gains `header?: ChromeBlock[] | null` and `footer?: ChromeBlock[] | null`.
  - `ResolvedPressConfig` loses `nav`; gains `chrome: { header: ChromeBlock[]; footer: ChromeBlock[] }` (BREAKING).
  - `mapSiteSettings(buildTime, cms)` (same signature) hydrates both DZs.

- [ ] **Step 1: Update the config types**

In `packages/web/src/config/types.ts`:

**(a)** Add these declarations immediately before `export interface ResolvedPressConfig`:

```ts
/** A fully-resolved navigation link (page relation already collapsed to an href). */
export interface ResolvedNavLink {
  label: string;
  href: string;
  external: boolean;
  newTab: boolean;
}

/**
 * A chrome dynamic-zone entry. Loose by design: the zones admit press.* /
 * section.* / custom.* blocks the engine cannot enumerate, and the renderer only
 * dispatches on `__component`. Engine chrome.* entries gain `brand`/`links`
 * during hydration (mapSiteSettings, Spec §3).
 */
export type ChromeBlock = { __component: string; id: number; [k: string]: unknown };

/** Hydrated `chrome.navbar` — the exact props the Navbar renderer receives (Spec §3). */
export interface ResolvedChromeNavbar {
  __component: 'chrome.navbar';
  id: number;
  /** Injected from Site Settings identity — never stored on the block (Spec §1). */
  brand: { name: string; logo?: string };
  /** `items` resolved: page > url precedence, home slug → '/', external flag. */
  links: ResolvedNavLink[];
  cta?: { label?: string; href?: string; variant?: 'primary' | 'secondary' } | null;
}

/** Hydrated `chrome.footer` — brand injected for the copyright fallback (Spec §1). */
export interface ResolvedChromeFooter {
  __component: 'chrome.footer';
  id: number;
  text?: string | null;
  brand: { name: string };
}
```

**(b)** In `ResolvedPressConfig`, replace the whole `nav:` member (including its doc comment) with:

```ts
  /**
   * Site chrome (Spec §3): the two Site-Settings Dynamic Zones, HYDRATED —
   * chrome.navbar entries carry the resolved brand + links and chrome.footer
   * entries carry the brand for the copyright fallback; all other blocks pass
   * through untouched so BlockRenderer stays intentionally dumb. Empty when the
   * CMS is empty/unreachable/malformed (unbranded over synthetic — Spec §4).
   */
  chrome: {
    header: ChromeBlock[];
    footer: ChromeBlock[];
  };
```

**(c)** In `SiteSettingsData`, replace the whole `headerNav?: …` member with:

```ts
  header?: ChromeBlock[] | null;
  footer?: ChromeBlock[] | null;
```

- [ ] **Step 2: Rewrite the map tests (failing)**

In `packages/web/src/map-site-settings.test.ts`:

**(a)** In the first test, replace the `expect(r.nav.header).toEqual([]);` line (and its comment) with:

```ts
    // chrome: empty zones when the CMS is empty (Spec §4)
    expect(r.chrome).toEqual({ header: [], footer: [] });
```

**(b)** Replace the entire `describe('mapSiteSettings — headerNav resolution', …)` block with:

```ts
describe('mapSiteSettings — chrome hydration (Spec §3)', () => {
  const navbar = (extra: Record<string, unknown> = {}) =>
    ({ __component: 'chrome.navbar', id: 1, ...extra });

  const headerWith = (items: unknown[]) =>
    mapSiteSettings(buildTime, { name: 'Acme', header: [navbar({ items })] });

  const linksOf = (r: ReturnType<typeof mapSiteSettings>) =>
    (r.chrome.header[0] as any).links;

  it('injects the resolved brand (name + logo) into chrome.navbar — never stored on the block', () => {
    const r = mapSiteSettings(buildTime, {
      name: 'Acme',
      logo: { url: '/uploads/logo.png' },
      header: [navbar()],
    });
    expect((r.chrome.header[0] as any).brand).toEqual({
      name: 'Acme',
      logo: 'http://localhost:1337/uploads/logo.png',
    });
  });

  it('resolves an internal page item to /slug, external false', () => {
    const r = headerWith([{ label: 'About', page: { slug: 'about' }, newTab: false }]);
    expect(linksOf(r)).toEqual([{ label: 'About', href: '/about', external: false, newTab: false }]);
  });

  it('collapses the home slug to /', () => {
    const r = headerWith([{ label: 'Home', page: { slug: 'home' } }]); // buildTime.routes.home === 'home'
    expect(linksOf(r)[0].href).toBe('/');
  });

  it('resolves an external url with external:true and honors newTab', () => {
    const r = headerWith([{ label: 'Docs', url: 'https://docs.test', newTab: true }]);
    expect(linksOf(r)).toEqual([{ label: 'Docs', href: 'https://docs.test', external: true, newTab: true }]);
  });

  it('lets page win over url when both are set (precedence)', () => {
    const r = headerWith([{ label: 'Both', page: { slug: 'about' }, url: 'https://ignored.test' }]);
    expect(linksOf(r)[0]).toEqual({ label: 'Both', href: '/about', external: false, newTab: false });
  });

  it('drops an item with neither page nor url', () => {
    const r = headerWith([
      { label: 'Keep', url: '/keep' },
      { label: 'Drop' },
      { label: 'DropToo', page: null, url: '' },
    ]);
    expect(linksOf(r).map((l: any) => l.label)).toEqual(['Keep']);
  });

  it('hydrates a navbar with no items to empty links (the seeded default renders brand-only)', () => {
    const r = mapSiteSettings(buildTime, { name: 'Acme', header: [navbar()] });
    expect(linksOf(r)).toEqual([]);
  });

  it('keeps the navbar cta untouched (renderer consumes it as-is)', () => {
    const cta = { label: 'Sign up', href: '/signup', variant: 'primary' };
    const r = mapSiteSettings(buildTime, { header: [navbar({ cta })] });
    expect((r.chrome.header[0] as any).cta).toEqual(cta);
  });

  it('injects the brand into chrome.footer for the copyright fallback', () => {
    const r = mapSiteSettings(buildTime, {
      name: 'Acme',
      footer: [{ __component: 'chrome.footer', id: 2, text: '' }],
    });
    expect((r.chrome.footer[0] as any).brand).toEqual({ name: 'Acme' });
  });

  it('passes non-chrome blocks through untouched (BlockRenderer stays dumb)', () => {
    const hero = { __component: 'section.hero', id: 3, title: 'Big' };
    const r = mapSiteSettings(buildTime, { header: [hero] });
    expect(r.chrome.header).toEqual([hero]);
  });

  it('hydrates the footer zone with the same rules as the header (a navbar works in either zone)', () => {
    const r = mapSiteSettings(buildTime, {
      name: 'Acme',
      footer: [navbar({ items: [{ label: 'About', page: { slug: 'about' } }] })],
    });
    expect((r.chrome.footer[0] as any).links).toEqual([
      { label: 'About', href: '/about', external: false, newTab: false },
    ]);
  });

  it('maps absent / empty zones and a null CMS to empty arrays', () => {
    expect(mapSiteSettings(buildTime, { header: [], footer: [] }).chrome).toEqual({ header: [], footer: [] });
    expect(mapSiteSettings(buildTime, {}).chrome).toEqual({ header: [], footer: [] });
    expect(mapSiteSettings(buildTime, null).chrome).toEqual({ header: [], footer: [] });
  });
});
```

**(c)** In `packages/web/src/get-site-config.test.ts`, replace the `maps a body with nav data end-to-end` test with:

```ts
  it('maps a body with chrome data end-to-end', async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => ({
        data: {
          name: 'Acme',
          header: [{
            __component: 'chrome.navbar',
            id: 1,
            items: [
              { label: 'About', page: { slug: 'about' }, newTab: false },
              { label: 'Docs', url: 'https://docs.test', newTab: true },
            ],
          }],
          footer: [{ __component: 'chrome.footer', id: 2 }],
        },
      }),
    }));
    const r = await getSiteConfig(buildTime);
    expect((r.chrome.header[0] as any).brand).toEqual({ name: 'Acme', logo: undefined });
    expect((r.chrome.header[0] as any).links).toEqual([
      { label: 'About', href: '/about', external: false, newTab: false },
      { label: 'Docs', href: 'https://docs.test', external: true, newTab: true },
    ]);
    expect((r.chrome.footer[0] as any).brand).toEqual({ name: 'Acme' });
  });
```

Also update `get-site-config.ts`'s doc comment: replace `headerNav → page slug` with `chrome DZs → navbar items' page slugs`.

**(d)** In `packages/web/src/config/build-metadata.test.ts` and `packages/web/src/config/build-theme-style.test.ts`, replace the fixture line `nav: { header: [] },` with:

```ts
  chrome: { header: [], footer: [] },
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/map-site-settings.test.ts src/get-site-config.test.ts`
Expected: FAIL — `r.chrome` is undefined (typecheck of the test files also fails until Step 4).

- [ ] **Step 4: Rewrite `mapSiteSettings`**

Replace the contents of `packages/web/src/map-site-settings.ts` with:

```ts
import type {
  BuildTimeConfig,
  ChromeBlock,
  ResolvedNavLink,
  ResolvedPressConfig,
  SiteSettingsData,
} from './config/types';
import { DEFAULT_THEME } from './config/default-theme';

// Same module-level pattern as get-page.ts: read once, default to local Strapi.
const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/** Resolves a Strapi media url absolute against CMS_URL; undefined when absent. */
function mediaUrl(media: { url?: string } | null | undefined): string | undefined {
  const url = media?.url;
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${CMS_URL}${url}`;
}

/** A raw `chrome.navbar` nav item as populated by the site-setting controller. */
interface RawNavItem {
  label?: string;
  page?: { slug?: string } | null;
  url?: string;
  newTab?: boolean;
}

/**
 * Resolves a CMS nav item into a final link (Spec §3). Precedence: `page` wins
 * over `url`. An internal page collapses to '/' when its slug is the home slug
 * (reusing the same routes.home anchor as the /home → / redirect —
 * CMS-independent). An item with neither page nor url is dropped (returns null).
 * The external flag is true only for http(s) URLs.
 */
function resolveNavItem(item: RawNavItem, homeSlug: string): ResolvedNavLink | null {
  const label = item.label ?? '';
  const newTab = item.newTab ?? false;
  const slug = item.page?.slug;
  if (slug) {
    return { label, href: slug === homeSlug ? '/' : `/${slug}`, external: false, newTab };
  }
  if (item.url) {
    return { label, href: item.url, external: item.url.startsWith('http'), newTab };
  }
  return null;
}

/**
 * Hydrates one chrome dynamic zone (Spec §3): `chrome.navbar` gains the resolved
 * brand + links (page > url precedence, home slug → '/', external flag) and
 * `chrome.footer` gains the brand for its copyright fallback — identity is never
 * stored on a block (Spec §1). Every other block passes through untouched so
 * BlockRenderer stays intentionally dumb.
 */
function hydrateChromeBlocks(
  blocks: ChromeBlock[] | null | undefined,
  brand: ResolvedPressConfig['brand'],
  homeSlug: string,
): ChromeBlock[] {
  return (blocks ?? []).map((block) => {
    if (block.__component === 'chrome.navbar') {
      const items = (block.items as RawNavItem[] | null | undefined) ?? [];
      return {
        ...block,
        brand: { name: brand.name, logo: brand.logo },
        links: items
          .map((item) => resolveNavItem(item, homeSlug))
          .filter((link): link is ResolvedNavLink => link !== null),
      };
    }
    if (block.__component === 'chrome.footer') {
      return { ...block, brand: { name: brand.name } };
    }
    return block;
  });
}

/**
 * Pure CMS-shape → ResolvedPressConfig (site-settings-cms spec §3.2). Same input
 * → same output, no I/O, no mutation — unit-testable without a server, safe in an
 * RSC. Identity/SEO come ONLY from the CMS: a present value is used as-is, a
 * missing value stays empty ('' / undefined) — NO inheritance, so "empty CMS
 * field" unambiguously means empty (AC2/AC3). Theme colours/radii resolve over
 * DEFAULT_THEME per key — the engine's shipped base, never empty (AC4). Build-time
 * anchors (routes, theme.name, theme.fonts) come from `buildTime` (AC8). The
 * chrome DZs are hydrated here (chrome-blocks Spec §3) so the renderers stay dumb.
 */
export function mapSiteSettings(
  buildTime: BuildTimeConfig,
  cms: SiteSettingsData | null,
): ResolvedPressConfig {
  const c = cms ?? {};
  const seo = c.seo ?? {};
  const brand = {
    name: c.name ?? '',
    logo: mediaUrl(c.logo),
    favicon: mediaUrl(c.favicon) ?? '',
  };
  return {
    brand,
    site: {
      url: c.url ?? '',
      locale: c.locale ?? '',
    },
    // CMS field names (title/description/image) translate to the engine's
    // internal "default*" SEO names — the values a page inherits when it sets none.
    seo: {
      titleTemplate: seo.titleTemplate ?? '',
      defaultTitle: seo.title ?? '',
      defaultDescription: seo.description ?? '',
      defaultOgImage: mediaUrl(seo.image),
    },
    routes: buildTime.routes,
    theme: {
      name: buildTime.theme.name,
      colors: { ...DEFAULT_THEME.colors, ...(c.themeColors ?? {}) },
      fonts: buildTime.theme.fonts,
      radius: { ...DEFAULT_THEME.radius, ...(c.themeRadius ?? {}) },
    },
    chrome: {
      header: hydrateChromeBlocks(c.header, brand, buildTime.routes.home),
      footer: hydrateChromeBlocks(c.footer, brand, buildTime.routes.home),
    },
  };
}
```

- [ ] **Step 5: Keep the soon-to-move SiteNav compiling (one-line prop retype)**

`src/nav.tsx` still types its prop as `ResolvedPressConfig['nav']['header']`, which no longer exists. Task 8 moves this file; until then, keep the gate green:

In `packages/web/src/nav.tsx`, replace the import and the signature line:

```ts
import type { ResolvedNavLink } from './config/types';
```

```ts
export function SiteNav({ links }: { links: ResolvedNavLink[] }) {
```

In `packages/web/src/nav.test.ts`, replace the `ResolvedPressConfig` type import and the `NavLinks` alias with:

```ts
import type { ResolvedNavLink } from './config/types';
```

```ts
type NavLinks = ResolvedNavLink[];
```

- [ ] **Step 6: Run the suite + typecheck to verify green, commit**

Run: `pnpm --filter @ogs-tech/press-web test src/map-site-settings.test.ts src/get-site-config.test.ts src/config/build-metadata.test.ts src/config/build-theme-style.test.ts src/nav.test.ts && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS + exit 0.

```bash
git add packages/web/src/config/types.ts packages/web/src/map-site-settings.ts packages/web/src/map-site-settings.test.ts packages/web/src/get-site-config.ts packages/web/src/get-site-config.test.ts packages/web/src/config/build-metadata.test.ts packages/web/src/config/build-theme-style.test.ts packages/web/src/nav.tsx packages/web/src/nav.test.ts
git commit -m "feat(web)!: ResolvedPressConfig.chrome with hydrated chrome DZs replaces nav"
```

---

## Task 8: Web — `NavLinks` migration + `Navbar` renderer

**Files:**
- Create: `packages/web/src/chrome/nav-links.tsx` (from `src/nav.tsx`)
- Create: `packages/web/src/chrome/nav-links.test.ts` (from `src/nav.test.ts`)
- Create: `packages/web/src/chrome/navbar.tsx`
- Create: `packages/web/src/chrome/navbar.test.ts`
- Delete: `packages/web/src/nav.tsx`, `packages/web/src/nav.test.ts`
- Modify: `packages/web/src/index.ts` (only the `SiteNav` export line — swap to internal path removal; full export rework happens in Task 10)

**Interfaces:**
- Consumes: `ResolvedChromeNavbar`, `ResolvedNavLink` from Task 7.
- Produces: `NavLinks({ links: ResolvedNavLink[] })` — internal client component (NOT exported from the package index). `Navbar(props: ResolvedChromeNavbar)` — server component, exported in Task 10, renders `[data-block="chrome.navbar"]` with brand link (`[data-navbar="brand"]`), `NavLinks`, and CTA (`[data-navbar="cta"]` with `data-variant`). Task 10 registers it under `'chrome.navbar'`; Task 11 styles these selectors.

- [ ] **Step 1: Move SiteNav → NavLinks**

Create `packages/web/src/chrome/nav-links.tsx` with the full contents of `src/nav.tsx`, applying exactly these changes — import path, name, and doc comment:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import type { ResolvedNavLink } from '../config/types';

/**
 * NavLinks — the navbar's internal link list (Spec §3: the old SiteNav becomes
 * the internal nav of the navbar renderer). A client component ONLY because it
 * reads usePathname() to mark the active link; the data is already fully
 * resolved by mapSiteSettings, so this renders plain <a> links. Empty list →
 * renders nothing.
 *
 * - Active link: exact href === pathname → aria-current="page" (also the CSS hook).
 * - newTab (editor opt-in): target="_blank" + rel="noopener noreferrer".
 * - external (http(s) URL): trailing ↗ affordance, independent of newTab.
 */
export function NavLinks({ links }: { links: ResolvedNavLink[] }) {
  const pathname = usePathname();
  if (links.length === 0) return null;
  return (
    <nav data-press-nav="header" aria-label="Primary">
      {links.map((link, i) => {
        const active = link.href === pathname;
        return (
          <a
            key={`${link.href}-${i}`}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            target={link.newTab ? '_blank' : undefined}
            rel={link.newTab ? 'noopener noreferrer' : undefined}
          >
            {link.label}
            {link.external ? (
              <span aria-hidden="true" data-press-nav-ext>
                {' '}
                ↗
              </span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}
```

(The `data-press-nav="header"` attribute is kept verbatim so the existing `theme.css` link rules keep applying unchanged.)

- [ ] **Step 2: Move the tests**

Create `packages/web/src/chrome/nav-links.test.ts` with the full contents of `src/nav.test.ts`, applying exactly these changes:

- `import type { ResolvedNavLink } from '../config/types';` replaces the old types import; `type NavLinks = ResolvedNavLink[];` → rename the alias to `type Links = ResolvedNavLink[];` (the component now shares the old alias's name).
- `import { NavLinks } from './nav-links';` replaces `import { SiteNav } from './nav';`.
- `const render = (links: Links): string => renderToStaticMarkup(createElement(NavLinks, { links }));`
- `describe('NavLinks', …)` replaces `describe('SiteNav', …)`.
- Everything else (the `vi.hoisted` pathname holder, the `vi.mock('next/navigation', …)`, all test bodies) stays byte-identical.

Then delete the old files and drop the old export:

```bash
git rm packages/web/src/nav.tsx packages/web/src/nav.test.ts
```

In `packages/web/src/index.ts`, delete the line `export { SiteNav } from './nav';` (BREAKING — Spec §6; the chrome exports are added in Task 10).

- [ ] **Step 3: Run the migrated tests**

Run: `pnpm --filter @ogs-tech/press-web test src/chrome/nav-links.test.ts`
Expected: PASS (behavior unchanged, only renamed/moved).

- [ ] **Step 4: Write the failing Navbar tests**

Create `packages/web/src/chrome/navbar.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// NavLinks (rendered inside Navbar) reads usePathname — same holder pattern as
// nav-links.test.ts.
const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { Navbar } from './navbar';

const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(createElement(Navbar as any, { __component: 'chrome.navbar', id: 1, ...props }));

describe('Navbar renderer', () => {
  it('wraps output in a data-block="chrome.navbar" element', () => {
    expect(render({ brand: { name: 'Acme' }, links: [] })).toContain('data-block="chrome.navbar"');
  });

  it('renders the hydrated brand as a home link with logo + name (Spec §1: brand never stored on the block)', () => {
    const html = render({ brand: { name: 'Acme', logo: 'http://cms.test/logo.png' }, links: [] });
    expect(html).toMatch(/<a[^>]*data-navbar="brand"[^>]*href="\/"/);
    expect(html).toContain('src="http://cms.test/logo.png"');
    expect(html).toContain('Acme');
  });

  it('omits the logo img when the brand has none', () => {
    expect(render({ brand: { name: 'Acme' }, links: [] })).not.toContain('<img');
  });

  it('renders the resolved links through the internal NavLinks', () => {
    const html = render({
      brand: { name: 'Acme' },
      links: [{ label: 'About', href: '/about', external: false, newTab: false }],
    });
    expect(html).toContain('<nav');
    expect(html).toContain('href="/about"');
    expect(html).toContain('>About');
  });

  it('renders the CTA only when BOTH label and href are present (no dead links)', () => {
    const withCta = render({
      brand: { name: 'Acme' },
      links: [],
      cta: { label: 'Sign up', href: '/signup', variant: 'secondary' },
    });
    expect(withCta).toMatch(/<a[^>]*data-navbar="cta"[^>]*href="\/signup"/);
    expect(withCta).toContain('data-variant="secondary"');

    expect(render({ brand: { name: 'Acme' }, links: [], cta: { label: 'Sign up' } }))
      .not.toContain('data-navbar="cta"');
    expect(render({ brand: { name: 'Acme' }, links: [] })).not.toContain('data-navbar="cta"');
  });

  it('defaults the CTA variant to primary', () => {
    expect(render({ brand: { name: 'Acme' }, links: [], cta: { label: 'Go', href: '/go' } }))
      .toContain('data-variant="primary"');
  });

  it('tolerates an un-hydrated block (no brand/links) without crashing', () => {
    // Direct BlockRenderer use outside mapSiteSettings must degrade, not throw —
    // mirroring the tolerant admission principle.
    expect(() => render({})).not.toThrow();
    expect(render({})).toContain('data-block="chrome.navbar"');
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/chrome/navbar.test.ts`
Expected: FAIL — `./navbar` does not exist.

- [ ] **Step 6: Implement the Navbar renderer**

Create `packages/web/src/chrome/navbar.tsx`:

```tsx
import type { ResolvedChromeNavbar } from '../config/types';
import { NavLinks } from './nav-links';

/**
 * Chrome block `chrome.navbar` (Spec §1): brand + nav links + optional CTA in
 * one engine-owned bar — the internal layout is renderer-owned so editors cannot
 * break the chrome (Spec §Decisions 6). Receives HYDRATED props (Spec §3):
 * mapSiteSettings resolved the links and injected the brand from Site Settings
 * identity, so this stays a dumb server component; only NavLinks is a client
 * component (active-link aria-current). Tolerant of an un-hydrated block
 * (direct BlockRenderer use): missing brand/links degrade, never crash.
 */
export function Navbar({ brand, links, cta }: ResolvedChromeNavbar) {
  const hasCta = Boolean(cta?.label && cta?.href);
  return (
    <div data-block="chrome.navbar">
      <a href="/" data-navbar="brand">
        {brand?.logo ? <img src={brand.logo} alt="" /> : null}
        <span>{brand?.name}</span>
      </a>
      <NavLinks links={links ?? []} />
      {hasCta ? (
        <a data-navbar="cta" data-variant={cta?.variant ?? 'primary'} href={cta?.href}>
          {cta?.label}
        </a>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 7: Run the tests to verify they pass, typecheck, commit**

Run: `pnpm --filter @ogs-tech/press-web test src/chrome && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS + exit 0.

```bash
git add packages/web/src/chrome packages/web/src/index.ts
git commit -m "feat(web)!: Navbar chrome renderer; SiteNav becomes internal NavLinks"
```

---

## Task 9: Web — `Footer` renderer

**Files:**
- Create: `packages/web/src/chrome/footer.tsx`
- Test: `packages/web/src/chrome/footer.test.ts`

**Interfaces:**
- Consumes: `ResolvedChromeFooter` from Task 7.
- Produces: `Footer(props: ResolvedChromeFooter)` — renders `<small data-block="chrome.footer">` with `text`, falling back to `"<brand.name> · <currentYear>"` when text is empty (today's hardcoded behavior). Task 10 registers it under `'chrome.footer'`.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/chrome/footer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Footer } from './footer';

const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(Footer({ __component: 'chrome.footer', id: 1, ...(props as any) }));

describe('Footer renderer', () => {
  it('wraps output in a data-block="chrome.footer" element', () => {
    expect(render({ text: 'hi', brand: { name: 'Acme' } })).toContain('data-block="chrome.footer"');
  });

  it('renders the editor text verbatim when present', () => {
    expect(render({ text: '© Acme Corp — all rights reserved', brand: { name: 'Acme' } }))
      .toContain('© Acme Corp — all rights reserved');
  });

  it('falls back to "brand · currentYear" when text is empty (Spec §1: today\'s behavior)', () => {
    const year = String(new Date().getFullYear());
    const empty = render({ text: '', brand: { name: 'Acme' } });
    expect(empty).toContain('Acme');
    expect(empty).toContain(year);
    const absent = render({ brand: { name: 'Acme' } });
    expect(absent).toContain('Acme');
    expect(absent).toContain(year);
  });

  it('tolerates an un-hydrated block (no brand) without crashing', () => {
    expect(() => render({})).not.toThrow();
    expect(render({})).toContain(String(new Date().getFullYear()));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/chrome/footer.test.ts`
Expected: FAIL — `./footer` does not exist.

- [ ] **Step 3: Implement the Footer renderer**

Create `packages/web/src/chrome/footer.tsx`:

```tsx
import type { ResolvedChromeFooter } from '../config/types';

/**
 * Chrome block `chrome.footer` (Spec §1): a single copyright line. Empty `text`
 * falls back to "brand · currentYear" — exactly what the old hardcoded footer
 * rendered. The brand arrives via hydration (mapSiteSettings, Spec §3), never
 * stored on the block. Tolerant of an un-hydrated block: a missing brand
 * degrades to "· year", never a crash.
 */
export function Footer({ text, brand }: ResolvedChromeFooter) {
  return (
    <small data-block="chrome.footer">
      {text || `${brand?.name ?? ''} · ${new Date().getFullYear()}`}
    </small>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass, typecheck, commit**

Run: `pnpm --filter @ogs-tech/press-web test src/chrome/footer.test.ts && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS + exit 0.

```bash
git add packages/web/src/chrome/footer.tsx packages/web/src/chrome/footer.test.ts
git commit -m "feat(web): Footer chrome renderer with brand-year fallback"
```

---

## Task 10: Web — `chromeBlocks` registry, `BlockRenderer` merge, public exports

**Files:**
- Create: `packages/web/src/chrome-blocks.ts`
- Modify: `packages/web/src/block-renderer.tsx`
- Modify: `packages/web/src/index.ts`
- Test: `packages/web/src/block-renderer.test.tsx`

**Interfaces:**
- Consumes: `Navbar` (Task 8), `Footer` (Task 9).
- Produces: `chromeBlocks: Record<string, ComponentType<any>>` mapping `'chrome.navbar' → Navbar`, `'chrome.footer' → Footer`. `BlockRenderer` merge order becomes `{ ...referenceBlocks, ...sectionBlocks, ...chromeBlocks, ...components }` (adopter overrides `chrome.*` last — Spec §3). Package index exports `Navbar`, `Footer`, `chromeBlocks` and the types `ChromeBlock`, `ResolvedNavLink`, `ResolvedChromeNavbar`, `ResolvedChromeFooter`; `SiteNav` is gone (BREAKING). Task 11's `layout.tsx` relies on this merge.

- [ ] **Step 1: Write the failing renderer tests**

In `packages/web/src/block-renderer.test.tsx`:

**(a)** Add at the top of the file, after the existing imports (the navbar's internal `NavLinks` reads `usePathname`):

```tsx
import { vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
```

**(b)** Add a new describe:

```tsx
describe('BlockRenderer — chrome blocks', () => {
  it('resolves chrome.* blocks from the chromeBlocks registry', () => {
    const blocks = [
      { __component: 'chrome.navbar', id: 1, brand: { name: 'Acme' }, links: [] } as any,
      { __component: 'chrome.footer', id: 2, text: 'hello', brand: { name: 'Acme' } } as any,
    ];
    const out = renderToStaticMarkup(<BlockRenderer blocks={blocks} />);
    expect(out).toContain('data-block="chrome.navbar"');
    expect(out).toContain('data-block="chrome.footer"');
  });

  it('lets an adopter components map override a chrome renderer (adopter wins last, Spec §3)', () => {
    const blocks = [{ __component: 'chrome.navbar', id: 1, brand: { name: 'Acme' }, links: [] } as any];
    const MyNavbar = () => <div data-block="custom-navbar" />;
    const out = renderToStaticMarkup(
      <BlockRenderer blocks={blocks} components={{ 'chrome.navbar': MyNavbar }} />,
    );
    expect(out).toContain('data-block="custom-navbar"');
    expect(out).not.toContain('data-block="chrome.navbar"');
  });

  it('skips an unknown component in a chrome zone without crashing', () => {
    const blocks = [{ __component: 'chrome.does-not-exist', id: 1 } as any];
    expect(() => renderToStaticMarkup(<BlockRenderer blocks={blocks} />)).not.toThrow();
    expect(renderToStaticMarkup(<BlockRenderer blocks={blocks} />)).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/block-renderer.test.tsx`
Expected: FAIL — `chrome.navbar` renders nothing (not in the registry yet).

- [ ] **Step 3: Create the registry and merge it**

Create `packages/web/src/chrome-blocks.ts`:

```ts
import type { ComponentType } from 'react';
import { Navbar } from './chrome/navbar';
import { Footer } from './chrome/footer';

/**
 * Engine-owned CHROME registry (Spec §3). Kept SEPARATE from referenceBlocks and
 * sectionBlocks so the four-palette split (press.* atoms / section.* sections /
 * chrome.* chrome / custom.* adopter) is mirrored in code. BlockRenderer merges
 * this after sections and before the adopter map — `chrome.navbar` is overridable
 * exactly like `section.hero`.
 */
export const chromeBlocks: Record<string, ComponentType<any>> = {
  'chrome.navbar': Navbar,
  'chrome.footer': Footer,
};
```

In `packages/web/src/block-renderer.tsx`, add the import and update the merge (and its comment):

```ts
import { chromeBlocks } from './chrome-blocks';
```

```ts
  // Four-palette merge (Spec §3): press.* atoms, section.* sections, chrome.*
  // chrome, then the adopter's explicit components — adopter wins last for
  // per-key override.
  const registry = { ...referenceBlocks, ...sectionBlocks, ...chromeBlocks, ...components };
```

- [ ] **Step 4: Update the public exports**

In `packages/web/src/index.ts` (the `SiteNav` line was already removed in Task 8):

Add after the `export { sectionBlocks } …` line:

```ts
export { Navbar } from './chrome/navbar';
export { Footer } from './chrome/footer';
export { chromeBlocks } from './chrome-blocks';
```

Extend the config-types export line at the bottom to:

```ts
export type {
  PressConfig,
  ResolvedPressConfig,
  BuildTimeConfig,
  ThemeName,
  ChromeBlock,
  ResolvedNavLink,
  ResolvedChromeNavbar,
  ResolvedChromeFooter,
} from './config/types';
```

- [ ] **Step 5: Run the full web suite, typecheck, commit**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS + exit 0.

```bash
git add packages/web/src/chrome-blocks.ts packages/web/src/block-renderer.tsx packages/web/src/block-renderer.test.tsx packages/web/src/index.ts
git commit -m "feat(web): chromeBlocks registry joins the BlockRenderer merge; chrome public exports"
```

---

## Task 11: Web — chrome theme styles + host template layout

**Files:**
- Modify: `packages/web/theme.css`
- Modify: `packages/web/templates/host/app/layout.tsx`

There are no unit tests for CSS or the host template (templates are excluded from the web tsconfig and copied verbatim by materialization); Task 13 verifies this visually in the playground. Everything here must still keep `pnpm --filter @ogs-tech/press-web typecheck && pnpm --filter @ogs-tech/press-web test` green.

**Interfaces:**
- Consumes: `site.chrome.header` / `site.chrome.footer` (Task 7), `BlockRenderer` merge (Task 10), the `[data-block="chrome.navbar"]` / `[data-navbar="brand"|"cta"]` / `[data-block="chrome.footer"]` selectors (Tasks 8–9).
- Produces: the materialized host renders chrome through the block pipeline; `theme.css` styles it from `var(--press-*)` tokens only.

- [ ] **Step 1: Restyle the header chrome in `theme.css`**

In `packages/web/theme.css`, the "Page shell" section currently has `header { … }`, `header a { … }`, `header img { … }` rules. Keep the `header { … }` rule unchanged; **delete** the `header a { … }` and `header img { … }` rules (they targeted the old hardcoded brand anchor and would now leak onto every block rendered in the header) and insert in their place:

```css
/* Chrome navbar (chrome.navbar): brand + editable links + optional CTA in one
   engine-owned bar — internal layout is renderer-owned so editors cannot break
   the chrome (Spec §Decisions 6). */
[data-block="chrome.navbar"] {
  display: flex;
  align-items: center;
  gap: var(--press-space-3);
  flex: 1;
}
[data-block="chrome.navbar"] [data-navbar="brand"] {
  display: inline-flex;
  align-items: center;
  gap: var(--press-space-2);
  color: var(--press-color-ink);
  text-decoration: none;
  font-family: var(--press-font-display, var(--press-font-display-default)), system-ui, sans-serif;
  font-weight: 600;
}
[data-block="chrome.navbar"] [data-navbar="brand"] img {
  height: 28px;
  width: auto;
}
/* Navbar CTA: same token treatment as press.button (fill / outline). */
[data-block="chrome.navbar"] [data-navbar="cta"] {
  display: inline-flex;
  align-items: center;
  padding: var(--press-space-2) var(--press-space-4);
  border-radius: var(--press-radius-sm);
  font-weight: 600;
  text-decoration: none;
  line-height: 1;
}
[data-block="chrome.navbar"] [data-navbar="cta"][data-variant="primary"] {
  background: var(--press-color-primary);
  color: var(--press-color-on-primary);
}
[data-block="chrome.navbar"] [data-navbar="cta"][data-variant="secondary"] {
  background: transparent;
  color: var(--press-color-primary);
  border: 1px solid var(--press-color-border);
}
```

The existing `nav[data-press-nav="header"] …` rules stay byte-identical (NavLinks kept the attribute); `margin-left: auto` now pushes the links right *inside* the navbar flex row, with the CTA after them. In the `@media (max-width: 640px)` block, add alongside the existing rules:

```css
  [data-block="chrome.navbar"] {
    flex-wrap: wrap;
  }
```

Finally, update the comment above `nav[data-press-nav="header"]` from "rendered by SiteNav next to the brand link" to "rendered by the navbar's internal NavLinks next to the brand link".

- [ ] **Step 2: Style the footer chrome**

After the existing `footer { … }` rule in `theme.css`, add:

```css
/* Chrome footer (chrome.footer): the copyright line block. */
[data-block="chrome.footer"] {
  display: block;
}
```

(The `footer` element rules already carry color/size; the block only needs to fill the line.)

- [ ] **Step 3: Swap the hardcoded chrome in the host template**

Replace the contents of `packages/web/templates/host/app/layout.tsx` with:

```tsx
import { Archivo, Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import { BlockRenderer, buildMetadata, buildThemeStyle, getSiteConfig } from '@ogs-tech/press-web';
import '@ogs-tech/press-web/theme.css';
import { customBlocks } from '../press.blocks';
import { buildTime } from '../press-config';

// Default-theme fonts, loaded + optimized by next/font at build time. Each exposes
// a CSS variable consumed by theme.css with a fallback:
//   font-family: var(--press-font-body, var(--press-font-body-default))
// so a Site Settings font override (emitted by buildThemeStyle) wins, else the
// optimized default applies. Build-time families are still owned by press.config.
const display = Bricolage_Grotesque({ subsets: ['latin'], display: 'swap', variable: '--press-font-display-default' });
const body = Archivo({ subsets: ['latin'], display: 'swap', variable: '--press-font-body-default' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', variable: '--press-font-mono-default' });

const fontVars = `${display.variable} ${body.variable} ${mono.variable}`;

// Brand defaults, no page: title = seo.defaultTitle + favicon. Fetched at runtime
// from the CMS (ISR ~60s) so editor changes appear without a redeploy.
export async function generateMetadata() {
  return buildMetadata(await getSiteConfig(buildTime), null);
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteConfig(buildTime);
  return (
    <html lang={site.site.locale} data-theme={buildTime.theme.name} className={fontVars}>
      <head>
        {/* The single injection point for token values (CMS-sourced or DEFAULT_THEME). */}
        <style dangerouslySetInnerHTML={{ __html: buildThemeStyle(site) }} />
      </head>
      <body>
        {/* Block-composed chrome (Spec §3): the same pipeline as the page body,
            hydrated by mapSiteSettings. An unreachable CMS → empty zones →
            header/footer render nothing (unbranded over synthetic, Spec §4). */}
        <header>
          <BlockRenderer blocks={site.chrome.header} components={customBlocks} />
        </header>
        <main>{children}</main>
        <footer>
          <BlockRenderer blocks={site.chrome.footer} components={customBlocks} />
        </footer>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify the gate stays green and commit**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS + exit 0 (templates are outside the tsconfig; this catches accidental src/ regressions).

```bash
git add packages/web/theme.css packages/web/templates/host/app/layout.tsx
git commit -m "feat(web)!: host template renders block-composed chrome; token-only navbar/footer styles"
```

---

## Task 12: Changeset + CLAUDE.md

**Files:**
- Create: `.changeset/chrome-blocks.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing (docs/release metadata only).
- Produces: the release plan (`press-cms` major, `press-web` major, `press-shared` minor — Spec §6) and the updated living architecture reference.

- [ ] **Step 1: Write the changeset**

Create `.changeset/chrome-blocks.md`:

```md
---
'@ogs-tech/press-cms': major
'@ogs-tech/press-web': major
'@ogs-tech/press-shared': minor
---

feat!: block-composable site chrome (chrome.*)

The site header and footer become block-composed: the `site-setting` single type
gains two Dynamic Zones (`header`, `footer`) admitting a new engine-owned
`chrome.*` category (`chrome.navbar`, `chrome.footer`) plus `press.*`,
`section.*`, and adopter `custom.*` blocks. The serializer walks all three engine
DZs and follows nested component references; the generator types nested
components (without `__component`), skips relations, and emits
`HeaderBlocks`/`FooterBlocks` unions. `mapSiteSettings` hydrates the zones (brand
injection + nav resolution); `BlockRenderer` merges a new `chromeBlocks` registry
(adopter-overridable); the host layout renders both zones through the block
pipeline. `bootstrap()` seeds a default composition (navbar + footer) exactly
once. `press-shared`: `Attr` gains typed `component`/`repeatable` keys (additive).

BREAKING (press-cms): `site-setting.headerNav` is removed. Strapi drops its data
on schema sync — there is no automated migration. After upgrading, re-enter the
nav links once inside the seeded Navbar block (Site Settings → Header).

BREAKING (press-web): `SiteNav` is no longer exported (the navbar renders links
internally) and `ResolvedPressConfig.nav` is replaced by
`ResolvedPressConfig.chrome` (`{ header, footer }` hydrated block arrays).
Override the chrome like any block: `components={{ 'chrome.navbar': MyNavbar }}`.
```

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`:

**(a)** In the "Reference blocks + the custom-block extension point" section, update the custom-block bullet's DZ claim: replace `is auto-admitted into the page \`body\` Dynamic Zone` with `is auto-admitted into every engine Dynamic Zone — the page \`body\` and the site-setting \`header\`/\`footer\``.

**(b)** After the "Engine sections (`section.*`)" bullet, add:

```md
- **Engine chrome (`chrome.*`):** a third engine-owned palette for the site chrome
  (`chrome.navbar`, `chrome.footer`) — injected like `press.*` but admitted **only**
  into the `site-setting` `header`/`footer` Dynamic Zones (statically listed in its
  schema), never the page `body`. `chrome.navbar` nests `press.nav-item[]` + an
  optional `press.button` cta; brand (logo + name) is never stored on the block —
  `mapSiteSettings` hydrates it from Site Settings identity, plus the resolved nav
  links, before rendering. The serializer follows these nested component refs and
  the generator emits nested-only components without `__component` and adds
  `HeaderBlocks`/`FooterBlocks` unions. `bootstrap()` seeds `header: [navbar]`,
  `footer: [footer]` exactly once (plugin-store flag) — an editor-emptied zone is
  respected.
```

**(c)** Update the `BlockRenderer` merge bullet: replace the merge expression with `{ ...referenceBlocks, ...sectionBlocks, ...chromeBlocks, ...components }` and the override example list with `components={{ 'section.hero': MyHero, 'chrome.navbar': MyNavbar }}` — engine `chrome.*` chrome lives in `src/chrome-blocks.ts`.

**(d)** In the "Build-time anchors vs. runtime Site Settings" section, extend the Site Settings sentence: identity, SEO, theme values **and the block-composed `header`/`footer` chrome** live in the CMS single type.

- [ ] **Step 3: Commit**

```bash
git add .changeset/chrome-blocks.md CLAUDE.md
git commit -m "docs: changeset and architecture notes for chrome blocks"
```

---

## Task 13: Integration — full gate + playground verification

**Files:** none created; `apps/playground/packages/shared/types/generated.ts` gets regenerated by the running engine.

**Interfaces:**
- Consumes: everything above, exercised end-to-end through the dogfood playground.
- Produces: a verified working stack + the regenerated playground types committed.

- [ ] **Step 1: Run the whole quality gate**

Run: `pnpm -r --if-present typecheck && pnpm -r test && pnpm build`
Expected: all packages typecheck, all vitest suites pass, `strapi-plugin build` compiles cms cleanly.

- [ ] **Step 2: Boot the playground and verify the seed + wire contract**

Run: `pnpm play` (long-running: cms on `:1337`, web on `:3000` — use a background shell). Then, once ready:

1. `curl -s http://localhost:1337/api/press/schema | python3 -m json.tool` → contains `plugin::press-cms.site-setting` with `header`/`footer` DZs, and `chrome.navbar`, `chrome.footer`, `press.nav-item` in `components` (nav-item present although it is not a DZ member — nested-ref walking works live).
2. `curl -s http://localhost:1337/api/site-setting | python3 -m json.tool` → `data.header` is `[{ "__component": "chrome.navbar", … }]` and `data.footer` is `[{ "__component": "chrome.footer", … }]` (seed ran).
3. Open `http://localhost:3000` → the header shows the brand (or nothing if identity is empty) and the footer shows `<name> · <year>`; no crash with the seeded empty navbar.
4. In the admin (`:1337/admin`), Site Settings shows the **Header**/**Footer** zones (and no Header Navigation repeatable); add a nav item pointing at a page, save, reload `:3000` (ISR ~60s or restart) → the link renders and resolves to the page slug.

If any check fails, STOP and debug (superpowers:systematic-debugging) — do not paper over.

- [ ] **Step 3: Commit the regenerated playground types**

`press dev` re-synced `apps/playground/packages/shared/types/generated.ts` while booting. Verify it now contains `ChromeNavbar`, `PressNavItem` (without `__component`), `HeaderBlocks`, and `FooterBlocks`, then:

```bash
git add apps/playground/packages/shared/types/generated.ts
git commit -m "chore(playground): regenerate types with chrome blocks"
```

(If other playground files changed as a side effect of booting, leave them out — only the generated types belong to this feature.)

- [ ] **Step 4: Final verification before handoff**

Run: `git status` — the tree should be clean apart from pre-existing unrelated changes. Re-run `pnpm -r test` one last time. The feature is complete; hand off per superpowers:finishing-a-development-branch.

---

## Self-review notes (spec coverage)

- Spec §1 CMS data model → Tasks 1–2 (components, DZs, headerNav removal, static admissions, custom.* into three DZs).
- Spec §2 wire contract + type-sync → Tasks 3–4 (serializer nested refs + fail-fast; generator component refs, relation skip, nested-only without `__component`, `HeaderBlocks`/`FooterBlocks`; `PressSchema` additive change).
- Spec §3 web rendering → Tasks 7–11 (hydration in `mapSiteSettings`, dumb renderers, `chromeBlocks` merge + adopter override, `SiteNav` → internal `NavLinks`, unknown-component skip, layout swap).
- Spec §4 seed/migration/degradation → Task 6 (run-once seed; the `null` vs `[]` letter-of-spec adaptation is documented there and in File Structure), Task 7 (CMS failure → empty chrome), Task 12 (manual migration documented in the changeset).
- Spec §5 testing → each task carries its tests; Task 13 runs the full gate.
- Spec §6 versioning → Task 12 (major/major/minor changeset).
- Deliberate additions beyond the spec's letter: `buildChromeDzPopulate` deep populate (Task 5 — required for `items.page.slug` to reach the wire at all) and the seed's plugin-store flag (Task 6 — Strapi cannot represent the spec's `null` state).





