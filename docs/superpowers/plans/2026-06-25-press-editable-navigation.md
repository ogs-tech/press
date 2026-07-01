# Press — Editable Header Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CMS-editable header navigation menu — an ordered list of links (internal page relations or external URLs) — rendered by the host header with active-link highlighting, degrading to "logo only" on any failure.

**Architecture:** Navigation is **site chrome (Plane B)**: it rides the existing `site-setting` single type → `getSiteConfig` (ISR ~60s) → `mapSiteSettings` → `layout.tsx` path. It never touches the `PressSchema` type-sync loop (Plane A), the generator, `generated.ts`, or the adopter zone. The CMS gains a `press.nav-item` component (injected, like `press.seo`) plus a repeatable `headerNav` field; the web package gains a deep `populate`, a resolver, and a `SiteNav` client component.

**Tech Stack:** Strapi 5 plugin (`@ogs-tech/press-cms`), Next.js 15 / React 18 host template + engine (`@ogs-tech/press-web`), Vitest, TypeScript (strict), pnpm workspaces, changesets.

## Global Constraints

- **Additive only.** No change to `@ogs-tech/press-shared` (`PressSchema`), `packages/web/src/generator/*`, the adopter's `shared/types/generated.ts`, or any adopter-zone file. (Spec §2, §7, AC6)
- **Node 20.x + pnpm 10.x.** Run all `pnpm` commands from the repo root.
- **No new dependencies.** The explicit `populate` is a hand-encoded query string — no query-string library. (Spec §5.1)
- **No eslint exists.** The quality gate is `pnpm -r --if-present typecheck` + `pnpm -r test`. (CLAUDE.md)
- **Failure discipline (inherited, must be preserved):** CMS `null` / non-OK / network error / malformed body → `mapSiteSettings(buildTime, null)` → `nav.header === []` → header renders the logo only, never crashes. (Spec §2, AC5)
- **Engine packages ship TS source** (`web`/`shared` have echo-only `build`); only `cms` compiles via `strapi-plugin build`. Do not add bundling. (CLAUDE.md)
- **`.press/` and `templates/host/app/layout.tsx` are engine-owned**, regenerated on every `press dev`/`build`. Editing the *template* source (`packages/web/templates/host/...`) is correct; never hand-edit the materialized `.press/web/...`. (Spec §6.2)
- **Precedence rule (resolver):** within a nav item, `page` wins over `url`. An item with neither is **dropped**. (Spec §5.2)

---

## File Structure

New files:

- `packages/cms/server/src/components/nav-item.json` — the `press.nav-item` component schema (label / page relation / url / newTab).
- `packages/web/src/nav.tsx` — the `SiteNav` client component (the only renderer with `'use client'` in the engine).
- `packages/web/src/nav.test.ts` — unit tests for `SiteNav` (`.test.ts` to match the repo convention + the `vitest.config.ts` `src/**/*.test.ts` glob; uses `React.createElement` + `react-dom/server`, so no JSX-in-test → `.ts` is correct).
- `.changeset/press-editable-navigation.md` — minor bump for both engine packages.

Modified files:

- `packages/cms/server/src/lib/inject-components.ts` — +1 import, +1 `ENGINE_COMPONENTS` entry (Configuration group).
- `packages/cms/server/src/lib/inject-components.test.ts` — assert `press.nav-item` is injected and is **not** admitted into the page `body` Dynamic Zone.
- `packages/cms/server/src/content-types/site-setting/schema.json` — +`headerNav` attribute + `config.metadatas` entry.
- `packages/web/src/config/types.ts` — extend `SiteSettingsData` (CMS shape) + `ResolvedPressConfig` (`nav.header`).
- `packages/web/src/map-site-settings.ts` — resolve `headerNav` → `nav.header`.
- `packages/web/src/map-site-settings.test.ts` — resolver cases (Spec §9).
- `packages/web/src/get-site-config.ts` — explicit `populate` incl. `headerNav.page` (slug only).
- `packages/web/src/get-site-config.test.ts` — assert the populate query + end-to-end nav mapping.
- `packages/web/src/index.ts` — `export { SiteNav } from './nav';`.
- `packages/web/theme.css` — nav + active-link + minimal responsive styles.
- `packages/web/templates/host/app/layout.tsx` — render `<SiteNav links={site.nav.header} />` next to the brand link.

**Decisions that deviate from the spec (and why):**

1. **Test file is `nav.test.ts`, not `nav.test.tsx`** — the repo's `vitest.config.ts` only includes `src/**/*.test.ts` and every existing component test (`button.test.ts`, etc.) uses that extension with `react-dom/server`. Keeping `.ts` needs zero config change and matches convention. Tests construct the element via `React.createElement` (no JSX), so `.ts` is valid.
2. **Active link uses `aria-current="page"` as the sole hook** (accessibility + CSS selector `[aria-current="page"]`), not a separate `active` class. One attribute, no redundancy; the spec's intent ("`aria-current="page"` + active styling") is fully met.
3. **No dev-only "dropped item" warning** in `mapSiteSettings`. The spec says one *may* be emitted; the file's documented contract is "pure, same input → same output, no I/O", and we preserve that. Dropping is still covered by a unit test.

---

## Task 1: CMS — `press.nav-item` component + injection

**Files:**
- Create: `packages/cms/server/src/components/nav-item.json`
- Modify: `packages/cms/server/src/lib/inject-components.ts` (import after line 11; array entry after line 46)
- Test: `packages/cms/server/src/lib/inject-components.test.ts`

**Interfaces:**
- Consumes: the existing `injectComponents({ strapi })` and `admitCustomBlocks({ strapi })` exports; the test helpers `PAGE_UID`, `pageWithBody(components: string[])` already defined at module scope in the test file.
- Produces: component uid `press.nav-item` registered as `{ modelType: 'component', uid: 'press.nav-item', ... }`. Guarantee: it is **never** added to `plugin::press-cms.page` `body.components` (only `custom.*` is admitted).

- [ ] **Step 1: Write the failing tests**

In `packages/cms/server/src/lib/inject-components.test.ts`, add `'press.nav-item'` to the `expected` array inside the existing test `'registers every engine press.* component as a component model'` (in the `describe('injectComponents', ...)` block) so it reads:

```ts
    const expected = [
      'press.paragraph', 'press.heading', 'press.list', 'press.quote',
      'press.image', 'press.button', 'press.separator', 'press.spacer',
      'press.seo', 'press.theme-colors', 'press.theme-radius', 'press.nav-item',
    ];
```

Then append a new test to the **bottom** of the `describe('injectComponents', ...)` block (before its closing `});`):

```ts
  it('injects press.nav-item but never admits it into the page Dynamic Zone', () => {
    // nav-item is a Site-Settings config component (like press.seo). Injecting it
    // registers the component, but it must NOT leak into the page block palette —
    // only custom.* is admitted into the page body Dynamic Zone.
    const components = new Map<string, any>();
    const page = pageWithBody(['press.paragraph']);
    const contentTypes = new Map<string, any>([[PAGE_UID, page]]);
    const strapi = {
      get: (key: string) =>
        key === 'components' ? components : key === 'content-types' ? contentTypes : undefined,
      log: { warn() {}, info() {}, debug() {}, error() {} },
    } as any;

    injectComponents({ strapi });
    components.set('custom.callout', { uid: 'custom.callout' }); // a real custom block
    admitCustomBlocks({ strapi });

    expect(components.get('press.nav-item')?.modelType).toBe('component'); // injected
    expect(page.attributes.body.components).toContain('custom.callout');   // custom admitted
    expect(page.attributes.body.components).not.toContain('press.nav-item'); // never admitted
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts`
Expected: FAIL — `'registers every engine press.* component'` fails because `components.get('press.nav-item')` is `undefined` (`modelType` read on undefined), and the new test fails on the same `modelType` assertion.

- [ ] **Step 3: Create the component schema**

Create `packages/cms/server/src/components/nav-item.json`:

```json
{
  "collectionName": "components_press_nav_items",
  "info": {
    "displayName": "Nav Item",
    "description": "A single navigation entry: an internal page link or an external URL"
  },
  "options": {},
  "attributes": {
    "label": { "type": "string", "required": true },
    "page": { "type": "relation", "relation": "oneWay", "target": "plugin::press-cms.page" },
    "url": { "type": "string" },
    "newTab": { "type": "boolean", "default": false }
  },
  "config": {
    "metadatas": {
      "label": { "edit": { "label": "Label" } },
      "page": { "edit": { "label": "Page", "description": "Internal page link (resolves to its slug; survives renames). Takes precedence over URL." } },
      "url": { "edit": { "label": "URL", "description": "External URL, anchor, or mailto: (used only when no Page is set)." } },
      "newTab": { "edit": { "label": "Open in new tab" } }
    }
  }
}
```

- [ ] **Step 4: Register the component in `inject-components.ts`**

Add the import immediately after line 11 (`import themeRadiusSchema from '../components/theme-radius.json';`):

```ts
import navItemSchema from '../components/nav-item.json';
```

Add the entry to `ENGINE_COMPONENTS` immediately after the `theme-radius` line (line 46), inside the "Configuration components" group:

```ts
  { category: 'press', name: 'nav-item', schema: navItemSchema as Record<string, unknown> },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts`
Expected: PASS (all tests in the file green).

- [ ] **Step 6: Typecheck the CMS backend**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS (no `tsc` errors; the JSON import resolves under `resolveJsonModule`).

- [ ] **Step 7: Commit**

```bash
git add packages/cms/server/src/components/nav-item.json packages/cms/server/src/lib/inject-components.ts packages/cms/server/src/lib/inject-components.test.ts
git commit -m "feat(cms): inject press.nav-item component (Site Settings config block)"
```

---

## Task 2: CMS — `headerNav` field on Site Settings + relation de-risk spike

> **This task contains the primary-risk spike (Spec §8). Do it before any web work.** It is the only place the novel stack — a `relation` inside an *injected* component, targeting a *plugin* content-type, deep-populated through a *single type* — is exercised against a real running CMS.

**Files:**
- Modify: `packages/cms/server/src/content-types/site-setting/schema.json` (attributes + `config.metadatas`)

**Interfaces:**
- Consumes: the `press.nav-item` component from Task 1.
- Produces: a repeatable `headerNav` component field on `plugin::press-cms.page`'s sibling single type `site-setting`, populated at runtime via `headerNav.page` (slug).

- [ ] **Step 1: Add the `headerNav` attribute**

In `packages/cms/server/src/content-types/site-setting/schema.json`, add `headerNav` as the last entry of `attributes` (after `themeRadius`). The block becomes:

```json
    "themeColors": { "type": "component", "repeatable": false, "component": "press.theme-colors" },
    "themeRadius": { "type": "component", "repeatable": false, "component": "press.theme-radius" },
    "headerNav": { "type": "component", "repeatable": true, "component": "press.nav-item" }
```

- [ ] **Step 2: Add the matching metadata**

In the same file, add `headerNav` as the last entry of `config.metadatas` (after `themeRadius`):

```json
      "themeColors": { "edit": { "label": "Theme Colors" } },
      "themeRadius": { "edit": { "label": "Theme Radius" } },
      "headerNav": { "edit": { "label": "Header Navigation" } }
```

- [ ] **Step 3: Confirm the JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/cms/server/src/content-types/site-setting/schema.json','utf8')); console.log('site-setting schema.json OK')"`
Expected: `site-setting schema.json OK`

- [ ] **Step 4: Typecheck the CMS backend**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS.

- [ ] **Step 5: SPIKE — boot the playground CMS and confirm clean start + DB join table**

Run (foreground; watch the boot logs):

```bash
pnpm play
```

Expected:
- The CMS boots cleanly to `http://localhost:1337/admin` (no schema/registration error for `press.nav-item` or `headerNav`).
- A relation join table for the `headerNav` `page` relation is created. Confirm in the boot logs (Strapi logs migrations/table creation) or by inspecting the dev DB. The playground uses SQLite by default — verify with:

```bash
# In a second terminal, from the repo root. Adjust the .db path if the playground differs.
find apps/playground -name "*.db" -not -path "*/node_modules/*"
# then, against the found file (example path shown):
sqlite3 apps/playground/packages/cms/.tmp/data.db ".tables" | tr ' ' '\n' | grep -i nav
```

Expected: at least one table whose name references the nav-item component / its `page` relation link (e.g. `components_press_nav_items` and a `*_page_lnk` / `*_links` join table).

- [ ] **Step 6: SPIKE — add a header item in the admin (manual)**

In the admin (`http://localhost:1337/admin`):
1. Ensure at least one **published** page exists (create one with a known slug, e.g. `about`, if needed).
2. Open **Site Settings** → **Header Navigation** → add one item: set **Label** = `About`, set **Page** = the `about` page, leave **URL** empty. Save.

- [ ] **Step 7: SPIKE — confirm the relation crosses the REST contract with explicit populate**

Run:

```bash
curl -s "http://localhost:1337/api/site-setting?populate%5BheaderNav%5D%5Bpopulate%5D%5Bpage%5D%5Bfields%5D%5B0%5D=slug" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.stringify(JSON.parse(s).data?.headerNav,null,2)))"
```

Expected: the printed `headerNav` array contains your item with a nested `page` carrying `slug: "about"` (the exact JSON shape may be flattened Strapi 5 — the key assertion is **`headerNav[].page.slug` is present**, not null/absent).

- [ ] **Step 8: De-risk decision gate**

- **PASS** (the join table exists and `headerNav[].page.slug` comes through): proceed to Task 3. Stop the playground (`Ctrl-C`).
- **FAIL** (relation-in-injected-component misbehaves — boot error, no join table, or `page` never populates): apply the **fallback** — edit `nav-item.json` to remove the `page` relation (keep `label`, `url`, `newTab`), and in Task 4's resolver drop the `page` branch (url-only link model). Everything else in this plan (the `headerNav` field, `SiteNav`, layout, styles, the non-`page` tests) stays unchanged. Note the fallback in the commit message and the changeset.

- [ ] **Step 9: Commit**

```bash
git add packages/cms/server/src/content-types/site-setting/schema.json
git commit -m "feat(cms): add repeatable headerNav field to Site Settings (press.nav-item)"
```

---

## Task 3: Web — extend `SiteSettingsData` + `ResolvedPressConfig` types

**Files:**
- Modify: `packages/web/src/config/types.ts` (extend `SiteSettingsData` after line 124 `themeRadius`; extend `ResolvedPressConfig` after the `theme` block, before its closing `}` at line 87)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `SiteSettingsData.headerNav?: Array<{ label?: string; page?: { slug?: string } | null; url?: string; newTab?: boolean }> | null` — the raw CMS shape.
  - `ResolvedPressConfig.nav: { header: Array<{ label: string; href: string; external: boolean; newTab: boolean }> }` — the resolved shape consumed by `SiteNav` and the host layout.

> This task has no standalone unit test; its deliverable is verified by `tsc` here and exercised by Tasks 4–6. It is split out because the type additions are the shared contract those tasks reference.

- [ ] **Step 1: Extend `ResolvedPressConfig` with `nav`**

In `packages/web/src/config/types.ts`, inside `interface ResolvedPressConfig`, add a `nav` member immediately after the `theme: { ... }` block (i.e., as the last member before the interface's closing `}`):

```ts
  /**
   * Site chrome navigation (site-settings, Plane B). Resolved from the CMS
   * `headerNav` component list: each item is a final link — internal page slugs
   * already collapsed to an href ('/' for the home slug), external flag set from
   * the URL scheme. Empty when the CMS is empty/unreachable/malformed.
   */
  nav: {
    header: Array<{ label: string; href: string; external: boolean; newTab: boolean }>;
  };
```

- [ ] **Step 2: Extend `SiteSettingsData` with `headerNav`**

In the same file, inside `interface SiteSettingsData`, add `headerNav` as the last member (after `themeRadius`):

```ts
  headerNav?: Array<{
    label?: string;
    page?: { slug?: string } | null;
    url?: string;
    newTab?: boolean;
  }> | null;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`
Expected: FAIL — `mapSiteSettings` (in `map-site-settings.ts`) no longer returns a complete `ResolvedPressConfig` because the new required `nav` member is missing. This expected failure confirms the type is wired; Task 4 fixes it.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/config/types.ts
git commit -m "feat(web): add nav.header to ResolvedPressConfig + headerNav to SiteSettingsData"
```

---

## Task 4: Web — resolve `headerNav` → `nav.header` in `mapSiteSettings`

**Files:**
- Modify: `packages/web/src/map-site-settings.ts` (add a resolver helper; add `nav` to the returned object)
- Test: `packages/web/src/map-site-settings.test.ts`

**Interfaces:**
- Consumes: `SiteSettingsData.headerNav`, `ResolvedPressConfig.nav` (Task 3); `buildTime.routes.home` for the home-slug collapse.
- Produces: `mapSiteSettings(buildTime, cms).nav.header` — resolved links, page-over-url precedence, items with neither dropped.

- [ ] **Step 1: Write the failing tests**

In `packages/web/src/map-site-settings.test.ts`, add to the existing `'maps a null CMS ...'` test (after its last assertion, before the closing `});`):

```ts
    // navigation: empty when the CMS is empty (AC5)
    expect(r.nav.header).toEqual([]);
```

Then add a new `describe` block at the bottom of the file (after the final `});` of the existing top-level `describe`):

```ts
describe('mapSiteSettings — headerNav resolution', () => {
  it('resolves an internal page to /slug, external false', () => {
    const r = mapSiteSettings(buildTime, {
      headerNav: [{ label: 'About', page: { slug: 'about' }, newTab: false }],
    });
    expect(r.nav.header).toEqual([
      { label: 'About', href: '/about', external: false, newTab: false },
    ]);
  });

  it('collapses the home slug to /', () => {
    const r = mapSiteSettings(buildTime, {
      headerNav: [{ label: 'Home', page: { slug: 'home' } }], // buildTime.routes.home === 'home'
    });
    expect(r.nav.header[0].href).toBe('/');
    expect(r.nav.header[0].external).toBe(false);
  });

  it('resolves an external url with external:true and honors newTab', () => {
    const r = mapSiteSettings(buildTime, {
      headerNav: [{ label: 'Docs', url: 'https://docs.test', newTab: true }],
    });
    expect(r.nav.header).toEqual([
      { label: 'Docs', href: 'https://docs.test', external: true, newTab: true },
    ]);
  });

  it('treats a non-http url as internal-style (external:false)', () => {
    const r = mapSiteSettings(buildTime, {
      headerNav: [{ label: 'Contact', url: '/contact' }],
    });
    expect(r.nav.header[0]).toEqual({ label: 'Contact', href: '/contact', external: false, newTab: false });
  });

  it('lets page win over url when both are set (precedence)', () => {
    const r = mapSiteSettings(buildTime, {
      headerNav: [{ label: 'Both', page: { slug: 'about' }, url: 'https://ignored.test' }],
    });
    expect(r.nav.header[0]).toEqual({ label: 'Both', href: '/about', external: false, newTab: false });
  });

  it('drops an item with neither page nor url', () => {
    const r = mapSiteSettings(buildTime, {
      headerNav: [
        { label: 'Keep', url: '/keep' },
        { label: 'Drop' }, // neither page nor url
        { label: 'DropToo', page: null, url: '' },
      ],
    });
    expect(r.nav.header.map((l) => l.label)).toEqual(['Keep']);
  });

  it('maps absent / empty headerNav to []', () => {
    expect(mapSiteSettings(buildTime, { headerNav: [] }).nav.header).toEqual([]);
    expect(mapSiteSettings(buildTime, {}).nav.header).toEqual([]);
    expect(mapSiteSettings(buildTime, null).nav.header).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/map-site-settings.test.ts`
Expected: FAIL — `r.nav` is `undefined` (the resolver does not exist yet), so every `r.nav.header` assertion throws.

- [ ] **Step 3: Implement the resolver**

In `packages/web/src/map-site-settings.ts`, add this helper just below the existing `mediaUrl` function (after line 12):

```ts
type RawNavItem = NonNullable<SiteSettingsData['headerNav']>[number];
type ResolvedNavLink = ResolvedPressConfig['nav']['header'][number];

/**
 * Resolves a CMS nav item into a final link (site-settings spec §5.2).
 * Precedence: `page` wins over `url`. An internal page collapses to '/' when its
 * slug is the home slug (reusing the same routes.home anchor as the /home → /
 * redirect — CMS-independent). An item with neither page nor url is dropped
 * (returns null). The external flag is true only for http(s) URLs.
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
```

Then add `nav` to the object returned by `mapSiteSettings` — insert it as the last property, immediately after the `theme: { ... }` block (after line 54 `}` of the theme object, before the closing `};` of the return):

```ts
    nav: {
      header: (c.headerNav ?? [])
        .map((item) => resolveNavItem(item, buildTime.routes.home))
        .filter((link): link is ResolvedNavLink => link !== null),
    },
```

(`c` is already `cms ?? {}`, so a `null` CMS yields `[]`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/map-site-settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck (now complete)**

Run: `pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS — `mapSiteSettings` now returns a complete `ResolvedPressConfig` (the Task 3 failure is resolved).

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/map-site-settings.ts packages/web/src/map-site-settings.test.ts
git commit -m "feat(web): resolve headerNav into nav.header (page-over-url, home→/)"
```

---

## Task 5: Web — deep `populate` incl. `headerNav.page` in `getSiteConfig`

**Files:**
- Modify: `packages/web/src/get-site-config.ts` (replace `populate=*` with an explicit query)
- Test: `packages/web/src/get-site-config.test.ts`

**Interfaces:**
- Consumes: `mapSiteSettings` (Task 4), `SiteSettingsData` (Task 3).
- Produces: a `GET /api/site-setting?<explicit populate>` request whose query deep-populates `headerNav.page` selecting only `slug`. Return shape unchanged (`ResolvedPressConfig`).

- [ ] **Step 1: Update the existing populate assertion + add new tests**

In `packages/web/src/get-site-config.test.ts`, change the assertion inside `'passes the ISR revalidate option ...'` from:

```ts
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/api/site-setting?populate=*'),
      { next: { revalidate: 60 } },
    );
```

to:

```ts
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/api/site-setting?'),
      { next: { revalidate: 60 } },
    );
```

Then add two new tests inside the `describe('getSiteConfig', ...)` block (before its closing `});`):

```ts
  it('deep-populates headerNav.page (slug) in the query', async () => {
    const mock = stubFetch(async () => ({ ok: true, json: async () => ({ data: null }) }));
    await getSiteConfig(buildTime);
    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain('populate[headerNav][populate][page][fields][0]=slug');
  });

  it('maps a body with nav data end-to-end', async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => ({
        data: {
          name: 'Acme',
          headerNav: [
            { label: 'About', page: { slug: 'about' }, newTab: false },
            { label: 'Docs', url: 'https://docs.test', newTab: true },
          ],
        },
      }),
    }));
    const r = await getSiteConfig(buildTime);
    expect(r.nav.header).toEqual([
      { label: 'About', href: '/about', external: false, newTab: false },
      { label: 'Docs', href: 'https://docs.test', external: true, newTab: true },
    ]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/get-site-config.test.ts`
Expected: FAIL — the new `'deep-populates ...'` test fails because the current URL is `?populate=*` (no `headerNav` key). (The `'maps a body with nav data'` test already passes via Task 4's resolver, but the populate test is the gate.)

- [ ] **Step 3: Implement the explicit populate**

In `packages/web/src/get-site-config.ts`, add the populate constant just below the `CMS_URL` line (after line 4):

```ts
// Explicit Strapi 5 REST populate. `populate=*` reaches only one level — it would
// bring headerNav's scalars (label/url/newTab) but NOT the nested `page` relation.
// Hand-encode the exact tree (no query-string dep, spec §5.1): media + config
// components + headerNav → page (slug only).
const SITE_SETTING_POPULATE = [
  'populate[logo]=true',
  'populate[favicon]=true',
  'populate[seo][populate][image]=true',
  'populate[themeColors]=true',
  'populate[themeRadius]=true',
  'populate[headerNav][populate][page][fields][0]=slug',
].join('&');
```

Replace the fetch URL inside `getSiteConfig` (the line `const res = await fetch(\`${CMS_URL}/api/site-setting?populate=*\`, init);`) with:

```ts
    const res = await fetch(`${CMS_URL}/api/site-setting?${SITE_SETTING_POPULATE}`, init);
```

Also update the doc comment on `SiteSettingsData` in `packages/web/src/config/types.ts` (line ~109) that says `populate=*` so it no longer claims one-level population — change "Strapi 5 flattened, populate=*" to "Strapi 5 flattened, explicit populate (see get-site-config)". (Keep it a one-line edit; this avoids a stale comment.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/get-site-config.test.ts`
Expected: PASS (all tests, including the unchanged failure-discipline cases).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/get-site-config.ts packages/web/src/get-site-config.test.ts packages/web/src/config/types.ts
git commit -m "feat(web): deep-populate headerNav.page in getSiteConfig"
```

---

## Task 6: Web — `SiteNav` client component + export

**Files:**
- Create: `packages/web/src/nav.tsx`
- Create: `packages/web/src/nav.test.ts`
- Modify: `packages/web/src/index.ts` (add the export)

**Interfaces:**
- Consumes: `ResolvedPressConfig['nav']['header']` (Task 3); `usePathname` from `next/navigation`.
- Produces: `SiteNav({ links })` — a `'use client'` `<nav>` component. Exported from `@ogs-tech/press-web` as `SiteNav`. Active link (exact `href === pathname`) gets `aria-current="page"`. `newTab` → `target="_blank"` + `rel="noopener noreferrer"`. `external` → trailing `↗` affordance. Empty `links` → renders nothing.

- [ ] **Step 1: Write the failing tests**

Create `packages/web/src/nav.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ResolvedPressConfig } from './config/types';

// usePathname is controlled per test via a hoisted holder (vitest hoists vi.mock
// above imports; vi.hoisted makes the holder safe to reference inside the factory).
const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { SiteNav } from './nav';

type NavLinks = ResolvedPressConfig['nav']['header'];

const render = (links: NavLinks): string =>
  renderToStaticMarkup(createElement(SiteNav, { links }));

describe('SiteNav', () => {
  it('renders an anchor per link with label and href', () => {
    const html = render([
      { label: 'About', href: '/about', external: false, newTab: false },
      { label: 'Home', href: '/', external: false, newTab: false },
    ]);
    expect(html).toContain('<nav');
    expect(html).toContain('href="/about"');
    expect(html).toContain('>About');
    expect(html).toContain('href="/"');
  });

  it('marks the active link with aria-current="page" (exact match)', () => {
    nav.pathname = '/about';
    const html = render([
      { label: 'About', href: '/about', external: false, newTab: false },
      { label: 'Docs', href: '/docs', external: false, newTab: false },
    ]);
    // the About anchor is active …
    expect(html).toMatch(/<a[^>]*href="\/about"[^>]*aria-current="page"/);
    // … and the Docs anchor is not
    expect(html).not.toMatch(/<a[^>]*href="\/docs"[^>]*aria-current="page"/);
    nav.pathname = '/'; // reset for other tests
  });

  it('matches home (/) exactly', () => {
    nav.pathname = '/';
    const html = render([{ label: 'Home', href: '/', external: false, newTab: false }]);
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*aria-current="page"/);
  });

  it('newTab links get target=_blank and rel=noopener noreferrer', () => {
    const html = render([{ label: 'Docs', href: 'https://docs.test', external: true, newTab: true }]);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('non-newTab links carry neither target nor rel', () => {
    const html = render([{ label: 'About', href: '/about', external: false, newTab: false }]);
    expect(html).not.toContain('target=');
    expect(html).not.toContain('rel=');
  });

  it('external links show the ↗ affordance independent of newTab', () => {
    const html = render([{ label: 'Site', href: 'https://x.test', external: true, newTab: false }]);
    expect(html).toContain('↗');
    expect(html).not.toContain('target='); // external but newTab=false → no _blank
  });

  it('renders nothing for an empty link list', () => {
    expect(render([])).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/nav.test.ts`
Expected: FAIL — `Cannot find module './nav'` (the component does not exist yet).

- [ ] **Step 3: Implement `SiteNav`**

Create `packages/web/src/nav.tsx`:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import type { ResolvedPressConfig } from './config/types';

/**
 * SiteNav — the editable header navigation (site chrome, Plane B). A client
 * component only because it reads usePathname() to mark the active link; the data
 * is already fully resolved by mapSiteSettings, so this renders plain <a> links
 * (matching the brand link in the host header). Empty list → renders nothing, so
 * a missing/unreachable CMS leaves the header showing just the logo (AC5).
 *
 * - Active link: exact href === pathname → aria-current="page" (also the CSS hook).
 * - newTab (editor opt-in): target="_blank" + rel="noopener noreferrer".
 * - external (http(s) URL): trailing ↗ affordance, independent of newTab.
 */
export function SiteNav({ links }: { links: ResolvedPressConfig['nav']['header'] }) {
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

- [ ] **Step 4: Export `SiteNav` from the package entry**

In `packages/web/src/index.ts`, add after the `Spacer` export (line 13):

```ts
export { SiteNav } from './nav';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/nav.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/nav.tsx packages/web/src/nav.test.ts packages/web/src/index.ts
git commit -m "feat(web): add SiteNav client component + export"
```

---

## Task 7: Host template + nav styles

**Files:**
- Modify: `packages/web/templates/host/app/layout.tsx` (import + render `<SiteNav>`)
- Modify: `packages/web/theme.css` (nav + active + responsive styles)

**Interfaces:**
- Consumes: `SiteNav` (Task 6), `site.nav.header` from `getSiteConfig` (already fetched in the layout).
- Produces: the rendered header menu. No unit test (engine-owned template + CSS); verified by typecheck of the package boundary (SiteNav is exported), a `next build` of the materialized host, and a visual check via `pnpm play`.

- [ ] **Step 1: Render `<SiteNav>` in the host header**

In `packages/web/templates/host/app/layout.tsx`, update the import on line 2 to include `SiteNav`:

```tsx
import { buildMetadata, buildThemeStyle, getSiteConfig, SiteNav } from '@ogs-tech/press-web';
```

Replace the `<header>` block (lines 32–37) with:

```tsx
        <header>
          <a href="/">
            {site.brand.logo ? <img src={site.brand.logo} alt="" /> : null}
            <span>{site.brand.name}</span>
          </a>
          <SiteNav links={site.nav.header} />
        </header>
```

- [ ] **Step 2: Add nav styles to `theme.css`**

In `packages/web/theme.css`, append after the page-shell `header` rules (after line 61, the `header img { ... }` block) the following block:

```css
/* Header navigation (site chrome): editable menu rendered by SiteNav next to the
   brand link. Pushed to the right of the logo; wraps gracefully on narrow
   viewports (a JS hamburger is out of scope). Active link uses aria-current. */
nav[data-press-nav="header"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--press-space-4);
  margin-left: auto;
}
nav[data-press-nav="header"] a {
  display: inline-flex;
  align-items: center;
  gap: var(--press-space-1);
  color: var(--press-color-ink);
  text-decoration: none;
  font-weight: 500;
}
nav[data-press-nav="header"] a:hover {
  color: var(--press-color-primary);
}
nav[data-press-nav="header"] a[aria-current="page"] {
  color: var(--press-color-primary);
  font-weight: 600;
}
nav[data-press-nav="header"] [data-press-nav-ext] {
  font-size: 0.85em;
  opacity: 0.7;
}

@media (max-width: 640px) {
  header {
    flex-wrap: wrap;
  }
  nav[data-press-nav="header"] {
    margin-left: 0;
    width: 100%;
    gap: var(--press-space-3);
  }
}
```

> Token note: `--press-space-1`…`--press-space-9` are all emitted (`default-theme.ts` `space: ['4px','8px','12px','16px','24px','32px','48px','64px','96px']`, index 0 → `--press-space-1`), so every `var(--press-space-N)` above is valid as written.

- [ ] **Step 3: Typecheck the web package (boundary check)**

Run: `pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS. (The template itself is excluded from this tsconfig; this confirms the `SiteNav` export the template imports is intact.)

- [ ] **Step 4: Visual verification in the playground**

Run: `pnpm play`
Then in the browser at `http://localhost:3000`:
- The header shows the brand link **and** the nav items you added in Task 2's spike.
- Navigating to the page matching a nav item highlights that item (active styling).
- An external item with `newTab` opens in a new tab and shows the `↗` affordance.
- Temporarily empty the Header Navigation in Site Settings (or stop the CMS) and confirm the header falls back to the logo only — no crash (AC5).

Stop the playground (`Ctrl-C`) when done.

- [ ] **Step 5: Commit**

```bash
git add packages/web/templates/host/app/layout.tsx packages/web/theme.css
git commit -m "feat(web): render SiteNav in host header + nav styles"
```

---

## Task 8: Changeset + full quality gate

**Files:**
- Create: `.changeset/press-editable-navigation.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a minor-bump changeset for both engine packages and a green full quality gate.

- [ ] **Step 1: Write the changeset**

Create `.changeset/press-editable-navigation.md`:

```md
---
'@ogs-tech/press-cms': minor
'@ogs-tech/press-web': minor
---

feat: editable header navigation

CMS gains the `press.nav-item` component (injected, Site-Settings-only) and a
repeatable `headerNav` field on the Site Settings single type. Web deep-populates
`headerNav.page` (slug only), resolves each item into a final link (page wins over
url; the home slug collapses to `/`; items with neither are dropped), and ships a
`SiteNav` client component rendered in the host header with active-link
highlighting. Additive only — no PressSchema/generator/generated.ts/adopter-zone
change. Empty/unreachable/malformed CMS → header renders the logo only.
```

> If Task 2's de-risk gate forced the url-only fallback, append a sentence to the changeset noting the `page` relation was deferred.

- [ ] **Step 2: Run the full test suite**

Run: `pnpm -r test`
Expected: PASS across `cli`, `web`, `cms` (no regressions; the new nav, map, and inject tests are green).

- [ ] **Step 3: Run the full typecheck**

Run: `pnpm -r --if-present typecheck`
Expected: PASS for every package. Also run the CMS backend typecheck explicitly: `pnpm --filter @ogs-tech/press-cms test:ts:back` → PASS.

- [ ] **Step 4: Commit**

```bash
git add .changeset/press-editable-navigation.md
git commit -m "chore: changeset for editable header navigation"
```

---

## Acceptance Criteria Verification

Map each spec §10 criterion to its proof:

1. **Editor can add/reorder/remove header nav items, each → page or URL** — Task 2 (field + spike, manual admin verification).
2. **Header renders the menu in order; current page marked active** — Task 6 (`aria-current` test) + Task 7 (visual).
3. **Internal links resolve from slug, survive renames; home → `/`** — Task 4 (`/about`, home-slug `/`, precedence tests); slug-survival is structural (relation, not stored slug — confirmed by the spike).
4. **External links open per `newTab` + carry `rel="noopener noreferrer"`** — Task 6 (newTab test).
5. **Empty / CMS down / malformed → logo only, no crash** — Task 4 (`nav.header === []` cases) + Task 5 (failure-discipline tests unchanged) + Task 7 (visual fallback).
6. **No PressSchema/generator/generated.ts/adopter change** — Global Constraints; no task touches those paths (verify with `git diff --name-only` before the final commit — only the files in this plan should appear, plus the pre-existing unrelated `M README.md` / `M generated.ts` already dirty at session start, which are **not** part of this work and should be left untouched / committed separately).
7. **`pnpm -r test` + `pnpm -r --if-present typecheck` pass** — Task 8.

---

## Self-Review Notes

- **Spec coverage:** §4.1 (nav-item.json) → Task 1; §4.2 (inject) → Task 1; §4.3 (headerNav field) → Task 2; §5.1 (populate) → Task 5; §5.2 (resolver) → Task 4; §5.3 (types) → Task 3; §6.1 (SiteNav) → Task 6; §6.2 (layout) → Task 7; §6.3 (styles) → Task 7; §8 (spike) → Task 2; §9 (tests) → Tasks 1/4/5/6; §10 (AC) → verification section above. No gaps.
- **Type consistency:** `nav.header` item shape `{ label: string; href: string; external: boolean; newTab: boolean }` is identical in `types.ts` (Task 3), the resolver return (Task 4), the `getSiteConfig` end-to-end test (Task 5), and `SiteNav` props (Task 6). `resolveNavItem(item, homeSlug)` signature is used only inside `map-site-settings.ts`. `SITE_SETTING_POPULATE` is referenced only in `get-site-config.ts`.
- **Deviations from spec are listed under File Structure** (test extension `.ts`, `aria-current` as sole hook, no dev warning) with rationale — all preserve spec intent.
