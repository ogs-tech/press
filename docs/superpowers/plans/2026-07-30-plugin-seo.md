# Plugin/SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ship head metadata (ranking + social share) as the engine's second real `PressPlugin` — opt-in, enabled by default, following the CMS-component → mapper → `ResolvedPressConfig.plugins` structure the Base/Plugin framework proved with the `example` plugin, but integrating through a pure metadata builder feeding `generateMetadata()` instead of a mounted component.

**Architecture:** Three new CMS components (`preset-config.seo` + nested `preset-config.seo-social` on Site Settings, `preset-config.seo-page` on `page`) feed two pure web-side builders — `buildSeoMetadata` (replaces `buildMetadata`, drives Next's `generateMetadata()`) and `buildJsonLd` (feeds a small mounted `<SeoJsonLd>` component, since structured data can't travel through the `Metadata` object). Two new host-template routes (`sitemap.ts`, `robots.ts`) round out ranking support. Every builder is fail-open: a disabled plugin or malformed CMS value never crashes a render.

**Tech Stack:** Strapi 5 (CMS components/content-types/controllers), Next.js 15 Metadata API (`generateMetadata`, `MetadataRoute.Sitemap`/`Robots`), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-30-plugin-seo-design.md` — read it first; this plan cites it as `plugin-seo Spec §N`.

## Global Constraints

- Node 20.x / pnpm 10.x (repo root requirement).
- Write the failing test before the implementation for every code change (TDD).
- No eslint in this repo — `test` + `typecheck` are the quality gate. Run `pnpm --filter @ogs-tech/press-web test`, `pnpm --filter @ogs-tech/press-web typecheck`, `pnpm --filter @ogs-tech/press-cms test`, `pnpm --filter @ogs-tech/press-cms test:ts:back` before considering any task done.
- Every mapper/builder is fail-open/fail-to-empty: never throws on `null`/absent/malformed CMS data (plugin-seo Spec §3, §4).
- Nothing added here may call a Next dynamic API (`cookies()`, `headers()`) or otherwise force a route out of ISR — every value must derive from data already fetched under `revalidate: 60` (plugin-seo Spec §3).
- `@ogs-tech/press-web` bumps **major**, `@ogs-tech/press-cms` bumps **minor** (plugin-seo Spec §6) — one changeset, added in the final task.
- Host template files (`packages/web/templates/host/**`) are excluded from `packages/web`'s own `tsconfig.json`/vitest — they are verified by a manual `pnpm dev` smoke test, not automated tests. This matches how the `example` plugin's `layout.tsx` mount was verified (`docs/superpowers/specs/2026-07-27-base-plugin-design.md` precedent).
- Commit after every task step group, conventional-commit style (`feat(cms): ...` / `feat(web): ...`), matching this repo's existing history.

---

### Task 1: CMS components — `preset-config.seo-social`, `preset-config.seo`, `preset-config.seo-page`

**Files:**
- Create: `packages/cms/server/src/components/config/seo-social.json`
- Create: `packages/cms/server/src/components/config/seo.json`
- Create: `packages/cms/server/src/components/config/seo-page.json`
- Modify: `packages/cms/server/src/lib/inject-components.ts`
- Test: `packages/cms/server/src/lib/inject-components.test.ts`

**Interfaces:**
- Produces: registered component uids `preset-config.seo-social` (`{ twitterHandle, twitterUrl, linkedinUrl, instagramUrl, facebookUrl }`, all optional strings), `preset-config.seo` (`{ enabled: boolean; titleTemplate: string; metaDescription: text; ogImage: media; social: component(seo-social) }`), `preset-config.seo-page` (`{ metaTitle, metaDescription: text, ogImage: media, noindex: boolean }`) — consumed by Task 2 (Site Settings attribute references `preset-config.seo`) and Task 3 (page attribute references `preset-config.seo-page`).

- [ ] **Step 1: Write the failing tests**

In `packages/cms/server/src/lib/inject-components.test.ts`, extend the `expected` array inside the `'registers every engine preset-* component as a component model'` test (add after `'preset-config.example-plugin'`):

```ts
      'preset-config.basic-settings', 'preset-config.theme-advanced', 'preset-config.example-plugin',
      'preset-config.seo-social', 'preset-config.seo', 'preset-config.seo-page',
```

Then add a new top-level `describe` block, right after the existing `describe('site-setting examplePlugin attribute ...)` block stays where it is — add this new block at the end of the file's top-level `describe('injectComponents', ...)` block (after its last `it`, before the closing `});` of that describe):

```ts
  describe('preset-config.seo / seo-social / seo-page components (plugin-seo Spec §1)', () => {
    it('registers preset-config.seo with the site-wide defaults + nested social component', () => {
      const { strapi, components } = makeStrapi();
      injectComponents({ strapi });
      expect(components.get('preset-config.seo')?.category).toBe('preset-config');
      expect(components.get('preset-config.seo')?.attributes).toEqual({
        enabled: { type: 'boolean', default: true },
        titleTemplate: { type: 'string', default: '%s · {site}' },
        metaDescription: { type: 'text' },
        ogImage: { type: 'media', multiple: false, allowedTypes: ['images'] },
        social: { type: 'component', repeatable: false, component: 'preset-config.seo-social' },
      });
    });

    it('registers preset-config.seo-social with the five social fields', () => {
      const { strapi, components } = makeStrapi();
      injectComponents({ strapi });
      expect(components.get('preset-config.seo-social')?.category).toBe('preset-config');
      expect(components.get('preset-config.seo-social')?.attributes).toEqual({
        twitterHandle: { type: 'string' },
        twitterUrl: { type: 'string' },
        linkedinUrl: { type: 'string' },
        instagramUrl: { type: 'string' },
        facebookUrl: { type: 'string' },
      });
    });

    it('registers preset-config.seo-page with the four page-override fields', () => {
      const { strapi, components } = makeStrapi();
      injectComponents({ strapi });
      expect(components.get('preset-config.seo-page')?.category).toBe('preset-config');
      expect(components.get('preset-config.seo-page')?.attributes).toEqual({
        metaTitle: { type: 'string' },
        metaDescription: { type: 'text' },
        ogImage: { type: 'media', multiple: false, allowedTypes: ['images'] },
        noindex: { type: 'boolean', default: false },
      });
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts`
Expected: FAIL — `components.get('preset-config.seo')` etc. are all `undefined`.

- [ ] **Step 3: Create the three component JSON files**

Create `packages/cms/server/src/components/config/seo-social.json`:

```json
{
  "collectionName": "components_preset_config_seo_socials",
  "info": {
    "displayName": "Redes sociais",
    "icon": "earth",
    "description": "Social profile links and the Twitter card handle, feeding Organization JSON-LD and twitter:site"
  },
  "options": {},
  "attributes": {
    "twitterHandle": { "type": "string" },
    "twitterUrl": { "type": "string" },
    "linkedinUrl": { "type": "string" },
    "instagramUrl": { "type": "string" },
    "facebookUrl": { "type": "string" }
  },
  "config": {
    "metadatas": {
      "twitterHandle": { "edit": { "label": "Twitter/X handle", "description": "e.g. @acme — used as the twitter:site meta tag on every page." } },
      "twitterUrl": { "edit": { "label": "Twitter/X profile URL", "description": "Included in the site's Organization structured data (sameAs)." } },
      "linkedinUrl": { "edit": { "label": "LinkedIn profile URL", "description": "Included in the site's Organization structured data (sameAs)." } },
      "instagramUrl": { "edit": { "label": "Instagram profile URL", "description": "Included in the site's Organization structured data (sameAs)." } },
      "facebookUrl": { "edit": { "label": "Facebook page URL", "description": "Included in the site's Organization structured data (sameAs)." } }
    }
  }
}
```

Create `packages/cms/server/src/components/config/seo.json`:

```json
{
  "collectionName": "components_preset_config_seos",
  "info": {
    "displayName": "SEO",
    "icon": "search",
    "description": "Site-wide head metadata defaults: title template, description, share image, and social profiles"
  },
  "options": {},
  "attributes": {
    "enabled": { "type": "boolean", "default": true },
    "titleTemplate": { "type": "string", "default": "%s · {site}" },
    "metaDescription": { "type": "text" },
    "ogImage": { "type": "media", "multiple": false, "allowedTypes": ["images"] },
    "social": { "type": "component", "repeatable": false, "component": "preset-config.seo-social" }
  },
  "config": {
    "metadatas": {
      "enabled": { "edit": { "label": "Enabled", "description": "Turns on rich head metadata (description, canonical, Open Graph, Twitter card, JSON-LD, sitemap) for every page. Ships on by default." } },
      "titleTemplate": { "edit": { "label": "Title template", "description": "%s is replaced by each page's title and {site} by the site name — e.g. \"%s · {site}\"." } },
      "metaDescription": { "edit": { "label": "Default description", "description": "Used on any page that doesn't set its own description." } },
      "ogImage": { "edit": { "label": "Default share image", "description": "Shown when a page is shared and doesn't set its own image (Open Graph + Twitter card)." } },
      "social": { "edit": { "label": "Redes sociais", "description": "Social profile links and the Twitter card handle." } }
    }
  }
}
```

Create `packages/cms/server/src/components/config/seo-page.json`:

```json
{
  "collectionName": "components_preset_config_seo_pages",
  "info": {
    "displayName": "SEO",
    "icon": "listSearch",
    "description": "Per-page head metadata overrides — falls back to the site-wide SEO defaults when left empty"
  },
  "options": {},
  "attributes": {
    "metaTitle": { "type": "string" },
    "metaDescription": { "type": "text" },
    "ogImage": { "type": "media", "multiple": false, "allowedTypes": ["images"] },
    "noindex": { "type": "boolean", "default": false }
  },
  "config": {
    "metadatas": {
      "metaTitle": { "edit": { "label": "Title override", "description": "Overrides the page title in <title>/Open Graph/Twitter. Leave empty to use the page's own title." } },
      "metaDescription": { "edit": { "label": "Description override", "description": "Overrides the site-wide default description for this page only." } },
      "ogImage": { "edit": { "label": "Share image override", "description": "Overrides the site-wide default share image for this page only." } },
      "noindex": { "edit": { "label": "Hide from search engines", "description": "Excludes this page from search results and the sitemap. Off by default." } }
    }
  }
}
```

- [ ] **Step 4: Register them in `inject-components.ts`**

Add the imports near the other `config/*` imports (right after `examplePluginSchema`):

```ts
import examplePluginSchema from '../components/config/example-plugin.json';
import seoSocialSchema from '../components/config/seo-social.json';
import seoSchema from '../components/config/seo.json';
import seoPageSchema from '../components/config/seo-page.json';
```

Add three entries to `ENGINE_COMPONENTS`, after the `example-plugin` entry at the end of the array — nested child (`seo-social`) first, matching the `theme-advanced`-before-`basic-settings` precedent:

```ts
  // Plugin config (base-plugin Spec §3.1) — the example plugin's own
  // `enabled`/`message` fields, the first real consumer of PressPlugin<Id>.
  { layer: 'config', name: 'example-plugin', schema: examplePluginSchema as Record<string, unknown> },
  // SEO plugin config (plugin-seo Spec §1) — head metadata (ranking + social
  // share). Nested child first: `seo` references `seo-social`. `seo-page` is
  // the page-level override component, referenced by the page content-type
  // directly (Task 3), not nested inside `seo`.
  { layer: 'config', name: 'seo-social', schema: seoSocialSchema as Record<string, unknown> },
  { layer: 'config', name: 'seo', schema: seoSchema as Record<string, unknown> },
  { layer: 'config', name: 'seo-page', schema: seoPageSchema as Record<string, unknown> },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cms/server/src/components/config/seo-social.json packages/cms/server/src/components/config/seo.json packages/cms/server/src/components/config/seo-page.json packages/cms/server/src/lib/inject-components.ts packages/cms/server/src/lib/inject-components.test.ts
git commit -m "feat(cms): register preset-config.seo, seo-social, and seo-page components"
```

---

### Task 2: Site Settings `seo` attribute + controller populate

**Files:**
- Modify: `packages/cms/server/src/content-types/site-setting/schema.json`
- Modify: `packages/cms/server/src/controllers/site-setting.ts`
- Test: `packages/cms/server/src/lib/inject-components.test.ts`
- Test: `packages/cms/server/src/controllers/site-setting.test.ts`

**Interfaces:**
- Consumes: `preset-config.seo` uid (Task 1).
- Produces: `site-setting.seo` attribute (component, non-repeatable); the `find()` controller's populate map including `seo: { populate: { ogImage: true, social: true } }` — consumed by Task 6's web-side `SiteSettingsData.seo`.

- [ ] **Step 1: Write the failing tests**

In `packages/cms/server/src/lib/inject-components.test.ts`, add a new `describe` block after `describe('site-setting examplePlugin attribute ...)`:

```ts
describe('site-setting seo attribute (plugin-seo Spec §1)', () => {
  it('attaches preset-config.seo as a config component', () => {
    expect((siteSettingSchema.attributes as any).seo).toEqual({
      type: 'component',
      repeatable: false,
      component: 'preset-config.seo',
    });
  });
});
```

In `packages/cms/server/src/controllers/site-setting.test.ts`, add a new `it` inside `describe('site-setting controller', ...)`, after the `'populates examplePlugin ...'` test:

```ts
  it('deep-populates seo (share image + nested social component)', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.seo).toEqual({ populate: { ogImage: true, social: true } });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts src/controllers/site-setting.test.ts`
Expected: FAIL — `seo` is `undefined` in both assertions.

- [ ] **Step 3: Add the schema attribute**

In `packages/cms/server/src/content-types/site-setting/schema.json`, add to `attributes` (after `examplePlugin`):

```json
    "seo": { "type": "component", "repeatable": false, "component": "preset-config.seo" }
```

Add to `config.metadatas` (after `examplePlugin`):

```json
      "seo": { "edit": { "label": "SEO", "description": "Head metadata defaults for every page — title template, description, share image, and social profiles." } }
```

- [ ] **Step 4: Add the populate key**

In `packages/cms/server/src/controllers/site-setting.ts`, add `seo` to the object returned by `settingsPopulate()`, after `examplePlugin: true,`:

```ts
    examplePlugin: true,
    // seo carries one media field (ogImage) plus the nested social component —
    // both need explicit populate, same reason as basicSettings above.
    seo: { populate: { ogImage: true, social: true } },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts src/controllers/site-setting.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cms/server/src/content-types/site-setting/schema.json packages/cms/server/src/controllers/site-setting.ts packages/cms/server/src/lib/inject-components.test.ts packages/cms/server/src/controllers/site-setting.test.ts
git commit -m "feat(cms): add seo to Site Settings + controller populate"
```

---

### Task 3: Page `seo` attribute + controller populate

**Files:**
- Modify: `packages/cms/server/src/content-types/page/schema.json`
- Modify: `packages/cms/server/src/controllers/page.ts`
- Test: `packages/cms/server/src/lib/inject-components.test.ts`
- Create: `packages/cms/server/src/controllers/page.test.ts`

**Interfaces:**
- Consumes: `preset-config.seo-page` uid (Task 1).
- Produces: `page.seo` attribute (component, non-repeatable); `find`/`findOne` populate `{ seo: { populate: { ogImage: true } } }` — consumed by Task 7's web-side `RawPage.seo`.

- [ ] **Step 1: Write the failing tests**

In `packages/cms/server/src/lib/inject-components.test.ts`, add a new `describe` block, e.g. right after `describe('page.body customField ...)`:

```ts
describe('page seo attribute (plugin-seo Spec §1)', () => {
  it('attaches preset-config.seo-page as a component', () => {
    expect((pageSchema.attributes as any).seo).toEqual({
      type: 'component',
      repeatable: false,
      component: 'preset-config.seo-page',
    });
  });
});
```

Create `packages/cms/server/src/controllers/page.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import page from './page';

const PAGE_UID = 'plugin::press-cms.page';

/**
 * `hydratePageDoc`/`hydratePageDocs` (lib/serve-hydrated) run for real here —
 * with no `body` on the fixture they pass the doc through unchanged (same
 * pattern site-setting.test.ts uses for hydrateSiteSetting), so these tests
 * only need to pin the controller's own populate/query contract.
 */
describe('page controller', () => {
  function run(docs: unknown[] = [{ id: 1, documentId: 'doc-1', title: 'Home', slug: 'home' }]) {
    const findMany = vi.fn().mockResolvedValue(docs);
    const documents = vi.fn(() => ({ findMany }));
    const strapi = { documents } as any;
    return { strapi, documents, findMany };
  }

  describe('find (list)', () => {
    it('reads published pages and returns them under { data }', async () => {
      const { strapi, documents } = run();
      const ctx: any = {};
      await page({ strapi }).find(ctx);
      expect(documents).toHaveBeenCalledWith(PAGE_UID);
      expect(ctx.body).toEqual({ data: [{ id: 1, documentId: 'doc-1', title: 'Home', slug: 'home' }] });
    });

    it('populates seo (with its media field) alongside the published-only filter', async () => {
      const { strapi, findMany } = run();
      await page({ strapi }).find({} as any);
      expect(findMany).toHaveBeenCalledWith({
        status: 'published',
        populate: { seo: { populate: { ogImage: true } } },
      });
    });
  });

  describe('findOne', () => {
    it('returns notFound when no page matches the slug', async () => {
      const { strapi } = run([]);
      const ctx: any = { params: { slug: 'missing' }, notFound: vi.fn() };
      await page({ strapi }).findOne(ctx);
      expect(ctx.notFound).toHaveBeenCalled();
    });

    it('returns the matching page under { data }', async () => {
      const { strapi } = run([{ id: 1, documentId: 'doc-1', title: 'Home', slug: 'home' }]);
      const ctx: any = { params: { slug: 'home' } };
      await page({ strapi }).findOne(ctx);
      expect(ctx.body).toEqual({ data: { id: 1, documentId: 'doc-1', title: 'Home', slug: 'home' } });
    });

    it('populates seo (with its media field) alongside the slug filter', async () => {
      const { strapi, findMany } = run();
      await page({ strapi }).findOne({ params: { slug: 'home' } } as any);
      expect(findMany).toHaveBeenCalledWith({
        filters: { slug: 'home' },
        status: 'published',
        limit: 1,
        populate: { seo: { populate: { ogImage: true } } },
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts src/controllers/page.test.ts`
Expected: FAIL — `seo` is `undefined` on the schema; the populate assertions fail (no `populate` key passed today).

- [ ] **Step 3: Add the schema attribute**

In `packages/cms/server/src/content-types/page/schema.json`, add to `attributes` (after `body`). This schema has no `config.metadatas` block today (title/slug/body have none either) — stay consistent and don't add one:

```json
    "seo": { "type": "component", "repeatable": false, "component": "preset-config.seo-page" }
```

- [ ] **Step 4: Add the populate key to both controller methods**

Replace `packages/cms/server/src/controllers/page.ts` in full:

```ts
import type { Core } from '@strapi/strapi';
import { hydratePageDoc, hydratePageDocs } from '../lib/serve-hydrated';

const PAGE_UID = 'plugin::press-cms.page';

// seo (plugin-seo Spec §1) is a plain component — its `ogImage` media field
// is the only populate this controller owns.
const PAGE_POPULATE = { seo: { populate: { ogImage: true } } };

/**
 * Engine-owned page controller. `body` is a JSON custom field now — no dynamic
 * zone, no populate tree: the whole "vanished from the wire but visible in the
 * admin" bug class is gone (Spec §4). Published-only + 404 semantics unchanged.
 * Media/page-ref hydration is layered on in lib/serve-hydrated (Task 6).
 */
const page = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx: any) {
    const data = await strapi.documents(PAGE_UID as any).findMany({ status: 'published', populate: PAGE_POPULATE });
    ctx.body = { data: await hydratePageDocs(strapi, data as any[]) };
  },

  async findOne(ctx: any) {
    const { slug } = ctx.params;
    const [doc] = await strapi.documents(PAGE_UID as any).findMany({
      filters: { slug },
      status: 'published',
      limit: 1,
      populate: PAGE_POPULATE,
    });
    if (!doc) return ctx.notFound();
    ctx.body = { data: await hydratePageDoc(strapi, doc) };
  },
});

export default page;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts src/controllers/page.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cms/server/src/content-types/page/schema.json packages/cms/server/src/controllers/page.ts packages/cms/server/src/controllers/page.test.ts packages/cms/server/src/lib/inject-components.test.ts
git commit -m "feat(cms): add seo to the page content-type + controller populate"
```

---

### Task 4: Web plugin types, default, and mapper (`plugins/seo/*`)

**Files:**
- Create: `packages/web/src/plugins/seo/types.ts`
- Create: `packages/web/src/plugins/seo/default-seo-plugin.ts`
- Create: `packages/web/src/plugins/seo/map-seo-plugin.ts`
- Test: `packages/web/src/plugins/seo/map-seo-plugin.test.ts`

**Interfaces:**
- Consumes: `mediaUrl` — **not yet exported from `media.ts`** (that's Task 5). For this task, `map-seo-plugin.ts` imports it from `../../media` anyway; Task 5 makes that import resolve (it currently only exists as a private, unexported function inside `map-site-settings.ts`). Running this task's test before Task 5 is done will fail on the `ogImage` cases only — that's expected and documented in Step 2 below; this task's own commit lands independently, then Task 5 makes the import valid. (If executing tasks out of order, do Task 5 before Task 4, or accept a transient red state between the two — the plan is written in dependency order so this doesn't happen.)
- Produces: `RawSeoPlugin`, `ResolvedSeoPlugin`, `ResolvedSeoSocial`, `DEFAULT_SEO_PLUGIN`, `mapSeoPlugin(raw): ResolvedSeoPlugin` — consumed by Task 6 (`ResolvedPressConfig.plugins.seo`, `mapSiteSettings`).

- [ ] **Step 1: Create the types file**

Create `packages/web/src/plugins/seo/types.ts`:

```ts
/**
 * Wire + resolved shapes for the SEO plugin (plugin-seo Spec §2) — head
 * metadata (ranking + social share) as an opt-in engine plugin. `Raw` mirrors
 * the CMS component verbatim (every field optional); `Resolved` is TOTAL —
 * the shape `buildSeoMetadata`/`buildJsonLd` and
 * `ResolvedPressConfig.plugins.seo` actually consume. `titleTemplate`'s
 * `{site}` placeholder is intentionally left unsubstituted here —
 * `buildSeoMetadata` substitutes it, where `brand.name` is in scope
 * alongside the template.
 */
interface RawMedia {
  url?: string;
}

export interface RawSeoSocial {
  twitterHandle?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
}

export interface RawSeoPlugin {
  enabled?: boolean;
  titleTemplate?: string;
  metaDescription?: string;
  ogImage?: RawMedia | null;
  social?: RawSeoSocial | null;
}

export interface ResolvedSeoSocial {
  twitterHandle?: string;
  /** Non-empty social profile URLs, already filtered — feeds Organization.sameAs. */
  sameAs: string[];
}

export interface ResolvedSeoPlugin {
  enabled: boolean;
  titleTemplate: string;
  metaDescription: string;
  ogImage?: string;
  social: ResolvedSeoSocial;
}
```

- [ ] **Step 2: Create the default**

Create `packages/web/src/plugins/seo/default-seo-plugin.ts`:

```ts
import type { ResolvedSeoPlugin } from './types';

/**
 * Ships ENABLED by default (plugin-seo Spec §6) — diverging from the
 * `example`/cookie-consent "ships disabled" precedent: SEO is core product
 * surface a fresh adopter site should have on day one, not a demo requiring
 * an opt-in step to discover.
 */
export const DEFAULT_SEO_PLUGIN: ResolvedSeoPlugin = {
  enabled: true,
  titleTemplate: '%s · {site}',
  metaDescription: '',
  social: { sameAs: [] },
};
```

- [ ] **Step 3: Write the failing test for the mapper**

Create `packages/web/src/plugins/seo/map-seo-plugin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapSeoPlugin } from './map-seo-plugin';
import { DEFAULT_SEO_PLUGIN } from './default-seo-plugin';

describe('mapSeoPlugin', () => {
  it('resolves DEFAULT_SEO_PLUGIN (enabled) when the CMS component is null', () => {
    expect(mapSeoPlugin(null)).toEqual(DEFAULT_SEO_PLUGIN);
  });

  it('resolves DEFAULT_SEO_PLUGIN when the CMS component is absent (undefined)', () => {
    expect(mapSeoPlugin(undefined)).toEqual(DEFAULT_SEO_PLUGIN);
  });

  it('resolves DEFAULT_SEO_PLUGIN when the CMS component is an empty object', () => {
    expect(mapSeoPlugin({})).toEqual(DEFAULT_SEO_PLUGIN);
  });

  it('lets a present enabled/titleTemplate/metaDescription win over the default', () => {
    expect(
      mapSeoPlugin({ enabled: false, titleTemplate: '%s | {site}', metaDescription: 'Default desc' }),
    ).toEqual({
      enabled: false,
      titleTemplate: '%s | {site}',
      metaDescription: 'Default desc',
      ogImage: undefined,
      social: { sameAs: [] },
    });
  });

  it('resolves ogImage to an absolute URL; missing media stays undefined', () => {
    expect(mapSeoPlugin({ ogImage: { url: '/uploads/og.png' } }).ogImage).toBe(
      'http://localhost:1337/uploads/og.png',
    );
    expect(mapSeoPlugin({}).ogImage).toBeUndefined();
  });

  it('resolves social.twitterHandle through and filters sameAs to non-empty URLs only', () => {
    const r = mapSeoPlugin({
      social: {
        twitterHandle: '@acme',
        twitterUrl: 'https://twitter.com/acme',
        linkedinUrl: '',
        instagramUrl: undefined,
        facebookUrl: 'https://facebook.com/acme',
      },
    });
    expect(r.social).toEqual({
      twitterHandle: '@acme',
      sameAs: ['https://twitter.com/acme', 'https://facebook.com/acme'],
    });
  });

  it('resolves an empty/absent social component to { sameAs: [] }', () => {
    expect(mapSeoPlugin({}).social).toEqual({ sameAs: [] });
    expect(mapSeoPlugin({ social: null }).social).toEqual({ sameAs: [] });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/seo/map-seo-plugin.test.ts`
Expected: FAIL — `mapSeoPlugin` is not defined (module doesn't exist yet).

- [ ] **Step 5: Implement the mapper**

Create `packages/web/src/plugins/seo/map-seo-plugin.ts`:

```ts
import type { RawSeoPlugin, RawSeoSocial, ResolvedSeoPlugin, ResolvedSeoSocial } from './types';
import { DEFAULT_SEO_PLUGIN } from './default-seo-plugin';
import { mediaUrl } from '../../media';

/** Non-empty social URLs only — feeds Organization.sameAs. */
function mapSameAs(raw: RawSeoSocial | null | undefined): string[] {
  return [raw?.twitterUrl, raw?.linkedinUrl, raw?.instagramUrl, raw?.facebookUrl].filter(
    (url): url is string => typeof url === 'string' && url.length > 0,
  );
}

function mapSocial(raw: RawSeoSocial | null | undefined): ResolvedSeoSocial {
  return {
    twitterHandle: raw?.twitterHandle,
    sameAs: mapSameAs(raw),
  };
}

/**
 * Pure CMS-shape → ResolvedSeoPlugin (plugin-seo Spec §2 mapper role):
 * FAIL-OPEN — a null/absent CMS component still resolves a total, well-typed
 * value (DEFAULT_SEO_PLUGIN), never throws, no I/O. A present field wins over
 * the default; an absent/undefined field keeps the default. `titleTemplate`'s
 * `{site}` placeholder is left unsubstituted — `buildSeoMetadata` does that.
 */
export function mapSeoPlugin(raw: RawSeoPlugin | null | undefined): ResolvedSeoPlugin {
  return {
    enabled: raw?.enabled ?? DEFAULT_SEO_PLUGIN.enabled,
    titleTemplate: raw?.titleTemplate ?? DEFAULT_SEO_PLUGIN.titleTemplate,
    metaDescription: raw?.metaDescription ?? DEFAULT_SEO_PLUGIN.metaDescription,
    ogImage: mediaUrl(raw?.ogImage),
    social: mapSocial(raw?.social),
  };
}
```

Note: `../../media` doesn't export `mediaUrl` yet — it's still a private function inside `map-site-settings.ts`. This import will fail to resolve until Task 5. Since Task 5 comes after this task in the plan's dependency order, running the full suite right now will show this one file red; that's expected mid-plan and is resolved by Task 5. If you want every commit to leave `pnpm --filter @ogs-tech/press-web test` fully green, do Task 5's `media.ts` step (Step 1 only — exporting `mediaUrl`) before Step 4 of this task. Otherwise, proceed and let Task 5 close the gap.

- [ ] **Step 6: Run test to verify it passes (after Task 5's `media.ts` export exists)**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/seo/map-seo-plugin.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/plugins/seo/types.ts packages/web/src/plugins/seo/default-seo-plugin.ts packages/web/src/plugins/seo/map-seo-plugin.ts packages/web/src/plugins/seo/map-seo-plugin.test.ts
git commit -m "feat(web): SEO plugin types, default, and mapper"
```

---

### Task 5: `media.ts` — export `mediaUrl`

**Files:**
- Modify: `packages/web/src/media.ts`
- Modify: `packages/web/src/map-site-settings.ts`
- Create: `packages/web/src/media.test.ts`

**Interfaces:**
- Produces: `mediaUrl(media: { url?: string } | null | undefined): string | undefined`, exported from `media.ts` — closes the import gap Task 4's `map-seo-plugin.ts` left open, and is consumed by Task 7's `map-page.ts`.

This task is ordered right after Task 4 specifically so Task 4's test goes green immediately. If you did Task 4's Step 6 already (because you did this task's Step 1 first out of order), skip straight to Step 3 here.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/media.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mediaUrl } from './media';

describe('mediaUrl', () => {
  it('resolves a relative Strapi url absolute against CMS_URL', () => {
    expect(mediaUrl({ url: '/uploads/logo.png' })).toBe('http://localhost:1337/uploads/logo.png');
  });

  it('keeps an already-absolute url unchanged', () => {
    expect(mediaUrl({ url: 'https://cdn.test/logo.png' })).toBe('https://cdn.test/logo.png');
  });

  it('returns undefined for null/undefined media', () => {
    expect(mediaUrl(null)).toBeUndefined();
    expect(mediaUrl(undefined)).toBeUndefined();
  });

  it('returns undefined when the media object has no url', () => {
    expect(mediaUrl({})).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/media.test.ts`
Expected: FAIL — `mediaUrl` is not exported from `./media`.

- [ ] **Step 3: Move `mediaUrl` into `media.ts`**

Replace `packages/web/src/media.ts` in full:

```ts
/**
 * The one place that reads `process.env.CMS_URL` for a running web host (the
 * `press dev`/`build` commands set the env var itself — a different concern —
 * and keep their own literal default). Every fetch/render call site imports
 * `CMS_URL` from here instead of re-declaring the same fallback.
 */
export const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/** Resolves a Strapi-relative asset url absolute against `base` (defaults to
 *  CMS_URL) — the raw `<img>` src contract preset-atom.image and preset-organism.hero
 *  share. Throws on a malformed url, matching `new URL`'s own contract. */
export function resolveMediaUrl(url: string, base: string = CMS_URL): string {
  return new URL(url, base).toString();
}

/**
 * Resolves a Strapi media url absolute against CMS_URL; undefined when
 * absent. Unlike `resolveMediaUrl` this never throws — a mapper-facing
 * helper for optional media fields (`basicSettings.logo`, `seo.ogImage`, …)
 * where "no media" is a normal, valid state, not an error.
 */
export function mediaUrl(media: { url?: string } | null | undefined): string | undefined {
  const url = media?.url;
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${CMS_URL}${url}`;
}
```

- [ ] **Step 4: Remove the now-duplicate local copy from `map-site-settings.ts`**

In `packages/web/src/map-site-settings.ts`, change the import line:

```ts
import { mediaUrl } from './media';
```

(was `import { CMS_URL } from './media';`) and delete the local `mediaUrl` function definition (the `/** Resolves a Strapi media url absolute against CMS_URL; undefined when absent. */` block, lines 8–13 in the current file).

- [ ] **Step 5: Run tests to verify everything passes**

Run: `pnpm --filter @ogs-tech/press-web test src/media.test.ts src/map-site-settings.test.ts src/plugins/seo/map-seo-plugin.test.ts`
Expected: PASS — all three files, including Task 4's now-unblocked mapper test.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/media.ts packages/web/src/media.test.ts packages/web/src/map-site-settings.ts
git commit -m "refactor(web): export mediaUrl from media.ts (two real consumers now)"
```

---

### Task 6: Wire `ResolvedPressConfig.plugins.seo` + `SiteSettingsData.seo` + `mapSiteSettings`

**Files:**
- Modify: `packages/web/src/config/types.ts`
- Modify: `packages/web/src/map-site-settings.ts`
- Modify: `packages/web/src/map-site-settings.test.ts`
- Modify: `packages/web/src/config/build-theme-style.test.ts`
- Modify: `packages/web/src/config/build-metadata.test.ts`
- Modify: `packages/web/src/index.ts`

**Interfaces:**
- Consumes: `mapSeoPlugin`, `ResolvedSeoPlugin`, `RawSeoPlugin` (Task 4).
- Produces: `ResolvedPressConfig.plugins.seo: ResolvedSeoPlugin` (now REQUIRED — breaking); `SiteSettingsData.seo?: RawSeoPlugin | null` — consumed by Task 8 (`buildSeoMetadata` reads `resolved.plugins.seo`) and Task 10 (`syncPluginEntries`'s `readEnabled`).

- [ ] **Step 1: Write the failing tests**

In `packages/web/src/map-site-settings.test.ts`, add the import:

```ts
import { DEFAULT_SEO_PLUGIN } from './plugins/seo/default-seo-plugin';
```

Add two new `it`s inside `describe('mapSiteSettings', ...)`, after the `'resolves plugins.example from a present examplePlugin component'` test:

```ts
  it('resolves plugins.seo to DEFAULT_SEO_PLUGIN (enabled) when the CMS is null (plugin-seo Spec §2)', () => {
    const r = mapSiteSettings(buildTime, null);
    expect(r.plugins.seo).toEqual(DEFAULT_SEO_PLUGIN);
  });

  it('resolves plugins.seo from a present seo component', () => {
    const r = mapSiteSettings(buildTime, { seo: { enabled: false, metaDescription: 'Custom' } });
    expect(r.plugins.seo.enabled).toBe(false);
    expect(r.plugins.seo.metaDescription).toBe('Custom');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/map-site-settings.test.ts`
Expected: FAIL — `r.plugins.seo` is `undefined`.

- [ ] **Step 3: Wire the type**

In `packages/web/src/config/types.ts`, add the import (alongside the existing example-plugin import):

```ts
import type { RawExamplePlugin, ResolvedExamplePlugin } from '../plugins/example/types';
import type { RawSeoPlugin, ResolvedSeoPlugin } from '../plugins/seo/types';
```

Change the `plugins` field on `ResolvedPressConfig`:

```ts
  /**
   * Resolved engine plugins (base-plugin Spec §3), one required key per wired
   * plugin — additive is a press-web MAJOR, the `pageDefaults`/`layout`
   * discipline. `seo` (plugin-seo Spec §2) is the second real plugin, after
   * `example`.
   */
  plugins: {
    example: ResolvedExamplePlugin;
    seo: ResolvedSeoPlugin;
  };
```

Add `seo` to `SiteSettingsData` (after `examplePlugin`):

```ts
  /** The `preset-config.example-plugin` component (base-plugin Spec §3), RAW. */
  examplePlugin?: RawExamplePlugin | null;
  /** The `preset-config.seo` component (plugin-seo Spec §1), RAW. */
  seo?: RawSeoPlugin | null;
```

- [ ] **Step 4: Wire the mapper**

In `packages/web/src/map-site-settings.ts`, add the import:

```ts
import { mapExamplePlugin } from './plugins/example/map-example-plugin';
import { mapSeoPlugin } from './plugins/seo/map-seo-plugin';
```

Update the returned object's `plugins` field:

```ts
    plugins: {
      example: mapExamplePlugin(c.examplePlugin),
      seo: mapSeoPlugin(c.seo),
    },
```

- [ ] **Step 5: Fix the two existing hand-built `ResolvedPressConfig` fixtures**

`ResolvedPressConfig.plugins.seo` is now required, so TypeScript will fail to compile any hand-written literal missing it. Two test files build one directly (found via `grep -rln "ResolvedPressConfig" --include="*.test.ts" packages apps`; `map-site-settings.test.ts` above doesn't — it only calls the `mapSiteSettings` function, which now fills `seo` automatically).

In `packages/web/src/config/build-theme-style.test.ts`, add the import:

```ts
import { DEFAULT_EXAMPLE_PLUGIN } from '../plugins/example/default-example-plugin';
import { DEFAULT_SEO_PLUGIN } from '../plugins/seo/default-seo-plugin';
```

and change:

```ts
  plugins: { example: DEFAULT_EXAMPLE_PLUGIN },
```

to:

```ts
  plugins: { example: DEFAULT_EXAMPLE_PLUGIN, seo: DEFAULT_SEO_PLUGIN },
```

In `packages/web/src/config/build-metadata.test.ts`, make the same two changes (import + `plugins` literal). This file is fully rewritten and renamed in Task 8 — this is a minimal, temporary fix so the suite stays green at this commit boundary; don't invest more than this one-line change here.

- [ ] **Step 6: Export `ResolvedSeoPlugin`**

In `packages/web/src/index.ts`, change:

```ts
export { ExamplePlugin } from './plugins/example/example-plugin';
export type { ResolvedExamplePlugin } from './plugins/example/types';
```

to:

```ts
export { ExamplePlugin } from './plugins/example/example-plugin';
export type { ResolvedExamplePlugin } from './plugins/example/types';
export type { ResolvedSeoPlugin } from './plugins/seo/types';
```

- [ ] **Step 7: Run the full web suite + typecheck to verify everything passes**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS — no type errors, all tests green (including the two fixed fixtures).

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/config/types.ts packages/web/src/map-site-settings.ts packages/web/src/map-site-settings.test.ts packages/web/src/config/build-theme-style.test.ts packages/web/src/config/build-metadata.test.ts packages/web/src/index.ts
git commit -m "feat(web)!: ResolvedPressConfig gains required plugins.seo"
```

---

### Task 7: `mapPage` resolves `seo` (`Page.seo`)

**Files:**
- Modify: `packages/web/src/types/base.ts`
- Modify: `packages/web/src/map-page.ts`
- Modify: `packages/web/src/map-page.test.ts`
- Modify: `packages/web/src/index.ts`

**Interfaces:**
- Consumes: `mediaUrl` (Task 5).
- Produces: `Page.seo?: PageSeo` where `PageSeo = { metaTitle?: string; metaDescription?: string; ogImage?: string; noindex?: boolean }` (`ogImage` already an absolute URL) — consumed by Tasks 8–9 (`buildSeoMetadata`/`buildJsonLd` read `page.seo`) and Task 12 (host template call sites).

- [ ] **Step 1: Write the failing tests**

In `packages/web/src/map-page.test.ts`, add two `it`s after the existing `'passes every wire field through unchanged'` test:

```ts
  it('resolves seo.ogImage to an absolute URL, keeping the other seo fields unchanged', () => {
    const withSeo: RawPage = {
      ...raw,
      seo: { metaTitle: 'Override', metaDescription: 'Desc', ogImage: { url: '/uploads/og.png' }, noindex: true },
    };
    expect(mapPage(withSeo).seo).toEqual({
      metaTitle: 'Override',
      metaDescription: 'Desc',
      ogImage: 'http://localhost:1337/uploads/og.png',
      noindex: true,
    });
  });

  it('leaves seo undefined when the page has no seo component', () => {
    expect(mapPage(raw).seo).toBeUndefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/map-page.test.ts`
Expected: FAIL — TypeScript error (`RawPage` has no `seo` field yet) and/or `mapPage(withSeo).seo` is `undefined`.

- [ ] **Step 3: Add `PageSeo` to `types/base.ts`**

In `packages/web/src/types/base.ts`, add the interface right before `Page` and add the `seo` field to `Page`:

```ts
/**
 * Resolved per-page SEO/social overrides (plugin-seo Spec §1/§2) — `ogImage`
 * is already an absolute URL (mapPage resolves it, mirroring
 * `basicSettings.logo` in mapSiteSettings). Every field falls back to a
 * site-wide default at the `buildSeoMetadata`/`buildJsonLd` call site, never
 * here — `mapPage` stays structural, not a business-default resolver
 * (mirrors how `title`/`slug`/`body` pass through unresolved too).
 */
export interface PageSeo {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  noindex?: boolean;
}

/**
 * The page envelope the engine fetches and renders. A canonical entity
 * (canonical-urn Spec §2): `urn:page:{documentId}` is attached at the mapping
 * boundary (map-page.ts) — derived web-side, never part of the CMS wire shape.
 */
export interface Page extends Canonical<'page'> {
  id: number;
  documentId: string;
  title: string;
  slug?: string;
  body: PageBody;
  seo?: PageSeo;
}
```

- [ ] **Step 4: Implement the resolution in `map-page.ts`**

Replace `packages/web/src/map-page.ts` in full:

```ts
import type { Page, PageSeo } from './types/base';
import { buildUrn } from './urn';
import { mediaUrl } from './media';

/** `preset-config.seo-page`'s `ogImage` as it arrives on the wire — a raw Strapi media reference, not yet resolved absolute. */
interface RawPageSeo {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: { url?: string } | null;
  noindex?: boolean;
}

/**
 * The page envelope exactly as GET /api/pages/:slug serves it — everything
 * `Page` has except the derived `urn`, and `seo`, which arrives with a raw
 * (unresolved) media reference rather than the absolute url `Page.seo` carries.
 */
export type RawPage = Omit<Page, 'urn' | 'seo'> & { seo?: RawPageSeo | null };

function mapPageSeo(raw: RawPageSeo | null | undefined): PageSeo | undefined {
  if (!raw) return undefined;
  return {
    metaTitle: raw.metaTitle,
    metaDescription: raw.metaDescription,
    ogImage: mediaUrl(raw.ogImage),
    noindex: raw.noindex,
  };
}

/**
 * Pure wire-shape → Page mapper (canonical-urn Spec §2), mirroring the
 * mapSiteSettings pure-mapper + thin-fetcher split. Attaches the canonical
 * stored identity `urn:page:{documentId}` — documentId is Strapi 5's stable
 * document key (survives draft/publish and locale variants) and is always
 * present on a served document, so no defensive fallback. `seo.ogImage`
 * resolves to an absolute URL (plugin-seo Spec §2), the same treatment
 * `basicSettings.logo` gets in mapSiteSettings — everything else on `seo`
 * passes through unchanged (mapPage stays structural, never fills a
 * business default). Same input → same output, no I/O.
 */
export function mapPage(raw: RawPage): Page {
  return { ...raw, urn: buildUrn('page', raw.documentId), seo: mapPageSeo(raw.seo) };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/map-page.test.ts src/get-page.test.ts`
Expected: PASS (the existing `get-page.test.ts` fixtures don't set `seo`, so `mapPage`'s `seo: undefined` output stays `toEqual`-compatible with them, per `undefined`-key equivalence).

- [ ] **Step 6: Export `PageSeo`**

In `packages/web/src/index.ts`, add `PageSeo` to the `types/base` export block:

```ts
export type {
  Page,
  PageBody,
  PageSeo,
  PressMedia,
  ...
```

- [ ] **Step 7: Run the full web suite + typecheck**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/types/base.ts packages/web/src/map-page.ts packages/web/src/map-page.test.ts packages/web/src/index.ts
git commit -m "feat(web): mapPage resolves page.seo (ogImage absolute)"
```

---

### Task 8: `buildSeoMetadata` (renamed from `buildMetadata`)

**Files:**
- Modify (rename via `git mv`): `packages/web/src/config/build-metadata.ts` → `packages/web/src/config/build-seo-metadata.ts`
- Modify (rename via `git mv`): `packages/web/src/config/build-metadata.test.ts` → `packages/web/src/config/build-seo-metadata.test.ts`
- Modify: `packages/web/src/index.ts`

**Interfaces:**
- Consumes: `ResolvedPressConfig.plugins.seo` (Task 6), `PageSeo` (Task 7).
- Produces: `buildSeoMetadata(resolved: ResolvedPressConfig, page: { title?: string; seo?: PageSeo } | null, path?: string): Metadata` — consumed by Task 12 (host template `generateMetadata` exports). This REPLACES `buildMetadata` (removed from the public API).

This task builds the function in three increments — disabled-branch (a straight rename of existing behavior), then the layout-fallback enabled path, then the per-page enabled path — each with its own failing-test → implement → passing-test → commit cycle, per this repo's TDD convention.

#### Increment A — rename + disabled-branch behavior (unchanged from today's `buildMetadata`)

- [ ] **Step 1: Rename the files**

```bash
git mv packages/web/src/config/build-metadata.ts packages/web/src/config/build-seo-metadata.ts
git mv packages/web/src/config/build-metadata.test.ts packages/web/src/config/build-seo-metadata.test.ts
```

- [ ] **Step 2: Rewrite the test file's disabled-branch describe block**

Replace `packages/web/src/config/build-seo-metadata.test.ts` in full with (this increment covers only the `describe('buildSeoMetadata — plugin disabled', ...)` block below — the later increments append more `describe` blocks to this same file in later steps):

```ts
import { describe, expect, it } from 'vitest';
import { buildSeoMetadata } from './build-seo-metadata';
import type { ResolvedPressConfig } from './types';
import { DEFAULT_LAYOUT } from '@ogs-tech/press-shared';
import { DEFAULT_EXAMPLE_PLUGIN } from '../plugins/example/default-example-plugin';
import { DEFAULT_SEO_PLUGIN } from '../plugins/seo/default-seo-plugin';

const baseResolved: ResolvedPressConfig = {
  urn: 'urn:site-setting:default',
  brand: { name: 'Acme', favicon: '/favicon.ico' },
  site: { url: 'https://acme.test', locale: 'en' },
  routes: { home: 'home' },
  theme: {
    name: 'default',
    colors: {
      primary: '#119350', accent: '#D9A12C', secondary: '#3D5CC2', ink: '#142036',
      surface: '#FAF8F3', muted: '#7A7E89', danger: '#C0392B', onPrimary: '#FFFFFF',
      border: 'rgba(20,32,54,0.12)',
    },
    fonts: {},
    radius: { xs: '6px', sm: '10px', md: '14px', lg: '20px' },
  },
  pageDefaults: { header: [], footer: [] },
  layout: DEFAULT_LAYOUT,
  plugins: { example: DEFAULT_EXAMPLE_PLUGIN, seo: DEFAULT_SEO_PLUGIN },
};

const disabled: ResolvedPressConfig = {
  ...baseResolved,
  plugins: { ...baseResolved.plugins, seo: { ...DEFAULT_SEO_PLUGIN, enabled: false } },
};

describe('buildSeoMetadata — plugin disabled', () => {
  it('uses the page title when there is a page', () => {
    const m = buildSeoMetadata(disabled, { title: 'E2E Home' });
    expect(m.title).toBe('E2E Home');
  });

  it('falls back to the site name when there is no page (layout base)', () => {
    const m = buildSeoMetadata(disabled, null);
    expect(m.title).toBe('Acme');
  });

  it('derives the favicon icon from brand.favicon', () => {
    const m = buildSeoMetadata(disabled, null);
    expect(m.icons).toEqual({ icon: '/favicon.ico' });
  });

  it('omits the favicon when brand.favicon is empty', () => {
    const noFavicon = { ...disabled, brand: { ...disabled.brand, favicon: '' } };
    const m = buildSeoMetadata(noFavicon, null);
    expect(m.icons).toBeUndefined();
  });

  it('emits no SEO/social metadata at all — exactly the pre-plugin shape', () => {
    const m = buildSeoMetadata(disabled, { title: 'E2E Home', seo: { metaDescription: 'ignored', noindex: true } });
    expect(m.description).toBeUndefined();
    expect(m.openGraph).toBeUndefined();
    expect(m.twitter).toBeUndefined();
    expect(m.alternates).toBeUndefined();
    expect(m.robots).toBeUndefined();
    expect(m.metadataBase).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/config/build-seo-metadata.test.ts`
Expected: FAIL — `build-seo-metadata.ts` still exports `buildMetadata` (old name) with the old two-argument signature; the fixtures now require `plugins.seo`.

- [ ] **Step 4: Rewrite `build-seo-metadata.ts` — rename + disabled branch only**

Replace `packages/web/src/config/build-seo-metadata.ts` in full:

```ts
import type { Metadata } from 'next';
import type { ResolvedPressConfig } from './types';
import type { PageSeo } from '../types/base';

type PageMeta = { title?: string; seo?: PageSeo } | null;

/**
 * Produces the Next `Metadata` object for a route (plugin-seo Spec §3),
 * replacing the old title+favicon-only `buildMetadata` — its own comment
 * already deferred everything else to this plugin. `path` is the
 * browser-visible URL path the caller already resolved (e.g. '/about');
 * callers must pass `undefined` whenever `page` is `null` so a 404/
 * layout-fallback response never carries a self-referencing canonical.
 * Pure — no I/O.
 */
export function buildSeoMetadata(resolved: ResolvedPressConfig, page: PageMeta, path?: string): Metadata {
  const { brand } = resolved;
  const seo = resolved.plugins.seo;

  if (!seo.enabled) {
    return {
      title: page?.title ?? brand.name,
      ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
    };
  }

  // Enabled branch: built out in the increments below.
  return {
    title: page?.title ?? brand.name,
    ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/config/build-seo-metadata.test.ts`
Expected: PASS (all 5 disabled-branch tests; `baseResolved`/enabled behavior isn't tested yet).

- [ ] **Step 6: Update the export in `index.ts`**

In `packages/web/src/index.ts`, change:

```ts
export { buildMetadata } from './config/build-metadata';
```

to:

```ts
export { buildSeoMetadata } from './config/build-seo-metadata';
```

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/config/build-seo-metadata.ts packages/web/src/config/build-seo-metadata.test.ts packages/web/src/index.ts
git commit -m "feat(web)!: rename buildMetadata to buildSeoMetadata"
```

#### Increment B — enabled, layout fallback (`page: null`): title.template, metadataBase, malformed-URL safety

- [ ] **Step 1: Append the failing tests**

Append to `packages/web/src/config/build-seo-metadata.test.ts` (after the `describe('buildSeoMetadata — plugin disabled', ...)` block, same file):

```ts
describe('buildSeoMetadata — plugin enabled, layout fallback (page: null)', () => {
  it('returns a title.template built from titleTemplate with {site} substituted, and a default', () => {
    const m = buildSeoMetadata(baseResolved, null);
    expect(m.title).toEqual({ template: '%s · Acme', default: 'Acme' });
  });

  it('sets metadataBase from site.url', () => {
    const m = buildSeoMetadata(baseResolved, null);
    expect(m.metadataBase).toEqual(new URL('https://acme.test'));
  });

  it('never sets canonical/alternates or openGraph.url — no page context', () => {
    const m = buildSeoMetadata(baseResolved, null);
    expect(m.alternates).toBeUndefined();
    expect(m.openGraph?.url).toBeUndefined();
  });

  it('never throws on a malformed Site URL, and omits metadataBase', () => {
    const bad = { ...baseResolved, site: { ...baseResolved.site, url: 'not-a-url' } };
    expect(() => buildSeoMetadata(bad, null)).not.toThrow();
    expect(buildSeoMetadata(bad, null).metadataBase).toBeUndefined();
  });

  it('omits metadataBase/canonical when site.url is empty', () => {
    const empty = { ...baseResolved, site: { ...baseResolved.site, url: '' } };
    const m = buildSeoMetadata(empty, { title: 'About' }, '/about');
    expect(m.metadataBase).toBeUndefined();
    expect(m.alternates).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/config/build-seo-metadata.test.ts`
Expected: FAIL — the enabled branch still returns the disabled-branch shape (no `title.template`, no `metadataBase`).

- [ ] **Step 3: Implement the layout-fallback enabled path**

Replace the enabled branch of `buildSeoMetadata` in `packages/web/src/config/build-seo-metadata.ts` (the whole function stays in one file; only the body after the `if (!seo.enabled)` block changes):

```ts
import type { Metadata } from 'next';
import type { ResolvedPressConfig } from './types';
import type { PageSeo } from '../types/base';

type PageMeta = { title?: string; seo?: PageSeo } | null;

/** `new URL` throws on a malformed value — an editor-typed Site URL is free text, never trusted raw. */
function safeUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

/**
 * Produces the Next `Metadata` object for a route (plugin-seo Spec §3),
 * replacing the old title+favicon-only `buildMetadata` — its own comment
 * already deferred everything else to this plugin. `path` is the
 * browser-visible URL path the caller already resolved (e.g. '/about');
 * callers must pass `undefined` whenever `page` is `null` so a 404/
 * layout-fallback response never carries a self-referencing canonical.
 * Pure — no I/O, never throws even on a malformed Site URL.
 */
export function buildSeoMetadata(resolved: ResolvedPressConfig, page: PageMeta, path?: string): Metadata {
  const { brand, site } = resolved;
  const seo = resolved.plugins.seo;

  if (!seo.enabled) {
    return {
      title: page?.title ?? brand.name,
      ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
    };
  }

  const metadataBase = safeUrl(site.url);
  const template = seo.titleTemplate.replace('{site}', brand.name);
  const title = page ? page.seo?.metaTitle || page.title || brand.name : { template, default: brand.name };

  return {
    ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
    ...(metadataBase ? { metadataBase } : {}),
    title,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/config/build-seo-metadata.test.ts`
Expected: PASS — disabled-branch tests (Increment A) and layout-fallback tests (this increment) all green. Per-page enabled tests don't exist yet.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/config/build-seo-metadata.ts packages/web/src/config/build-seo-metadata.test.ts
git commit -m "feat(web): buildSeoMetadata title.template + metadataBase (layout fallback)"
```

#### Increment C — enabled, with a page: description, canonical, hreflang stub, robots noindex

- [ ] **Step 1: Append the failing tests**

Append to `packages/web/src/config/build-seo-metadata.test.ts`:

```ts
describe('buildSeoMetadata — plugin enabled, with a page (description/canonical/robots)', () => {
  const page = { title: 'About us', seo: { metaDescription: 'The about page' } };

  it('uses the page title as a plain string (Next applies the ancestor template)', () => {
    const m = buildSeoMetadata(baseResolved, page, '/about');
    expect(m.title).toBe('About us');
  });

  it('lets page.seo.metaTitle override page.title', () => {
    const m = buildSeoMetadata(baseResolved, { ...page, seo: { ...page.seo, metaTitle: 'Override title' } }, '/about');
    expect(m.title).toBe('Override title');
  });

  it('uses page.seo.metaDescription, falling back to the site default', () => {
    const m = buildSeoMetadata(baseResolved, page, '/about');
    expect(m.description).toBe('The about page');
    const withSiteDefault: ResolvedPressConfig = {
      ...baseResolved,
      plugins: { ...baseResolved.plugins, seo: { ...DEFAULT_SEO_PLUGIN, metaDescription: 'Site default desc' } },
    };
    const noOverride = buildSeoMetadata(withSiteDefault, { title: 'About us' }, '/about');
    expect(noOverride.description).toBe('Site default desc');
  });

  it('builds a self-referencing canonical from site.url + path, and a single-locale hreflang stub', () => {
    const m = buildSeoMetadata(baseResolved, page, '/about');
    expect(m.alternates).toEqual({
      canonical: 'https://acme.test/about',
      languages: { en: 'https://acme.test/about' },
    });
  });

  it('omits alternates.languages when site.locale is empty', () => {
    const noLocale = { ...baseResolved, site: { ...baseResolved.site, locale: '' } };
    const m = buildSeoMetadata(noLocale, page, '/about');
    expect(m.alternates).toEqual({ canonical: 'https://acme.test/about' });
  });

  it('sets robots.index=false only when page.seo.noindex is true; omits the tag otherwise', () => {
    const noindexed = buildSeoMetadata(baseResolved, { ...page, seo: { ...page.seo, noindex: true } }, '/about');
    expect(noindexed.robots).toEqual({ index: false });
    const indexed = buildSeoMetadata(baseResolved, page, '/about');
    expect(indexed.robots).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/config/build-seo-metadata.test.ts`
Expected: FAIL — `description`/`alternates`/`robots` are all still `undefined` for the enabled+page case.

- [ ] **Step 3: Implement description/canonical/hreflang/robots**

Replace `packages/web/src/config/build-seo-metadata.ts`'s `buildSeoMetadata` function body (everything from `const metadataBase = ...` to the return) with:

```ts
  const metadataBase = safeUrl(site.url);
  const template = seo.titleTemplate.replace('{site}', brand.name);
  const title = page ? page.seo?.metaTitle || page.title || brand.name : { template, default: brand.name };
  const description = page?.seo?.metaDescription || seo.metaDescription || undefined;
  const canonical = path && site.url ? `${site.url}${path}` : undefined;
  const alternates = canonical
    ? { canonical, ...(site.locale ? { languages: { [site.locale]: canonical } } : {}) }
    : undefined;

  return {
    ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
    ...(metadataBase ? { metadataBase } : {}),
    title,
    ...(description ? { description } : {}),
    ...(alternates ? { alternates } : {}),
    ...(page?.seo?.noindex ? { robots: { index: false } } : {}),
  };
```

(Leave the `if (!seo.enabled) { ... }` branch and the `safeUrl`/imports above it unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/config/build-seo-metadata.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/config/build-seo-metadata.ts packages/web/src/config/build-seo-metadata.test.ts
git commit -m "feat(web): buildSeoMetadata description/canonical/hreflang/robots"
```

#### Increment D — enabled, with a page: Open Graph + Twitter card

- [ ] **Step 1: Append the failing tests**

Append to `packages/web/src/config/build-seo-metadata.test.ts`:

```ts
describe('buildSeoMetadata — plugin enabled, with a page (openGraph/twitter)', () => {
  const page = { title: 'About us', seo: { metaDescription: 'The about page' } };

  it('builds openGraph with title/description/url/siteName, type "website", and an image when one resolves', () => {
    const withImage: ResolvedPressConfig = {
      ...baseResolved,
      plugins: { ...baseResolved.plugins, seo: { ...DEFAULT_SEO_PLUGIN, ogImage: 'https://acme.test/og-default.png' } },
    };
    const m = buildSeoMetadata(withImage, page, '/about');
    expect(m.openGraph).toEqual({
      title: 'About us',
      description: 'The about page',
      url: 'https://acme.test/about',
      siteName: 'Acme',
      type: 'website',
      images: [{ url: 'https://acme.test/og-default.png' }],
    });
  });

  it('OG image fallback chain: page override wins over the site default', () => {
    const withSiteImage: ResolvedPressConfig = {
      ...baseResolved,
      plugins: { ...baseResolved.plugins, seo: { ...DEFAULT_SEO_PLUGIN, ogImage: 'https://acme.test/site-og.png' } },
    };
    const m = buildSeoMetadata(
      withSiteImage,
      { ...page, seo: { ...page.seo, ogImage: 'https://acme.test/page-og.png' } },
      '/about',
    );
    expect(m.openGraph?.images).toEqual([{ url: 'https://acme.test/page-og.png' }]);
  });

  it('omits openGraph.images when no OG image resolves anywhere', () => {
    const m = buildSeoMetadata(baseResolved, page, '/about');
    expect(m.openGraph?.images).toBeUndefined();
  });

  it('builds a twitter summary_large_image card with the same title/description/image, plus site when a handle is set', () => {
    const withHandle: ResolvedPressConfig = {
      ...baseResolved,
      plugins: {
        ...baseResolved.plugins,
        seo: { ...DEFAULT_SEO_PLUGIN, ogImage: 'https://acme.test/og.png', social: { sameAs: [], twitterHandle: '@acme' } },
      },
    };
    const m = buildSeoMetadata(withHandle, page, '/about');
    expect(m.twitter).toEqual({
      card: 'summary_large_image',
      site: '@acme',
      title: 'About us',
      description: 'The about page',
      images: ['https://acme.test/og.png'],
    });
  });

  it('omits twitter.site when no handle is configured', () => {
    const m = buildSeoMetadata(baseResolved, page, '/about');
    expect(m.twitter?.site).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/config/build-seo-metadata.test.ts`
Expected: FAIL — `openGraph`/`twitter` are both `undefined`.

- [ ] **Step 3: Implement Open Graph + Twitter**

Replace `packages/web/src/config/build-seo-metadata.ts`'s `buildSeoMetadata` function body one more time (final version — everything from `const metadataBase = ...` to the return):

```ts
  const metadataBase = safeUrl(site.url);
  const template = seo.titleTemplate.replace('{site}', brand.name);
  const title = page ? page.seo?.metaTitle || page.title || brand.name : { template, default: brand.name };
  const description = page?.seo?.metaDescription || seo.metaDescription || undefined;
  const ogImage = page?.seo?.ogImage || seo.ogImage;
  const canonical = path && site.url ? `${site.url}${path}` : undefined;
  const alternates = canonical
    ? { canonical, ...(site.locale ? { languages: { [site.locale]: canonical } } : {}) }
    : undefined;
  const ogTitle = typeof title === 'string' ? title : brand.name;

  return {
    ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
    ...(metadataBase ? { metadataBase } : {}),
    title,
    ...(description ? { description } : {}),
    ...(alternates ? { alternates } : {}),
    ...(page?.seo?.noindex ? { robots: { index: false } } : {}),
    openGraph: {
      title: ogTitle,
      ...(description ? { description } : {}),
      ...(canonical ? { url: canonical } : {}),
      siteName: brand.name,
      type: 'website',
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      ...(seo.social.twitterHandle ? { site: seo.social.twitterHandle } : {}),
      title: ogTitle,
      ...(description ? { description } : {}),
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
```

- [ ] **Step 4: Run the full test file + typecheck**

Run: `pnpm --filter @ogs-tech/press-web test src/config/build-seo-metadata.test.ts && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS — every increment's tests green together (Increments A–D), no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/config/build-seo-metadata.ts packages/web/src/config/build-seo-metadata.test.ts
git commit -m "feat(web): buildSeoMetadata openGraph + twitter card"
```

---

### Task 9: `buildJsonLd` + `SeoJsonLd`

**Files:**
- Create: `packages/web/src/plugins/seo/build-json-ld.ts`
- Create: `packages/web/src/plugins/seo/build-json-ld.test.ts`
- Create: `packages/web/src/plugins/seo/seo-json-ld.tsx`
- Create: `packages/web/src/plugins/seo/seo-json-ld.test.tsx`
- Modify: `packages/web/src/index.ts`

**Interfaces:**
- Consumes: `ResolvedPressConfig` (Task 6), `PageSeo` (Task 7).
- Produces: `buildJsonLd(resolved, page, path?): Record<string, unknown>[]`; `SeoJsonLd({ data }): JSX.Element` — both consumed by Task 12 (`page.tsx`'s `CatchAllPage`).

- [ ] **Step 1: Write the failing test for `buildJsonLd`**

Create `packages/web/src/plugins/seo/build-json-ld.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildJsonLd } from './build-json-ld';
import type { ResolvedPressConfig } from '../../config/types';
import { DEFAULT_LAYOUT } from '@ogs-tech/press-shared';
import { DEFAULT_EXAMPLE_PLUGIN } from '../example/default-example-plugin';
import { DEFAULT_SEO_PLUGIN } from './default-seo-plugin';

const baseResolved: ResolvedPressConfig = {
  urn: 'urn:site-setting:default',
  brand: { name: 'Acme', logo: 'https://cdn.test/logo.png', favicon: '/favicon.ico' },
  site: { url: 'https://acme.test', locale: 'en' },
  routes: { home: 'home' },
  theme: {
    name: 'default',
    colors: {
      primary: '#119350', accent: '#D9A12C', secondary: '#3D5CC2', ink: '#142036',
      surface: '#FAF8F3', muted: '#7A7E89', danger: '#C0392B', onPrimary: '#FFFFFF',
      border: 'rgba(20,32,54,0.12)',
    },
    fonts: {},
    radius: { xs: '6px', sm: '10px', md: '14px', lg: '20px' },
  },
  pageDefaults: { header: [], footer: [] },
  layout: DEFAULT_LAYOUT,
  plugins: { example: DEFAULT_EXAMPLE_PLUGIN, seo: DEFAULT_SEO_PLUGIN },
};

describe('buildJsonLd', () => {
  it('returns [] when the plugin is disabled', () => {
    const resolved = { ...baseResolved, plugins: { ...baseResolved.plugins, seo: { ...DEFAULT_SEO_PLUGIN, enabled: false } } };
    expect(buildJsonLd(resolved, { title: 'About' }, '/about')).toEqual([]);
  });

  it('builds an Organization node from brand/site identity', () => {
    const [organization] = buildJsonLd(baseResolved, null);
    expect(organization).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme',
      logo: 'https://cdn.test/logo.png',
      url: 'https://acme.test',
    });
    expect(organization.sameAs).toBeUndefined();
  });

  it('includes sameAs only when social links are present', () => {
    const resolved = {
      ...baseResolved,
      plugins: { ...baseResolved.plugins, seo: { ...DEFAULT_SEO_PLUGIN, social: { sameAs: ['https://twitter.com/acme'] } } },
    };
    const [organization] = buildJsonLd(resolved, null);
    expect(organization.sameAs).toEqual(['https://twitter.com/acme']);
  });

  it('builds a WebPage node with the page title/url/description and an isPartOf WebSite', () => {
    const [, webPage] = buildJsonLd(baseResolved, { title: 'About us', seo: { metaDescription: 'The about page' } }, '/about');
    expect(webPage).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'About us',
      url: 'https://acme.test/about',
      description: 'The about page',
      isPartOf: { '@type': 'WebSite', name: 'Acme', url: 'https://acme.test' },
    });
  });

  it('falls back to page.title then brand.name for the WebPage name, and omits url when path is absent', () => {
    const [, webPageNoOverride] = buildJsonLd(baseResolved, { title: 'About us' }, '/about');
    expect(webPageNoOverride.name).toBe('About us');
    const [, webPageNoPage] = buildJsonLd(baseResolved, null);
    expect(webPageNoPage.name).toBe('Acme');
    expect(webPageNoPage.url).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/seo/build-json-ld.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `buildJsonLd`**

Create `packages/web/src/plugins/seo/build-json-ld.ts`:

```ts
import type { ResolvedPressConfig } from '../../config/types';
import type { PageSeo } from '../../types/base';

type PageMeta = { title?: string; seo?: PageSeo } | null;

/**
 * Pure resolved-config + page → JSON-LD nodes (plugin-seo Spec §3). `[]` when
 * the plugin is disabled — mirrors buildSeoMetadata's fail-open gate so a
 * disabled site never emits structured data either. Pure — no I/O.
 */
export function buildJsonLd(resolved: ResolvedPressConfig, page: PageMeta, path?: string): Record<string, unknown>[] {
  const { brand, site, plugins } = resolved;
  if (!plugins.seo.enabled) return [];

  const url = path && site.url ? `${site.url}${path}` : undefined;
  const sameAs = plugins.seo.social.sameAs;

  const organization: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.name,
    ...(brand.logo ? { logo: brand.logo } : {}),
    ...(site.url ? { url: site.url } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };

  const description = page?.seo?.metaDescription || plugins.seo.metaDescription || undefined;
  const webPage: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page?.seo?.metaTitle || page?.title || brand.name,
    ...(url ? { url } : {}),
    ...(description ? { description } : {}),
    isPartOf: {
      '@type': 'WebSite',
      name: brand.name,
      ...(site.url ? { url: site.url } : {}),
    },
  };

  return [organization, webPage];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/seo/build-json-ld.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for `SeoJsonLd`**

Create `packages/web/src/plugins/seo/seo-json-ld.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SeoJsonLd } from './seo-json-ld';

describe('SeoJsonLd', () => {
  it('renders one <script type="application/ld+json"> per entry', () => {
    const html = renderToStaticMarkup(
      SeoJsonLd({ data: [{ '@type': 'Organization', name: 'Acme' }, { '@type': 'WebPage', name: 'About' }] }),
    );
    expect(html).toContain('<script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>');
    expect(html).toContain('<script type="application/ld+json">{"@type":"WebPage","name":"About"}</script>');
  });

  it('renders nothing for an empty array (disabled plugin)', () => {
    const html = renderToStaticMarkup(SeoJsonLd({ data: [] }));
    expect(html).toBe('');
  });

  it('escapes a literal "<" so free-form CMS text can never close the surrounding </script> tag', () => {
    const html = renderToStaticMarkup(SeoJsonLd({ data: [{ name: '</script><script>alert(1)</script>' }] }));
    expect(html).not.toContain('</script><script>alert(1)</script>');
    expect(html).toContain('\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/seo/seo-json-ld.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 7: Implement `SeoJsonLd`**

Create `packages/web/src/plugins/seo/seo-json-ld.tsx`:

```tsx
/**
 * Renders each `buildJsonLd` node as its own `<script type="application/ld+json">`
 * (plugin-seo Spec §3) — a plain server component, same precedent
 * `ExamplePlugin` set: no client interactivity. The `<` escape is deliberate:
 * `name`/`description` are free-form CMS text and must never be trusted not
 * to contain a literal `</script>` that would break out of the tag.
 */
export function SeoJsonLd({ data }: { data: Record<string, unknown>[] }) {
  return (
    <>
      {data.map((entry, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry).replace(/</g, '\\u003c') }}
        />
      ))}
    </>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/seo/seo-json-ld.test.tsx`
Expected: PASS

- [ ] **Step 9: Export both from `index.ts`**

In `packages/web/src/index.ts`, add after the `buildSeoMetadata` export:

```ts
export { buildSeoMetadata } from './config/build-seo-metadata';
export { buildJsonLd } from './plugins/seo/build-json-ld';
export { SeoJsonLd } from './plugins/seo/seo-json-ld';
```

- [ ] **Step 10: Run the full web suite + typecheck**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add packages/web/src/plugins/seo/build-json-ld.ts packages/web/src/plugins/seo/build-json-ld.test.ts packages/web/src/plugins/seo/seo-json-ld.tsx packages/web/src/plugins/seo/seo-json-ld.test.tsx packages/web/src/index.ts
git commit -m "feat(web): buildJsonLd + SeoJsonLd (Organization/WebPage structured data)"
```

---

### Task 10: Plugin visibility index — `seo` entry

**Files:**
- Modify: `packages/cms/server/src/lib/sync-plugin-entries.ts`
- Modify: `packages/cms/server/src/lib/sync-plugin-entries.test.ts`

**Interfaces:**
- Consumes: `site-setting.seo` attribute (Task 2).
- Produces: a `PLUGIN_DEFINITIONS` entry `{ id: 'seo', ... }`, mirrored into the read-only `plugin::press-cms.plugin` collection on every boot.

- [ ] **Step 1: Write the failing tests**

In `packages/cms/server/src/lib/sync-plugin-entries.test.ts`, add two `it`s inside `describe('syncPluginEntries (base-plugin Spec §4)', ...)`, after the `'mirrors the live Site Settings enabled value on create'` test:

```ts
  it('creates the seo entry with defaultEnabled true when Site Settings is null (plugin-seo Spec §4)', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await syncPluginEntries(strapi);
    const seoEntry = creates.find((c) => c.data.pluginId === 'seo');
    expect(seoEntry?.data).toEqual({
      pluginId: 'seo',
      label: 'SEO & Social',
      configHost: 'site-setting.seo',
      enabled: true,
    });
  });

  it('mirrors the live Site Settings seo.enabled value on create', async () => {
    const { strapi, creates } = fakeStrapi({ seo: { enabled: false } });
    await syncPluginEntries(strapi);
    const seoEntry = creates.find((c) => c.data.pluginId === 'seo');
    expect(seoEntry?.data.enabled).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/sync-plugin-entries.test.ts`
Expected: FAIL — `PLUGIN_DEFINITIONS` has no `seo` entry yet, `seoEntry` is `undefined`.

- [ ] **Step 3: Add the `seo` definition + populate**

In `packages/cms/server/src/lib/sync-plugin-entries.ts`, update `SiteSettingSnapshot`:

```ts
interface SiteSettingSnapshot {
  examplePlugin?: { enabled?: boolean } | null;
  seo?: { enabled?: boolean } | null;
}
```

Add the entry to `PLUGIN_DEFINITIONS`:

```ts
export const PLUGIN_DEFINITIONS: PluginDefinition[] = [
  {
    id: 'example',
    label: 'Example Plugin',
    configHost: 'site-setting.examplePlugin',
    defaultEnabled: false,
    readEnabled: (site) => site?.examplePlugin?.enabled,
  },
  {
    id: 'seo',
    label: 'SEO & Social',
    configHost: 'site-setting.seo',
    defaultEnabled: true,
    readEnabled: (site) => site?.seo?.enabled,
  },
];
```

Update the `findFirst` populate call inside `syncPluginEntries`:

```ts
  const site = (await strapi
    .documents(SITE_SETTING_UID as any)
    .findFirst({ populate: { examplePlugin: true, seo: true } as any })) as SiteSettingSnapshot | null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/sync-plugin-entries.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cms/server/src/lib/sync-plugin-entries.ts packages/cms/server/src/lib/sync-plugin-entries.test.ts
git commit -m "feat(cms): mirror the seo plugin into the plugin visibility index"
```

---

### Task 11: `getSitemapEntries`

**Files:**
- Modify: `packages/web/src/get-page-slugs.ts`
- Modify: `packages/web/src/get-page-slugs.test.ts`
- Modify: `packages/web/src/index.ts`

**Interfaces:**
- Produces: `getSitemapEntries(): Promise<{ slug: string; noindex: boolean }[]>` — consumed by Task 12's `app/sitemap.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/web/src/get-page-slugs.test.ts` (after the existing `describe('getStaticPageParams', ...)` block, same file — `stubFetch` is already defined at the top of this file):

```ts
describe('getSitemapEntries', () => {
  it('returns slug + noindex for every published page', async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { slug: 'home', seo: { noindex: false } },
          { slug: 'about', seo: null },
          { slug: 'internal', seo: { noindex: true } },
        ],
      }),
    }));
    expect(await getSitemapEntries()).toEqual([
      { slug: 'home', noindex: false },
      { slug: 'about', noindex: false },
      { slug: 'internal', noindex: true },
    ]);
  });

  it('skips entries with a missing or empty slug', async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ seo: null }, { slug: '' }] }),
    }));
    expect(await getSitemapEntries()).toEqual([]);
  });

  it('fails to empty on a non-OK response', async () => {
    stubFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    expect(await getSitemapEntries()).toEqual([]);
  });

  it('fails to empty on a network error', async () => {
    stubFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    expect(await getSitemapEntries()).toEqual([]);
  });
});
```

Add `getSitemapEntries` to the import line at the top of the file:

```ts
import { getPageSlugs, getSitemapEntries, getStaticPageParams } from './get-page-slugs';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/get-page-slugs.test.ts`
Expected: FAIL — `getSitemapEntries` is not exported.

- [ ] **Step 3: Implement `getSitemapEntries`**

Append to `packages/web/src/get-page-slugs.ts` (after `getStaticPageParams`):

```ts
/**
 * Fetches slug + noindex for every PUBLISHED page (plugin-seo Spec §4) — the
 * data source for app/sitemap.ts. FAIL-TO-EMPTY like `getPageSlugs`: any
 * failure yields [], and an empty sitemap is never a build failure.
 */
export async function getSitemapEntries(): Promise<{ slug: string; noindex: boolean }[]> {
  try {
    const init: RevalidateInit = { next: { revalidate: 60 } };
    const res = await fetch(`${CMS_URL}/api/pages`, init);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data: Array<{ slug?: string; seo?: { noindex?: boolean } | null }> | null;
    };
    return (json.data ?? [])
      .filter((p): p is { slug: string; seo?: { noindex?: boolean } | null } => typeof p?.slug === 'string' && p.slug.length > 0)
      .map((p) => ({ slug: p.slug, noindex: p.seo?.noindex ?? false }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/get-page-slugs.test.ts`
Expected: PASS

- [ ] **Step 5: Export it**

In `packages/web/src/index.ts`, change:

```ts
export { getPageSlugs, getStaticPageParams } from './get-page-slugs';
```

to:

```ts
export { getPageSlugs, getStaticPageParams, getSitemapEntries } from './get-page-slugs';
```

- [ ] **Step 6: Run the full web suite + typecheck**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/get-page-slugs.ts packages/web/src/get-page-slugs.test.ts packages/web/src/index.ts
git commit -m "feat(web): getSitemapEntries"
```

---

### Task 12: Wire the host templates — `layout.tsx`, `page.tsx`, `sitemap.ts`, `robots.ts`

**Files:**
- Modify: `packages/web/templates/host/app/layout.tsx`
- Modify: `packages/web/templates/host/app/[[...slug]]/page.tsx`
- Create: `packages/web/templates/host/app/sitemap.ts`
- Create: `packages/web/templates/host/app/robots.ts`

**Interfaces:**
- Consumes: `buildSeoMetadata`, `buildJsonLd`, `SeoJsonLd`, `getSitemapEntries` (Tasks 8, 9, 11).

Host templates are excluded from `packages/web`'s own tsconfig/vitest (Global Constraints) — there is no automated test for this task. Verification is `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck` (confirms every function/type these templates import still has the signature they call) plus the manual smoke test in Task 13.

- [ ] **Step 1: Update `layout.tsx`**

In `packages/web/templates/host/app/layout.tsx`, change the import and the `generateMetadata` export:

```tsx
import { buildSeoMetadata, buildThemeStyle, getSiteConfig, ExamplePlugin } from '@ogs-tech/press-web';
```

```tsx
// Brand defaults, no page: title.template (or brand.name when the SEO plugin
// is disabled) + favicon. Fetched at runtime from the CMS (ISR ~60s) so
// editor changes appear without a redeploy. No `path` — this fallback only
// fires for routes outside the catch-all (e.g. error boundaries), where a
// page-specific canonical doesn't apply.
export async function generateMetadata() {
  return buildSeoMetadata(await getSiteConfig(buildTime), null);
}
```

The rest of the file (fonts, `RootLayout`, the `ExamplePlugin` mount) is unchanged.

- [ ] **Step 2: Update `page.tsx`**

Replace `packages/web/templates/host/app/[[...slug]]/page.tsx` in full:

```tsx
import { notFound, permanentRedirect } from 'next/navigation';
import {
  buildSeoMetadata,
  buildJsonLd,
  SeoJsonLd,
  getPage,
  getSiteConfig,
  getStaticPageParams,
  TreeRenderer,
} from '@ogs-tech/press-web';
import { customBlocks } from '../../press.blocks';
import { buildTime } from '../../press-config';

// ISR: published pages are prerendered at build — generateStaticParams lists
// their slugs from the CMS — and revalidated every 60s (mirrors getPage/
// getSiteConfig). dynamicParams stays at its default (true), so a slug added
// after the build — or every slug when the CMS is unreachable at build (the
// list fails to empty) — renders on-demand and caches. /home → / and notFound()
// run inside the render, unchanged under ISR.
export const revalidate = 60;

export async function generateStaticParams() {
  return getStaticPageParams(buildTime.routes.home);
}

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

/**
 * Catch-all segments → CMS slug. The site root ('/') has no segments and maps to
 * the home slug declared in press.config (`buildTime.routes.home`). Routing reads
 * the build-time anchor only, so the /home → / redirect stays deterministic and
 * independent of CMS availability.
 */
function slugFor(segments?: string[]): string {
  return (segments ?? []).join('/') || buildTime.routes.home;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  // Next dedupes identical fetches within a request + the ISR Data Cache serves
  // getSiteConfig across requests, so this resolves to a single cached round-trip
  // even though the layout also calls it.
  const [site, page] = await Promise.all([getSiteConfig(buildTime), getPage(slugFor(slug))]);
  // `path` stays undefined when there is no page — a 404 response must never
  // carry a self-referencing canonical (plugin-seo Spec §3 call sites).
  const path = page ? `/${(slug ?? []).join('/')}` : undefined;
  return buildSeoMetadata(site, page ? { title: page.title, seo: page.seo } : null, path);
}

export default async function CatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const path = (slug ?? []).join('/');

  // The home page is canonical at the root only. A direct hit on its slug
  // (e.g. /home) 308-redirects to '/', so home has no public slug URL.
  if (path && path === buildTime.routes.home) permanentRedirect('/');

  const [site, page] = await Promise.all([
    getSiteConfig(buildTime),
    getPage(path || buildTime.routes.home),
  ]);
  if (!page) notFound();

  // notFound() above guarantees `page` is non-null here, so the JSON-LD
  // WebPage node always has real page data (plugin-seo Spec §3).
  const urlPath = `/${path}`;
  return (
    <>
      {site.plugins.seo.enabled && (
        <SeoJsonLd data={buildJsonLd(site, { title: page.title, seo: page.seo }, urlPath)} />
      )}
      <TreeRenderer body={page.body} site={site} components={customBlocks} />
    </>
  );
}
```

- [ ] **Step 3: Create `sitemap.ts`**

Create `packages/web/templates/host/app/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next';
import { getSiteConfig, getSitemapEntries } from '@ogs-tech/press-web';
import { buildTime } from '../press-config';

/**
 * Published-page sitemap (plugin-seo Spec §4) — [] when the SEO plugin is
 * disabled or the site has no URL configured. Pages with `noindex: true` are
 * excluded — a page telling crawlers not to index it shouldn't be advertised
 * in the sitemap either.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSiteConfig(buildTime);
  if (!site.plugins.seo.enabled || !site.site.url) return [];
  const entries = await getSitemapEntries();
  return entries
    .filter((entry) => !entry.noindex)
    .map((entry) => ({
      url: `${site.site.url}${entry.slug === buildTime.routes.home ? '/' : `/${entry.slug}`}`,
    }));
}
```

- [ ] **Step 4: Create `robots.ts`**

Create `packages/web/templates/host/app/robots.ts`:

```ts
import type { MetadataRoute } from 'next';
import { getSiteConfig } from '@ogs-tech/press-web';
import { buildTime } from '../press-config';

/**
 * Never blocks the site (plugin-seo Spec §4) — a fail-to-empty CMS state must
 * never silently turn into "hide from search engines"; that failure mode is
 * categorically worse than "no rich metadata." Only adds the sitemap pointer
 * when the SEO plugin is enabled and the site has a URL. Per-page blocking
 * stays exactly the `noindex` meta tag from buildSeoMetadata.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteConfig(buildTime);
  const base: MetadataRoute.Robots = { rules: { userAgent: '*', allow: '/' } };
  if (!site.plugins.seo.enabled || !site.site.url) return base;
  return { ...base, sitemap: `${site.site.url}/sitemap.xml` };
}
```

- [ ] **Step 5: Run the full web suite + typecheck**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS (these four template files aren't part of either run — Global Constraints — but this confirms nothing else regressed).

- [ ] **Step 6: Commit**

```bash
git add packages/web/templates/host/app/layout.tsx "packages/web/templates/host/app/[[...slug]]/page.tsx" packages/web/templates/host/app/sitemap.ts packages/web/templates/host/app/robots.ts
git commit -m "feat(web): wire buildSeoMetadata/SeoJsonLd/sitemap/robots into the host template"
```

---

### Task 13: Changeset, CLAUDE.md, and final verification

**Files:**
- Create: `.changeset/plugin-seo.md`
- Modify: `CLAUDE.md`

**Interfaces:** none (this task ships documentation + release metadata; no code interface changes).

- [ ] **Step 1: Add the changeset**

Create `.changeset/plugin-seo.md`:

```md
---
'@ogs-tech/press-web': major
'@ogs-tech/press-cms': minor
---

feat: Plugin/SEO — head metadata (ranking + social share), enabled by default

The engine's second real plugin, built on the Base/Plugin framework: rich
`<head>` metadata as an opt-in `PressPlugin`, unlike `example`/cookie-consent
wired through a pure metadata builder (`buildSeoMetadata`) feeding
`generateMetadata()`, not a mounted component.

Site Settings gains a `seo` component (title template, default description,
default share image, and a nested social-profiles group feeding Twitter's
`twitter:site` and the site's Organization JSON-LD `sameAs`); the `page`
content-type gains its own `seo` component (per-page title/description/
share-image overrides + a `noindex` toggle) — the first schema change to
`page` since it shipped.

`buildSeoMetadata` produces title (a Next `title.template`/`title.default`
pair site-wide, a plain override string per page), description, a
self-referencing canonical + single-locale hreflang stub, per-page
`noindex`, and Open Graph + Twitter card metadata — all fail-open: a
disabled plugin, an empty Site URL, or even a malformed one never crashes a
render, and reproduces the pre-plugin title+favicon-only shape exactly.
JSON-LD (`Organization` + `WebPage`) can't travel through Next's `Metadata`
object, so it ships as a small mounted `<SeoJsonLd>` (the `ExamplePlugin`
mount precedent), with `</script>`-injection escaping since the underlying
text is free-form CMS content. Two new host routes, `sitemap.xml` and
`robots.txt`, round out ranking support — the sitemap excludes `noindex`
pages, and `robots.txt` never blocks the site outright (only adds the
sitemap pointer when enabled), by design.

**Ships enabled by default** — diverging from the `example`/cookie-consent
"ships disabled" precedent: SEO is core product surface a fresh adopter
site should have on day one, not a demo requiring an opt-in step to
discover.

BREAKING (press-web): `ResolvedPressConfig.plugins` gains the required `seo`
key; `Page` gains `seo`; `buildMetadata` is renamed to `buildSeoMetadata`
with an extended signature (`(resolved, page, path?)`).

press-cms is additive only: three new components, one Site Settings
attribute, one page attribute, two controller populate changes, one
`PLUGIN_DEFINITIONS` entry.
```

- [ ] **Step 2: Update CLAUDE.md's "Engine plugins" section**

In `CLAUDE.md`, replace the bullet that currently reads:

```
- **RESERVED, currently unimplemented** — the same "declared ahead of components"
  precedent as `preset-template` in the CMS palette. Cookie consent was plugin
  #1 (config component + banner + client-only consent cookie) but was retired:
  Site Settings no longer carries any cookie-consent surface, and
  `ResolvedPressConfig` has no `plugins` key until the next plugin lands. Expect
  Plugin/Legal and Plugin/SEO to be the next ones to install their own entities
  and wire through this same contract — 1 CMS component + 1 mapper + 1 key +
  1 mount line, same cost as the first.
```

with:

```
- **Two real plugins ship today.** `example` (`plugins/example/`) is the
  synthetic reference wiring, disabled by default, mounted as a component in
  `layout.tsx` — the canonical "1 CMS component + 1 mapper + 1 key + 1 mount
  line" cost every plugin pays. `seo` (`plugins/seo/`) is the first plugin
  with real product value, **enabled by default** (a deliberate divergence —
  SEO is core surface, not a demo): a `preset-config.seo` Site Settings
  component (+ nested `preset-config.seo-social`) plus a `preset-config.seo-page`
  per-page override component feed `buildSeoMetadata` (replaces the old
  `buildMetadata`, drives `generateMetadata()`) and `buildJsonLd` (feeds a
  mounted `<SeoJsonLd>`, since structured data can't travel through Next's
  `Metadata` object) — plus two new host routes, `sitemap.xml` and
  `robots.txt`. A read-only `plugin::press-cms.plugin` collection type
  (`PLUGIN_DEFINITIONS` in `sync-plugin-entries.ts`, synced every boot) gives
  Content-Manager visibility into every installed plugin's `enabled` state —
  a view, never a second source of truth. Cookie consent was retired before
  either of these shipped; Legal is expected to be the next plugin to install
  its own entities and wire through this same contract.
```

- [ ] **Step 3: Run the full monorepo verification**

```bash
pnpm -r test
pnpm -r --if-present typecheck
pnpm --filter @ogs-tech/press-cms test:ts:back
```

Expected: PASS across `cli`, `web`, `cms` — every test from Tasks 1–12, plus the pre-existing suite (nothing regressed).

- [ ] **Step 4: Commit**

```bash
git add .changeset/plugin-seo.md CLAUDE.md
git commit -m "docs: add changeset and CLAUDE.md entry for Plugin/SEO"
```

- [ ] **Step 5: Hand off manual smoke test to the user**

This step is NOT automatable — say so explicitly and stop here rather than claiming it's done. Ask the user to:

1. Force-recreate the playground so it picks up the new CMS schema: `pnpm exec tsx scripts/create-playground.ts`.
2. Run `pnpm dev` and open the Strapi admin (`:1337/admin`).
3. In Site Settings → SEO, confirm the component renders (title template, description, share image, nested "Redes sociais" sub-section) and is enabled by default.
4. Open a page's edit view, confirm its "SEO" section (title/description/image overrides + "Hide from search engines") renders.
5. On the public site (`:3000`), view-source a page and confirm: `<title>` follows the template, `<meta name="description">`, `<link rel="canonical">`, Open Graph + Twitter tags, and two `<script type="application/ld+json">` blocks (Organization + WebPage) are all present.
6. Toggle a page's "Hide from search engines" on, confirm `<meta name="robots" content="noindex">` appears and the page drops out of `/sitemap.xml`.
7. Visit `/sitemap.xml` and `/robots.txt` directly and confirm they render.
8. Toggle Site Settings → SEO → Enabled off, confirm the page's `<head>` reverts to just `<title>` + favicon (no description/OG/Twitter/JSON-LD), and `/sitemap.xml`/`/robots.txt` degrade to `[]` / allow-all-no-sitemap.
9. Confirm the page still responds fast on a second load (ISR intact — no route forced dynamic).

Report back with the result before considering this plan fully verified.

---
