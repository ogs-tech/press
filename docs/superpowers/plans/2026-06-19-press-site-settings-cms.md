# Site Settings from the CMS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move whitelabel identity, SEO, and editable theme values out of `press.config.ts` into a Strapi "Site Settings" single type, fetched at runtime so a non-technical editor changes them in the admin with **no code deploy**.

**Architecture:** A new CMS single type `plugin::press-cms.site-setting` (with three engine components for grouping) is the sole source of truth for identity/SEO/theme values. A new web resolver `getSiteConfig(buildTime)` fetches it (ISR ~60s) and a pure `mapSiteSettings(buildTime, cms)` maps it into the existing `ResolvedPressConfig` shape — so `buildMetadata`/`buildThemeStyle` are byte-unchanged. `press.config.ts` shrinks to build-time anchors only (`routes`, `theme.name`, `theme.fonts`), resolved into a new `BuildTimeConfig`. The old `theme` content-type and `seedDefaultTheme` are removed; a Site Settings record is seeded **empty** on bootstrap.

**Tech Stack:** TypeScript, Next.js App Router (RSC), Strapi 5.48, Vitest, pnpm workspaces + turbo, changesets.

## Global Constraints

- **Breaking change, shipped as a `minor`** for both `@ogs-tech/press-web` and `@ogs-tech/press-cms` (pre-1.0: `0.x` minor carries breaking changes; recorded in the changeset body, never a `major`/`1.0.0`).
- **CMS is the sole source of truth for identity/SEO.** There is **no `press.config.ts` fallback** for `name`/`logo`/`favicon`/`url`/`locale` or any SEO field. Empty CMS field → empty value (`''`/`undefined`). Never backfill from any other source (AC2, AC3).
- **Theme values are the one exception:** an unset color/radius resolves over the engine constant `DEFAULT_THEME` (`packages/web/src/config/default-theme.ts`) per key — never empty, never an adopter config value (AC4).
- **`buildMetadata` and `buildThemeStyle` are byte-unchanged.** A diff shows a new input source and a shrunk `resolveConfig`, not new logic inside them (AC5).
- **Build-time anchors stay deterministic and CMS-independent:** `routes.home` (and the `/home → /` redirect) and `next/font` optimization behave identically to today (AC8).
- **`CMS_URL`** = `process.env.CMS_URL ?? 'http://localhost:1337'` (the established pattern in `get-page.ts`).
- **Graceful CMS-down:** any fetch failure (non-OK, network throw, malformed body) maps identically to an empty record — engine-default theme + empty identity, no crash (AC6).
- All code, comments, and identifiers in **English**.
- Engine-owned files (`packages/web/templates/host/*`, materialized `.press/web/*`) are regenerated, never hand-edited by adopters.

---

## File Structure

**CMS (`packages/cms/server/src/`) — added:**
- `components/seo.json`, `components/theme-colors.json`, `components/theme-radius.json` — engine components for grouped editing.
- `content-types/site-setting/schema.json` — the single type.
- `controllers/site-setting.ts` — reads the one record, returns `{ data }`.
- `lib/seed-site-setting.ts` (+ `.test.ts`) — idempotent empty-record seed.

**CMS — modified:**
- `lib/inject-components.ts` (+ `.test.ts`) — register the 3 new `press.*` components.
- `content-types/index.ts` — drop `theme`, add `site-setting`.
- `controllers/index.ts` — add `site-setting`.
- `routes/content-api/index.ts` — add `GET /site-setting`.
- `bootstrap.ts` — call `seedSiteSetting` instead of `seedDefaultTheme`.

**CMS — removed:**
- `content-types/theme/schema.json`, `lib/seed-default-theme.ts`, `lib/seed-default-theme.test.ts`.

**Web (`packages/web/src/`) — added:**
- `map-site-settings.ts` (+ `.test.ts`) — pure CMS-shape → `ResolvedPressConfig`.
- `get-site-config.ts` (+ `.test.ts`) — the only new CMS-aware code.

**Web — modified:**
- `config/types.ts` — add `BuildTimeConfig` + `SiteSettingsData`; shrink `PressConfig`.
- `config/resolve-config.ts` (+ `.test.ts`) — return `BuildTimeConfig`.
- `config/build-metadata.test.ts`, `config/build-theme-style.test.ts` — fixtures via literals (functions untouched).
- `config/define-config.test.ts` — fixture uses a valid shrunk config.
- `index.ts` — export `getSiteConfig` + type `BuildTimeConfig`.

**Templates / adopter configs — modified:**
- `packages/web/templates/host/press-config.ts` — export `buildTime`.
- `packages/web/templates/host/app/layout.tsx`, `.../app/[[...slug]]/page.tsx` — async, runtime fetch.
- `packages/cli/templates/project/packages/web/config.ts`, repo-root `press.config.ts`, `apps/playground/packages/web/config.ts` — shrunk shape.

**Delivery:** `.changeset/press-site-settings-cms.md`.

---

## Task 1: Engine components (seo, theme-colors, theme-radius) + registration

**Files:**
- Create: `packages/cms/server/src/components/seo.json`
- Create: `packages/cms/server/src/components/theme-colors.json`
- Create: `packages/cms/server/src/components/theme-radius.json`
- Modify: `packages/cms/server/src/lib/inject-components.ts`
- Test: `packages/cms/server/src/lib/inject-components.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: three registered components — `press.seo`, `press.theme-colors`, `press.theme-radius` — each with attribute shapes consumed by Task 2's single type and Task 6's `mapSiteSettings`. Color keys: `primary, accent, secondary, ink, surface, muted, danger, onPrimary, border`. Radius keys: `xs, sm, md, lg`. SEO keys: `titleTemplate, defaultTitle, defaultDescription` (string) + `defaultOgImage` (single image media).

- [ ] **Step 1: Write the failing test (extend the existing file with an `injectComponents` block)**

Append to `packages/cms/server/src/lib/inject-components.test.ts` (keep the existing `admitCustomBlocks` block and its imports; add `injectComponents` to the import line):

```ts
import { admitCustomBlocks, injectComponents } from './inject-components';
```

```ts
describe('injectComponents', () => {
  const makeStrapi = () => {
    const components = new Map<string, any>();
    const strapi = {
      get: (key: string) => (key === 'components' ? components : undefined),
      log: { warn() {}, info() {}, debug() {}, error() {} },
    } as any;
    return { strapi, components };
  };

  it('registers every engine press.* component as a component model', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    for (const uid of ['press.hero', 'press.seo', 'press.theme-colors', 'press.theme-radius']) {
      expect(components.get(uid)?.modelType).toBe('component');
      expect(components.get(uid)?.uid).toBe(uid);
    }
  });

  it('skips a component already present in the registry (idempotent injection)', () => {
    const { strapi, components } = makeStrapi();
    components.set('press.hero', { uid: 'press.hero', preexisting: true });
    injectComponents({ strapi });
    expect(components.get('press.hero')).toEqual({ uid: 'press.hero', preexisting: true });
    expect(components.get('press.seo')?.modelType).toBe('component'); // others still injected
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-cms exec vitest run server/src/lib/inject-components.test.ts`
Expected: FAIL — `injectComponents` registers only `press.hero`, so `press.seo` etc. are `undefined`.

- [ ] **Step 3: Create the three component JSON files**

`packages/cms/server/src/components/seo.json`:

```json
{
  "collectionName": "components_press_seos",
  "info": { "displayName": "SEO", "description": "SEO defaults served at runtime by the press engine" },
  "options": {},
  "attributes": {
    "titleTemplate": { "type": "string" },
    "defaultTitle": { "type": "string" },
    "defaultDescription": { "type": "string" },
    "defaultOgImage": { "type": "media", "multiple": false, "allowedTypes": ["images"] }
  }
}
```

`packages/cms/server/src/components/theme-colors.json`:

```json
{
  "collectionName": "components_press_theme_colors",
  "info": { "displayName": "Theme Colors", "description": "Theme colour token overrides served at runtime by the press engine" },
  "options": {},
  "attributes": {
    "primary": { "type": "string" },
    "accent": { "type": "string" },
    "secondary": { "type": "string" },
    "ink": { "type": "string" },
    "surface": { "type": "string" },
    "muted": { "type": "string" },
    "danger": { "type": "string" },
    "onPrimary": { "type": "string" },
    "border": { "type": "string" }
  }
}
```

`packages/cms/server/src/components/theme-radius.json`:

```json
{
  "collectionName": "components_press_theme_radii",
  "info": { "displayName": "Theme Radius", "description": "Theme corner-radius token overrides served at runtime by the press engine" },
  "options": {},
  "attributes": {
    "xs": { "type": "string" },
    "sm": { "type": "string" },
    "md": { "type": "string" },
    "lg": { "type": "string" }
  }
}
```

- [ ] **Step 4: Register the new components in `inject-components.ts`**

In `packages/cms/server/src/lib/inject-components.ts`, add the imports below the existing `heroSchema` import:

```ts
import heroSchema from '../components/hero.json';
import seoSchema from '../components/seo.json';
import themeColorsSchema from '../components/theme-colors.json';
import themeRadiusSchema from '../components/theme-radius.json';
import { toGlobalId } from './global-id';
```

Replace the `ENGINE_COMPONENTS` array with:

```ts
const ENGINE_COMPONENTS: Array<{ category: string; name: string; schema: Record<string, unknown> }> = [
  { category: 'press', name: 'hero', schema: heroSchema as Record<string, unknown> },
  { category: 'press', name: 'seo', schema: seoSchema as Record<string, unknown> },
  { category: 'press', name: 'theme-colors', schema: themeColorsSchema as Record<string, unknown> },
  { category: 'press', name: 'theme-radius', schema: themeRadiusSchema as Record<string, unknown> },
];
```

(`toGlobalId('component_press.theme-colors')` → `ComponentPressThemeColors` — valid PascalCase; hyphens/dots are split on, verified in `global-id.ts`.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-cms exec vitest run server/src/lib/inject-components.test.ts`
Expected: PASS (both new `injectComponents` cases + the unchanged `admitCustomBlocks` cases).

- [ ] **Step 6: Commit**

```bash
git add packages/cms/server/src/components/seo.json packages/cms/server/src/components/theme-colors.json packages/cms/server/src/components/theme-radius.json packages/cms/server/src/lib/inject-components.ts packages/cms/server/src/lib/inject-components.test.ts
git commit -m "feat(cms): add engine components for Site Settings (seo, theme-colors, theme-radius)"
```

---

## Task 2: `site-setting` single type + content-types registration

**Files:**
- Create: `packages/cms/server/src/content-types/site-setting/schema.json`
- Modify: `packages/cms/server/src/content-types/index.ts`

**Interfaces:**
- Consumes: the `press.seo` / `press.theme-colors` / `press.theme-radius` components (Task 1).
- Produces: content-type UID `plugin::press-cms.site-setting` (`kind: singleType`, `draftAndPublish: false`) with attributes `name, url, locale` (string), `logo, favicon` (single image media), `seo, themeColors, themeRadius` (non-repeatable components). This UID is consumed by Task 3 (controller/route), Task 4 (seed), and Task 6/7 (web read).

- [ ] **Step 1: Create the single-type schema**

`packages/cms/server/src/content-types/site-setting/schema.json`:

```json
{
  "kind": "singleType",
  "collectionName": "site_setting",
  "info": {
    "singularName": "site-setting",
    "pluralName": "site-settings",
    "displayName": "Site Settings",
    "description": "Whitelabel identity, SEO, and theme values served at runtime by the press engine"
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
    "themeRadius": { "type": "component", "repeatable": false, "component": "press.theme-radius" }
  }
}
```

- [ ] **Step 2: Register the single type (and drop `theme`) in `content-types/index.ts`**

Replace the entire contents of `packages/cms/server/src/content-types/index.ts` with:

```ts
import page from './page/schema.json';
import siteSetting from './site-setting/schema.json';

export default {
  page: { schema: page },
  'site-setting': { schema: siteSetting },
};
```

(The `theme` import is removed here — its file and seed are deleted in Task 5.)

- [ ] **Step 3: Verify the backend typechecks**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS — no type errors. (`./theme/schema.json` is no longer imported; it still exists on disk until Task 5, which is fine.)

> **Risk note (from spec §2): plugin component registration on a content-type is the biggest unknown.** The boot-time proof is Task 12 (`pnpm play` → the "Site Settings" admin screen renders the grouped SEO/Colors/Radius sections). If Strapi rejects the injected-component references at boot, the documented fallback is **flat prefixed scalar fields** on the single type — `seoTitleTemplate`, `colorPrimary`, …, `radiusXs`, … (all `string`) — with the grouping reconstructed inside `mapSiteSettings` (Task 6) instead of in the schema. Choosing the fallback changes only this schema file and the field-access paths in `mapSiteSettings`; the resolver signature and every other task are unaffected.

- [ ] **Step 4: Commit**

```bash
git add packages/cms/server/src/content-types/site-setting/schema.json packages/cms/server/src/content-types/index.ts
git commit -m "feat(cms): add site-setting single type, register it (drop theme registration)"
```

---

## Task 3: `site-setting` controller + content-api route

**Files:**
- Create: `packages/cms/server/src/controllers/site-setting.ts`
- Modify: `packages/cms/server/src/controllers/index.ts`
- Modify: `packages/cms/server/src/routes/content-api/index.ts`

**Interfaces:**
- Consumes: `plugin::press-cms.site-setting` (Task 2).
- Produces: public route `GET /api/site-setting` (auth-less, mirroring `/pages`) returning `{ data: <single record or null> }` with `populate: '*'`. Consumed by Task 7 (`getSiteConfig` fetches `/api/site-setting?populate=*`).

- [ ] **Step 1: Create the controller**

`packages/cms/server/src/controllers/site-setting.ts`:

```ts
import type { Core } from '@strapi/strapi';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * Engine-owned single-type controller. Reads the one always-live Site Settings
 * record (draftAndPublish: false → no published filter) with every relation and
 * component populated, and returns it under `{ data }` — the wire shape the web
 * resolver (`getSiteConfig`) maps. A fresh DB returns the empty seeded record;
 * the editor fills it in the admin (Spec §3, §5).
 */
const siteSetting = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx: any) {
    const data = await strapi.documents(SITE_SETTING_UID as any).findFirst({ populate: '*' });
    ctx.body = { data };
  },
});

export default siteSetting;
```

- [ ] **Step 2: Wire the controller into the registry**

Replace the contents of `packages/cms/server/src/controllers/index.ts` with:

```ts
import controller from './controller';
import page from './page';
import schema from './schema';
import siteSetting from './site-setting';

export default { controller, page, schema, 'site-setting': siteSetting };
```

- [ ] **Step 3: Add the route**

In `packages/cms/server/src/routes/content-api/index.ts`, add the `/site-setting` route after the `/press/schema` line, inside the `routes` array:

```ts
    { method: 'GET', path: '/press/schema', handler: 'schema.get', config: { auth: false, prefix: '' } },
    { method: 'GET', path: '/site-setting', handler: 'site-setting.find', config: { auth: false, prefix: '' } },
```

- [ ] **Step 4: Verify the backend typechecks**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cms/server/src/controllers/site-setting.ts packages/cms/server/src/controllers/index.ts packages/cms/server/src/routes/content-api/index.ts
git commit -m "feat(cms): expose GET /api/site-setting (public, populate=*)"
```

---

## Task 4: `seedSiteSetting` + bootstrap switch

**Files:**
- Create: `packages/cms/server/src/lib/seed-site-setting.ts`
- Test: `packages/cms/server/src/lib/seed-site-setting.test.ts`
- Modify: `packages/cms/server/src/bootstrap.ts`

**Interfaces:**
- Consumes: `plugin::press-cms.site-setting` (Task 2).
- Produces: `SITE_SETTING_UID = 'plugin::press-cms.site-setting'` and `async seedSiteSetting(strapi: Core.Strapi): Promise<void>` — creates exactly one **empty** record on a fresh DB, idempotent across runs. Called by `bootstrap.ts`.

- [ ] **Step 1: Write the failing test (mirrors `seed-default-theme.test.ts`)**

`packages/cms/server/src/lib/seed-site-setting.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { seedSiteSetting, SITE_SETTING_UID } from './seed-site-setting';

/** Minimal Document-Service fake: a mutable count + a recording create(). */
function fakeStrapi(initialCount = 0) {
  let count = initialCount;
  const creates: Array<{ data: unknown }> = [];
  const strapi = {
    documents: (uid: string) => {
      expect(uid).toBe(SITE_SETTING_UID); // helper must target the single-type UID
      return {
        count: async () => count,
        create: async (params: { data: unknown }) => {
          count += 1;
          creates.push(params);
          return params.data;
        },
      };
    },
  } as any;
  return { strapi, creates, size: () => count };
}

describe('seedSiteSetting', () => {
  it('seeds exactly one EMPTY record on a fresh DB', async () => {
    const { strapi, creates, size } = fakeStrapi(0);
    await seedSiteSetting(strapi);
    expect(creates).toEqual([{ data: {} }]); // empty: no defaults duplicated in the CMS
    expect(size()).toBe(1);
  });

  it('does nothing when a record already exists (idempotent)', async () => {
    const { strapi, creates, size } = fakeStrapi(1);
    await seedSiteSetting(strapi);
    expect(creates).toEqual([]);
    expect(size()).toBe(1);
  });

  it('is idempotent across repeated runs — never creates a second record', async () => {
    const { strapi, creates, size } = fakeStrapi(0);
    await seedSiteSetting(strapi);
    await seedSiteSetting(strapi);
    await seedSiteSetting(strapi);
    expect(creates).toHaveLength(1);
    expect(size()).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-cms exec vitest run server/src/lib/seed-site-setting.test.ts`
Expected: FAIL — `seed-site-setting` module does not exist.

- [ ] **Step 3: Write the seed**

`packages/cms/server/src/lib/seed-site-setting.ts`:

```ts
import type { Core } from '@strapi/strapi';

/** UID of the engine's Site Settings single type (plugin name `press-cms`). */
export const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * Seeds exactly one EMPTY Site Settings record on a fresh DB (Spec §5).
 * Idempotent: if a record already exists, does nothing — a re-run (every
 * bootstrap) leaves exactly one record, never two. Empty is intentional: no
 * defaults are duplicated in the CMS. The editor fills identity/SEO on first
 * registration; unset theme tokens resolve over DEFAULT_THEME at read time
 * (`mapSiteSettings`).
 */
export async function seedSiteSetting(strapi: Core.Strapi): Promise<void> {
  const existing = await strapi.documents(SITE_SETTING_UID).count({});
  if (existing > 0) return;
  await strapi.documents(SITE_SETTING_UID).create({ data: {} });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-cms exec vitest run server/src/lib/seed-site-setting.test.ts`
Expected: PASS.

- [ ] **Step 5: Switch bootstrap to call `seedSiteSetting`**

Replace the contents of `packages/cms/server/src/bootstrap.ts` with:

```ts
import type { Core } from '@strapi/strapi';
import { seedSiteSetting } from './lib/seed-site-setting';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  await seedSiteSetting(strapi);
};

export default bootstrap;
```

- [ ] **Step 6: Verify the backend still typechecks (seedDefaultTheme is now unused but still on disk until Task 5)**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/cms/server/src/lib/seed-site-setting.ts packages/cms/server/src/lib/seed-site-setting.test.ts packages/cms/server/src/bootstrap.ts
git commit -m "feat(cms): seed one empty Site Settings record on bootstrap (idempotent)"
```

---

## Task 5: Remove the `theme` content-type, `seedDefaultTheme`, and its test

**Files:**
- Delete: `packages/cms/server/src/content-types/theme/schema.json`
- Delete: `packages/cms/server/src/lib/seed-default-theme.ts`
- Delete: `packages/cms/server/src/lib/seed-default-theme.test.ts`

**Interfaces:**
- Consumes: nothing (Task 4 already removed the only remaining caller of `seedDefaultTheme`, and Task 2 removed the `theme` registration).
- Produces: the "Themes" admin menu is gone; the only theme-editing surface is now Site Settings (AC7).

- [ ] **Step 1: Confirm there are no remaining references**

Run: `grep -rn "seed-default-theme\|seedDefaultTheme\|THEME_UID\|content-types/theme" packages/cms/server/src`
Expected: **no output** (all references were rewired in Tasks 2 and 4).

- [ ] **Step 2: Delete the three files**

```bash
git rm packages/cms/server/src/content-types/theme/schema.json packages/cms/server/src/lib/seed-default-theme.ts packages/cms/server/src/lib/seed-default-theme.test.ts
```

- [ ] **Step 3: Run the full CMS suite + backend typecheck**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS — `seed-default-theme.test.ts` is gone; `inject-components`, `serialize-schema`, `dz-populate`, and `seed-site-setting` tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cms)!: remove theme content-type and seedDefaultTheme (Themes menu gone)"
```

---

## Task 6: `BuildTimeConfig` + `SiteSettingsData` types + pure `mapSiteSettings`

**Files:**
- Modify: `packages/web/src/config/types.ts`
- Create: `packages/web/src/map-site-settings.ts`
- Test: `packages/web/src/map-site-settings.test.ts`

**Interfaces:**
- Consumes: `ResolvedPressConfig`, `ThemeColors`, `ThemeRadius`, `ThemeFonts`, `ThemeName` (existing, unchanged here), `DEFAULT_THEME`.
- Produces:
  - `interface BuildTimeConfig { routes: { home: string }; theme: { name: ThemeName; fonts: Partial<ThemeFonts> } }`
  - `interface SiteSettingsData` (CMS-shape, all optional) consumed by Task 7.
  - `function mapSiteSettings(buildTime: BuildTimeConfig, cms: SiteSettingsData | null): ResolvedPressConfig` — pure; consumed by Task 7 and the migrated pure-function tests (Task 8).

This task is **purely additive** — `resolveConfig` and `PressConfig` are untouched, so every existing test stays green.

- [ ] **Step 1: Add the new types to `config/types.ts`**

Append to `packages/web/src/config/types.ts` (do **not** change `PressConfig` or `ResolvedPressConfig` yet):

```ts
/**
 * Build-time-only slice resolved from press.config.ts. Deterministic and
 * CMS-independent: `routes` (routing + the /home → / redirect), `theme.name`
 * (the <html data-theme> selector + ThemeName guard), and `theme.fonts` (which
 * next/font must know at build time). Identity, SEO, and theme colour/radius
 * VALUES are layered on at runtime by getSiteConfig (site-settings-cms spec §6).
 */
export interface BuildTimeConfig {
  routes: { home: string };
  theme: { name: ThemeName; fonts: Partial<ThemeFonts> };
}

/** A Strapi 5 media object (flattened), only the field the engine consumes. */
interface CmsMedia {
  url?: string;
}

/**
 * The Site Settings single-type payload as returned by GET /api/site-setting
 * (Strapi 5 flattened, populate=*). EVERY field is optional: an unfilled record
 * and an unreachable CMS both map as if absent (site-settings-cms spec §3.2, §7).
 */
export interface SiteSettingsData {
  name?: string;
  url?: string;
  locale?: string;
  logo?: CmsMedia | null;
  favicon?: CmsMedia | null;
  seo?: {
    titleTemplate?: string;
    defaultTitle?: string;
    defaultDescription?: string;
    defaultOgImage?: CmsMedia | null;
  } | null;
  themeColors?: Partial<ThemeColors> | null;
  themeRadius?: Partial<ThemeRadius> | null;
}
```

- [ ] **Step 2: Write the failing test**

`packages/web/src/map-site-settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapSiteSettings } from './map-site-settings';
import type { BuildTimeConfig } from './config/types';

const buildTime: BuildTimeConfig = {
  routes: { home: 'home' },
  theme: { name: 'default', fonts: { body: 'Inter' } },
};

describe('mapSiteSettings', () => {
  it('maps a null CMS to engine-default theme + empty identity/SEO + build-time anchors', () => {
    const r = mapSiteSettings(buildTime, null);
    // identity/SEO empty — no inheritance, no fallback (AC2/AC3)
    expect(r.brand.name).toBe('');
    expect(r.brand.logo).toBeUndefined();
    expect(r.brand.favicon).toBe('');
    expect(r.site.url).toBe('');
    expect(r.site.locale).toBe('');
    expect(r.seo.titleTemplate).toBe('');
    expect(r.seo.defaultTitle).toBe('');
    expect(r.seo.defaultDescription).toBe('');
    expect(r.seo.defaultOgImage).toBeUndefined();
    // theme over DEFAULT_THEME (AC4)
    expect(r.theme.colors.primary).toBe('#119350');
    expect(r.theme.radius.md).toBe('14px');
    // anchors from buildTime (AC8)
    expect(r.routes.home).toBe('home');
    expect(r.theme.name).toBe('default');
    expect(r.theme.fonts).toEqual({ body: 'Inter' });
  });

  it('maps an empty {} CMS identically to null', () => {
    expect(mapSiteSettings(buildTime, {})).toEqual(mapSiteSettings(buildTime, null));
  });

  it('maps a full CMS payload verbatim and lets theme overrides win per key', () => {
    const r = mapSiteSettings(buildTime, {
      name: 'Acme',
      url: 'https://acme.test',
      locale: 'en',
      seo: { titleTemplate: '%s | Acme', defaultTitle: 'Acme', defaultDescription: 'An Acme site.' },
      themeColors: { primary: '#ff5500' },
      themeRadius: { md: '2px' },
    });
    expect(r.brand.name).toBe('Acme');
    expect(r.site.url).toBe('https://acme.test');
    expect(r.site.locale).toBe('en');
    expect(r.seo.titleTemplate).toBe('%s | Acme');
    expect(r.seo.defaultDescription).toBe('An Acme site.');
    expect(r.theme.colors.primary).toBe('#ff5500'); // override wins
    expect(r.theme.colors.accent).toBe('#D9A12C'); // sibling keeps DEFAULT_THEME
    expect(r.theme.radius.md).toBe('2px');
    expect(r.theme.radius.lg).toBe('20px'); // sibling keeps DEFAULT_THEME
  });

  it('keeps an empty CMS field empty — never backfills (the core anti-drift case)', () => {
    const r = mapSiteSettings(buildTime, { name: 'Acme' }); // url/locale/seo absent
    expect(r.brand.name).toBe('Acme');
    expect(r.site.url).toBe('');         // NOT backfilled
    expect(r.seo.defaultTitle).toBe(''); // NOT backfilled from name (unlike old resolveConfig)
  });

  it('resolves media URLs absolute against CMS_URL; missing media → undefined', () => {
    const r = mapSiteSettings(buildTime, {
      logo: { url: '/uploads/logo.png' },
      favicon: { url: 'https://cdn.test/fav.ico' },
      seo: { defaultOgImage: { url: '/uploads/og.png' } },
    });
    expect(r.brand.logo).toBe('http://localhost:1337/uploads/logo.png');
    expect(r.brand.favicon).toBe('https://cdn.test/fav.ico'); // already absolute → kept
    expect(r.seo.defaultOgImage).toBe('http://localhost:1337/uploads/og.png');
    const empty = mapSiteSettings(buildTime, {});
    expect(empty.brand.logo).toBeUndefined();
    expect(empty.seo.defaultOgImage).toBeUndefined();
  });

  it('always takes theme.name / theme.fonts / routes from buildTime, never the CMS payload', () => {
    const r = mapSiteSettings(buildTime, { themeColors: { primary: '#000000' } } as any);
    expect(r.theme.name).toBe(buildTime.theme.name);
    expect(r.theme.fonts).toEqual(buildTime.theme.fonts);
    expect(r.routes).toEqual(buildTime.routes);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web exec vitest run src/map-site-settings.test.ts`
Expected: FAIL — `map-site-settings` module does not exist.

- [ ] **Step 4: Write `mapSiteSettings`**

`packages/web/src/map-site-settings.ts`:

```ts
import type { BuildTimeConfig, ResolvedPressConfig, SiteSettingsData } from './config/types';
import { DEFAULT_THEME } from './config/default-theme';

// Same module-level pattern as get-page.ts: read once, default to local Strapi.
const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/** Resolves a Strapi media url absolute against CMS_URL; undefined when absent. */
function mediaUrl(media: { url?: string } | null | undefined): string | undefined {
  const url = media?.url;
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${CMS_URL}${url}`;
}

/**
 * Pure CMS-shape → ResolvedPressConfig (site-settings-cms spec §3.2). Same input
 * → same output, no I/O, no mutation — unit-testable without a server, safe in an
 * RSC. Identity/SEO come ONLY from the CMS: a present value is used as-is, a
 * missing value stays empty ('' / undefined) — NO inheritance, so "empty CMS
 * field" unambiguously means empty (AC2/AC3). Theme colours/radii resolve over
 * DEFAULT_THEME per key — the engine's shipped base, never empty (AC4). Build-time
 * anchors (routes, theme.name, theme.fonts) come from `buildTime` (AC8). The
 * output is the exact shape buildMetadata/buildThemeStyle already accept.
 */
export function mapSiteSettings(
  buildTime: BuildTimeConfig,
  cms: SiteSettingsData | null,
): ResolvedPressConfig {
  const c = cms ?? {};
  const seo = c.seo ?? {};
  return {
    brand: {
      name: c.name ?? '',
      logo: mediaUrl(c.logo),
      favicon: mediaUrl(c.favicon) ?? '',
    },
    site: {
      url: c.url ?? '',
      locale: c.locale ?? '',
    },
    seo: {
      titleTemplate: seo.titleTemplate ?? '',
      defaultTitle: seo.defaultTitle ?? '',
      defaultDescription: seo.defaultDescription ?? '',
      defaultOgImage: mediaUrl(seo.defaultOgImage),
    },
    routes: buildTime.routes,
    theme: {
      name: buildTime.theme.name,
      colors: { ...DEFAULT_THEME.colors, ...(c.themeColors ?? {}) },
      fonts: buildTime.theme.fonts,
      radius: { ...DEFAULT_THEME.radius, ...(c.themeRadius ?? {}) },
    },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web exec vitest run src/map-site-settings.test.ts`
Expected: PASS (all seven cases).

- [ ] **Step 6: Run the full web suite (nothing else changed — all green)**

Run: `pnpm --filter @ogs-tech/press-web test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/config/types.ts packages/web/src/map-site-settings.ts packages/web/src/map-site-settings.test.ts
git commit -m "feat(web): add BuildTimeConfig + SiteSettingsData types and pure mapSiteSettings"
```

---

## Task 7: `getSiteConfig` resolver + public export

**Files:**
- Create: `packages/web/src/get-site-config.ts`
- Test: `packages/web/src/get-site-config.test.ts`
- Modify: `packages/web/src/index.ts`

**Interfaces:**
- Consumes: `mapSiteSettings` (Task 6), `BuildTimeConfig`, `ResolvedPressConfig`, `SiteSettingsData`.
- Produces: `async getSiteConfig(buildTime: BuildTimeConfig): Promise<ResolvedPressConfig>` — fetches `${CMS_URL}/api/site-setting?populate=*` with ISR `{ next: { revalidate: 60 } }`; any failure maps as an empty record. Exported from `index.ts` and consumed by Task 10's templates.

- [ ] **Step 1: Write the failing test (fetch stubbed)**

`packages/web/src/get-site-config.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSiteConfig } from './get-site-config';
import type { BuildTimeConfig } from './config/types';

const buildTime: BuildTimeConfig = { routes: { home: 'home' }, theme: { name: 'default', fonts: {} } };

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: (...args: any[]) => Promise<any>) {
  const mock = vi.fn(impl);
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('getSiteConfig', () => {
  it('maps a 200 body into the resolved config', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ data: { name: 'Acme' } }) }));
    const r = await getSiteConfig(buildTime);
    expect(r.brand.name).toBe('Acme');
    expect(r.theme.colors.primary).toBe('#119350'); // DEFAULT_THEME base
  });

  it('passes the ISR revalidate option to the Site Settings endpoint (AC11)', async () => {
    const mock = stubFetch(async () => ({ ok: true, json: async () => ({ data: null }) }));
    await getSiteConfig(buildTime);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/api/site-setting?populate=*'),
      { next: { revalidate: 60 } },
    );
  });

  it('maps a non-OK response as an empty record (AC6)', async () => {
    stubFetch(async () => ({ ok: false, json: async () => ({ data: { name: 'IGNORED' } }) }));
    const r = await getSiteConfig(buildTime);
    expect(r.brand.name).toBe(''); // empty identity, not the response body
    expect(r.theme.colors.primary).toBe('#119350');
  });

  it('maps a thrown fetch as an empty record — CMS down (AC6)', async () => {
    stubFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    const r = await getSiteConfig(buildTime);
    expect(r.brand.name).toBe('');
    expect(r.theme.radius.md).toBe('14px'); // DEFAULT_THEME base
  });

  it('maps malformed JSON as an empty record (AC6)', async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    }));
    const r = await getSiteConfig(buildTime);
    expect(r.brand.name).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web exec vitest run src/get-site-config.test.ts`
Expected: FAIL — `get-site-config` module does not exist.

- [ ] **Step 3: Write `getSiteConfig`**

`packages/web/src/get-site-config.ts`:

```ts
import type { BuildTimeConfig, ResolvedPressConfig, SiteSettingsData } from './config/types';
import { mapSiteSettings } from './map-site-settings';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

// Next.js augments RequestInit with `next.revalidate` at the host; the engine
// package typechecks with only @types/node, so name the option locally.
type RevalidateInit = RequestInit & { next?: { revalidate?: number } };

/**
 * Fetches the Site Settings single type and maps it into the full
 * ResolvedPressConfig, combining it with the build-time anchors (routes,
 * theme.name, theme.fonts). ISR-cached (~60s) so editor changes appear without a
 * deploy. Any failure — non-OK, network error, malformed body — maps as if the
 * record were EMPTY: engine-default theme (DEFAULT_THEME) + empty identity. There
 * is NO press.config fallback for identity/SEO by design (spec §0). The site
 * renders (unbranded, default-themed) rather than crashing (AC6).
 *
 * Multi-tenant seam: a later `tenantKey` argument selects a row from a `Site`
 * collection with the SAME return shape — no consumer changes (AC9).
 */
export async function getSiteConfig(buildTime: BuildTimeConfig): Promise<ResolvedPressConfig> {
  try {
    const init: RevalidateInit = { next: { revalidate: 60 } };
    const res = await fetch(`${CMS_URL}/api/site-setting?populate=*`, init);
    const data = res.ok ? ((await res.json()) as { data: SiteSettingsData | null }).data : null;
    return mapSiteSettings(buildTime, data);
  } catch {
    return mapSiteSettings(buildTime, null);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web exec vitest run src/get-site-config.test.ts`
Expected: PASS (all five cases).

- [ ] **Step 5: Export `getSiteConfig` and `BuildTimeConfig` from `index.ts`**

In `packages/web/src/index.ts`, add the value export after the `getPage` line and add `BuildTimeConfig` to the type export line:

```ts
export { getPage } from './get-page';
export { getSiteConfig } from './get-site-config';
```

```ts
export type { PressConfig, ResolvedPressConfig, BuildTimeConfig, ThemeName } from './config/types';
```

- [ ] **Step 6: Verify the web package typechecks and the full suite is green**

Run: `pnpm --filter @ogs-tech/press-web typecheck && pnpm --filter @ogs-tech/press-web test`
Expected: PASS — `mapSiteSettings`/`getSiteConfig` compile under `types: ["node"]` (the `RevalidateInit` alias avoids depending on Next's global augmentation), and all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/get-site-config.ts packages/web/src/get-site-config.test.ts packages/web/src/index.ts
git commit -m "feat(web): add getSiteConfig resolver (ISR fetch, graceful CMS-down) and export it"
```

---

## Task 8: Decouple `buildMetadata` / `buildThemeStyle` tests from `resolveConfig`

**Files:**
- Modify: `packages/web/src/config/build-metadata.test.ts`
- Modify: `packages/web/src/config/build-theme-style.test.ts`

**Interfaces:**
- Consumes: `ResolvedPressConfig` (constructed as plain literals).
- Produces: nothing new — `build-metadata.ts` and `build-theme-style.ts` are **not touched** (AC5). This is a refactor-only task: it removes the two test files' reliance on `resolveConfig` as a `ResolvedPressConfig` factory, so Task 9's shrink doesn't break them. All assertions stay identical; the suite stays green.

> Why now: Task 9 changes `resolveConfig` to return `BuildTimeConfig`. These two tests currently call `resolveConfig({ brand, site, seo })` and pass the result to `buildMetadata`/`buildThemeStyle`. Building the fixture as a `ResolvedPressConfig` literal decouples them while everything is still green.

- [ ] **Step 1: Rewrite the `build-metadata.test.ts` fixture as a literal**

Replace the top of `packages/web/src/config/build-metadata.test.ts` (the import of `resolveConfig` and the `resolved` constant) so it no longer calls `resolveConfig`. Keep `import { buildMetadata } from './build-metadata';` and **all `it(...)` assertions unchanged**:

```ts
import { describe, expect, it } from 'vitest';
import { buildMetadata } from './build-metadata';
import type { ResolvedPressConfig } from './types';

const resolved: ResolvedPressConfig = {
  brand: { name: 'Acme', favicon: '/favicon.ico' },
  site: { url: 'https://acme.test', locale: 'en' },
  seo: {
    titleTemplate: '%s | Acme',
    defaultTitle: 'Acme',
    defaultDescription: 'An Acme content site.',
    defaultOgImage: 'https://acme.test/og.png',
  },
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
};
```

The one previously-`resolveConfig`-derived case — `omits description when the resolved default is empty` (which used `resolveConfig({ brand: { name: 'Acme' } })`) — replace its body to build the empty-description config as a literal so it no longer calls `resolveConfig`:

```ts
  it('omits description when the resolved default is empty', () => {
    const noDesc: ResolvedPressConfig = { ...resolved, seo: { ...resolved.seo, defaultDescription: '' } };
    const m = buildMetadata(noDesc, null);
    expect(m.description).toBeUndefined();
    expect(m.openGraph?.description).toBeUndefined();
  });
```

(`defaultOgImage` is now an explicit absolute literal `'https://acme.test/og.png'`, matching the existing assertion `m.openGraph?.images).toEqual([{ url: 'https://acme.test/og.png' }])`.)

- [ ] **Step 2: Rewrite the `build-theme-style.test.ts` fixtures as literals**

Replace the top of `packages/web/src/config/build-theme-style.test.ts` and the per-test overrides. Keep `import { buildThemeStyle } from './build-theme-style';` and **all assertions unchanged**:

```ts
import { describe, expect, it } from 'vitest';
import { buildThemeStyle } from './build-theme-style';
import { DEFAULT_THEME } from './default-theme';
import type { ResolvedPressConfig } from './types';

const baseResolved: ResolvedPressConfig = {
  brand: { name: 'Acme', favicon: '/favicon.ico' },
  site: { url: '', locale: 'en' },
  seo: { titleTemplate: '%s', defaultTitle: 'Acme', defaultDescription: '', defaultOgImage: undefined },
  routes: { home: 'home' },
  theme: {
    name: 'default',
    colors: { ...DEFAULT_THEME.colors },
    fonts: {},
    radius: { ...DEFAULT_THEME.radius },
  },
};

/** Build a ResolvedPressConfig with theme overrides merged over DEFAULT_THEME. */
const withTheme = (over: Partial<ResolvedPressConfig['theme']>): ResolvedPressConfig => ({
  ...baseResolved,
  theme: { ...baseResolved.theme, ...over },
});
```

Then update the five tests to use `baseResolved` / `withTheme` instead of `resolveConfig(...)`, keeping every `expect(...)` line as-is:

```ts
  it('emits a :root block with the Default colour, space, type, and radius tokens', () => {
    const css = buildThemeStyle(baseResolved);
    // ...unchanged assertions...
  });

  it('applies a colour override', () => {
    const css = buildThemeStyle(withTheme({ colors: { ...DEFAULT_THEME.colors, primary: '#ff5500' } }));
    expect(css).toContain('--press-color-primary: #ff5500;');
  });

  it('applies a radius override', () => {
    const css = buildThemeStyle(withTheme({ radius: { ...DEFAULT_THEME.radius, md: '2px' } }));
    expect(css).toContain('--press-radius-md: 2px;');
  });

  it('omits font variables when not overridden', () => {
    const css = buildThemeStyle(baseResolved);
    // ...unchanged assertions...
  });

  it('emits a font variable only for the overridden family', () => {
    const css = buildThemeStyle(withTheme({ fonts: { body: 'Inter' } }));
    expect(css).toContain('--press-font-body: Inter;');
    expect(css).not.toContain('--press-font-display:');
  });

  it('never emits the theme name as a token', () => {
    const css = buildThemeStyle(baseResolved);
    // ...unchanged assertions...
  });
```

- [ ] **Step 3: Run both test files — still green (functions unchanged)**

Run: `pnpm --filter @ogs-tech/press-web exec vitest run src/config/build-metadata.test.ts src/config/build-theme-style.test.ts`
Expected: PASS — every assertion unchanged; only fixture construction moved off `resolveConfig`.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/config/build-metadata.test.ts packages/web/src/config/build-theme-style.test.ts
git commit -m "test(web): build pure-function fixtures as literals (decouple from resolveConfig)"
```

---

## Task 9: Shrink `PressConfig` + `resolveConfig` → `BuildTimeConfig` (BREAKING)

**Files:**
- Modify: `packages/web/src/config/types.ts`
- Modify: `packages/web/src/config/resolve-config.ts`
- Modify: `packages/web/src/config/resolve-config.test.ts`
- Modify: `packages/web/src/config/define-config.test.ts`

**Interfaces:**
- Consumes: `BuildTimeConfig`, `DEFAULT_THEME`, `ThemeName`, `ThemeFonts`.
- Produces:
  - `PressConfig` shrunk to `{ routes?: { home?: string }; theme?: ThemeName | { name?: ThemeName; fonts?: Partial<ThemeFonts> } }` — passing `brand`/`site`/`seo`/`theme.colors`/`theme.radius` is now a type error at `defineConfig` (AC2).
  - `resolveConfig(config: PressConfig): BuildTimeConfig` — the deterministic build-time slice. Consumed by Task 10's `press-config.ts` template (`export const buildTime = resolveConfig(userConfig)`).
  - `ResolvedPressConfig`, `ThemeColors`, `ThemeRadius`, `ThemeFonts`, `ThemeName` remain (used by `DEFAULT_THEME`, `mapSiteSettings`, `buildThemeStyle`).

- [ ] **Step 1: Shrink `PressConfig` in `config/types.ts`**

Replace the `PressConfig` interface (lines covering its current `brand`/`site`/`seo`/`routes`/`theme`) with:

```ts
/**
 * Adopter-facing build-time anchors (site-settings-cms spec §6). Identity, SEO,
 * and theme colour/radius VALUES no longer live here — they are edited in the CMS
 * "Site Settings" single type and fetched at runtime by getSiteConfig. This file
 * keeps ONLY what the build needs deterministically: the home-route slug, the
 * theme NAME (the <html data-theme> selector + ThemeName guard), and theme FONTS
 * (which next/font must know at build time). A destructive change to ThemeName
 * fails tsc at the defineConfig call site.
 */
export interface PressConfig {
  routes?: {
    /** Slug of the page served at the site root ('/'). Defaults to 'home'. */
    home?: string;
  };
  theme?:
    | ThemeName
    | {
        name?: ThemeName;
        fonts?: Partial<ThemeFonts>;
      };
}
```

Leave `ThemeName`, `ThemeColors`, `ThemeFonts`, `ThemeRadius`, `ResolvedPressConfig`, `BuildTimeConfig`, and `SiteSettingsData` exactly as they are.

- [ ] **Step 2: Rewrite `resolve-config.ts` to return `BuildTimeConfig`**

Replace the entire contents of `packages/web/src/config/resolve-config.ts` with:

```ts
import { DEFAULT_THEME } from './default-theme';
import type { BuildTimeConfig, PressConfig } from './types';

/**
 * Normalizes the `theme` union (string sugar | object | absent) into the
 * build-time theme slice: `name` (defaulted to DEFAULT_THEME.name) and `fonts`
 * (overrides only — font defaults live in next/font, so an absent key is
 * intentional). Colour/radius VALUES are NOT here anymore; they resolve at
 * runtime over DEFAULT_THEME in mapSiteSettings.
 */
function resolveTheme(theme: PressConfig['theme']): BuildTimeConfig['theme'] {
  const t = typeof theme === 'string' ? { name: theme } : theme ?? {};
  return {
    name: t.name ?? DEFAULT_THEME.name,
    fonts: { ...(t.fonts ?? {}) },
  };
}

/**
 * Resolves press.config.ts into the deterministic BUILD-TIME slice
 * (site-settings-cms spec §6). Pure: same input → same output, no I/O, no
 * mutation — safe to hold as an immutable module constant under RSC/SSR. The full
 * ResolvedPressConfig (identity/SEO/theme values) is produced at runtime by
 * getSiteConfig, NOT here.
 */
export function resolveConfig(config: PressConfig): BuildTimeConfig {
  return {
    routes: { home: config.routes?.home ?? 'home' },
    theme: resolveTheme(config.theme),
  };
}
```

- [ ] **Step 3: Rewrite `resolve-config.test.ts` for the `BuildTimeConfig` shape**

Replace the entire contents of `packages/web/src/config/resolve-config.test.ts` with (drops all brand/site/seo/colors/radius cases; keeps routes + theme name/fonts):

```ts
import { describe, expect, it } from 'vitest';
import { resolveConfig } from './resolve-config';

describe('resolveConfig', () => {
  it('defaults routes.home to "home" when omitted', () => {
    expect(resolveConfig({}).routes.home).toBe('home');
  });

  it('lets the adopter override routes.home', () => {
    expect(resolveConfig({ routes: { home: 'landing' } }).routes.home).toBe('landing');
  });

  it('defaults theme.name to "default" when theme is absent', () => {
    const r = resolveConfig({});
    expect(r.theme.name).toBe('default');
    expect(r.theme.fonts).toEqual({}); // fonts default via next/font, not config
  });

  it('resolves the string form and the object form identically', () => {
    expect(resolveConfig({ theme: 'default' }).theme).toEqual(resolveConfig({ theme: { name: 'default' } }).theme);
  });

  it('keeps font overrides verbatim and defaults the name', () => {
    const r = resolveConfig({ theme: { fonts: { body: 'Inter' } } });
    expect(r.theme.name).toBe('default');
    expect(r.theme.fonts).toEqual({ body: 'Inter' });
  });

  it('returns only the build-time slice — no brand/site/seo keys', () => {
    const r = resolveConfig({ theme: 'default' }) as Record<string, unknown>;
    expect(Object.keys(r).sort()).toEqual(['routes', 'theme']);
  });
});
```

- [ ] **Step 4: Fix the `define-config.test.ts` fixture (the old `{ brand: ... }` is now invalid)**

Replace the `it(...)` body in `packages/web/src/config/define-config.test.ts`:

```ts
  it('returns the same config object (identity at runtime)', () => {
    const cfg = { theme: 'default' as const };
    expect(defineConfig(cfg)).toBe(cfg);
  });
```

- [ ] **Step 5: Run the full web suite + typecheck**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS — `resolve-config`/`define-config` updated, `build-metadata`/`build-theme-style` already decoupled (Task 8), `map-site-settings`/`get-site-config` green.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/config/types.ts packages/web/src/config/resolve-config.ts packages/web/src/config/resolve-config.test.ts packages/web/src/config/define-config.test.ts
git commit -m "feat(web)!: shrink PressConfig to build-time anchors; resolveConfig returns BuildTimeConfig"
```

---

## Task 10: Update adopter config call sites (CLI template + repo-root sample + playground)

**Files:**
- Modify: `packages/cli/templates/project/packages/web/config.ts`
- Modify: `press.config.ts` (repo root)
- Modify: `apps/playground/packages/web/config.ts`

**Interfaces:**
- Consumes: the shrunk `PressConfig` (Task 9).
- Produces: three adopter configs that compile against the new `PressConfig` — `routes` + `theme.name` only, no `brand`/`site`/`seo`/theme values. The CLI template is what `create-press` scaffolds; the playground config is exercised by Task 12.

> These three files are the only adopter-facing `defineConfig(...)` call sites in the repo. None is in a tsc `include` that ran in Task 9, so the repo was not red between tasks — but they must move to the new shape so new projects (CLI) and the dogfood (playground) compile and so the repo sample is honest.

- [ ] **Step 1: Update the CLI scaffold template**

Replace the entire contents of `packages/cli/templates/project/packages/web/config.ts` with:

```ts
// press.config.ts — Project zone (repo root). BUILD-TIME anchors only: the home
// route, the theme NAME (<html data-theme> + ThemeName guard), and theme FONTS
// (which next/font must know at build time). Identity, SEO, and theme colour/
// radius VALUES live in the CMS "Site Settings" single type now — edit them in
// the admin (they are fetched at runtime, no redeploy). The engine READS this
// file but NEVER rewrites it.
import { defineConfig } from '@ogs-tech/press-web';

export default defineConfig({
  routes: {
    // Slug of the page served at the site root ('/'). The home page lives only
    // at '/'; a direct hit on this slug redirects there.
    home: 'home',
  },
  // Appearance selection (not values). The string form selects the embedded
  // theme; a destructive change to ThemeName fails tsc right here. Override the
  // optimized font families with `theme: { fonts: { body: 'Inter' } }`.
  theme: 'default',
});
```

- [ ] **Step 2: Update the repo-root sample to match**

Replace the entire contents of the repo-root `press.config.ts` with the same content as Step 1.

- [ ] **Step 3: Strip the playground config**

Replace the entire contents of `apps/playground/packages/web/config.ts` with the same content as Step 1.

- [ ] **Step 4: Verify no removed fields remain in any adopter config**

Run: `grep -nE "brand:|site:|seo:|colors:|radius:" press.config.ts packages/cli/templates/project/packages/web/config.ts apps/playground/packages/web/config.ts`
Expected: **no output**.

- [ ] **Step 5: Commit**

```bash
git add press.config.ts packages/cli/templates/project/packages/web/config.ts apps/playground/packages/web/config.ts
git commit -m "feat!: move adopter configs to build-time anchors (Site Settings owns identity/SEO/theme values)"
```

---

## Task 11: Materialized templates — `press-config.ts`, `layout.tsx`, `page.tsx`

**Files:**
- Modify: `packages/web/templates/host/press-config.ts`
- Modify: `packages/web/templates/host/app/layout.tsx`
- Modify: `packages/web/templates/host/app/[[...slug]]/page.tsx`

**Interfaces:**
- Consumes: `resolveConfig` (now → `BuildTimeConfig`), `getSiteConfig`, `buildMetadata`, `buildThemeStyle`, `getPage`, `BlockRenderer` from `@ogs-tech/press-web`.
- Produces: a host that resolves `buildTime` from `press.config.ts` at build time and fetches the full `ResolvedPressConfig` at runtime via `getSiteConfig(buildTime)`. These templates are engine-owned; they're verified by materialization (Task 12), not unit tests. `materialize.test.ts` only asserts file existence, so it stays green.

- [ ] **Step 1: Rename the materialized constant `config` → `buildTime`**

Replace the entire contents of `packages/web/templates/host/press-config.ts` with:

```ts
// .press/web/press-config.ts (materialized) — resolves the adopter's web-zone
// BUILD-TIME anchors ONCE into an immutable module constant: routes, theme.name
// (the <html data-theme> selector + ThemeName guard), and theme.fonts (which
// next/font must know at build time). Identity, SEO, and theme colour/radius
// VALUES are NOT here — they are fetched at runtime from the CMS "Site Settings"
// single type by getSiteConfig (site-settings-cms spec §6). Engine-owned and
// rewritten every run — never hand-edited.
import userConfig from '../../packages/web/config';
import { resolveConfig } from '@ogs-tech/press-web';

export const buildTime = resolveConfig(userConfig);
```

- [ ] **Step 2: Rewrite `layout.tsx` to fetch Site Settings at runtime**

Replace the entire contents of `packages/web/templates/host/app/layout.tsx` with:

```tsx
import { Archivo, Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import { buildMetadata, buildThemeStyle, getSiteConfig } from '@ogs-tech/press-web';
import '@ogs-tech/press-web/theme.css';
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
        <header>
          <a href="/">
            {site.brand.logo ? <img src={site.brand.logo} alt="" /> : null}
            <span>{site.brand.name}</span>
          </a>
        </header>
        <main>{children}</main>
        <footer>
          <small>
            {site.brand.name} · {new Date().getFullYear()}
          </small>
        </footer>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Rewrite `[[...slug]]/page.tsx` to fetch both site + page**

Replace the entire contents of `packages/web/templates/host/app/[[...slug]]/page.tsx` with:

```tsx
import { notFound, permanentRedirect } from 'next/navigation';
import { BlockRenderer, buildMetadata, getPage, getSiteConfig } from '@ogs-tech/press-web';
import { customBlocks } from '../../press.blocks';
import { buildTime } from '../../press-config';

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
  return buildMetadata(site, page ? { title: page.title } : null);
}

export default async function CatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const path = (slug ?? []).join('/');

  // The home page is canonical at the root only. A direct hit on its slug
  // (e.g. /home) 308-redirects to '/', so home has no public slug URL.
  if (path && path === buildTime.routes.home) permanentRedirect('/');

  const page = await getPage(path || buildTime.routes.home);
  if (!page) notFound();
  return <BlockRenderer blocks={page.body} components={customBlocks} />;
}
```

- [ ] **Step 4: Verify the web package still typechecks (templates are excluded from web tsc) and materialize.test stays green**

Run: `pnpm --filter @ogs-tech/press-web typecheck && pnpm --filter @ogs-tech/press-web exec vitest run src/materialize.test.ts`
Expected: PASS — templates are in the tsconfig `exclude` list, so the engine typecheck is unaffected; `materialize.test.ts` asserts only file existence. (The templates are typechecked end-to-end against Next in Task 12 via `pnpm play`.)

- [ ] **Step 5: Commit**

```bash
git add packages/web/templates/host/press-config.ts packages/web/templates/host/app/layout.tsx "packages/web/templates/host/app/[[...slug]]/page.tsx"
git commit -m "feat(web)!: materialized host fetches Site Settings at runtime (buildTime anchors + getSiteConfig)"
```

---

## Task 12: Playground dogfood — boot, fill Site Settings, verify AC1/AC6/AC7

**Files:**
- No source changes. Resets the playground CMS DB and exercises the runtime path end-to-end.

**Interfaces:**
- Consumes: everything from Tasks 1–11. `pnpm play` runs `turbo run dev --filter playground`, whose `dev → ^build` dependency rebuilds `@ogs-tech/press-cms` from `dist/` before boot, then the engine `press dev` materializes `.press/web`, seeds sample pages, boots cms (:1337) + web (:3000).
- Produces: manual confirmation of AC1 (edit-without-deploy), AC6 (graceful CMS-down), AC7 (Themes menu gone / Site Settings present).

- [ ] **Step 1: Reset the playground CMS DB (drop the orphaned `theme` table)**

Removing the `theme` content-type leaves an orphaned `themes` table in the committed SQLite DB. Reset it so boot is clean:

```bash
rm -rf apps/playground/packages/cms/.tmp
```

- [ ] **Step 2: Boot the stack**

Run: `pnpm play`
Expected: turbo rebuilds `@ogs-tech/press-cms`; the engine logs `> materialize .press/web`, `> seed sample content`, `> boot cms (:1337)`, `> boot web (:3000)`, then `press dev ready — web http://localhost:3000, cms http://localhost:1337/admin`. The web home renders **engine-default themed + unbranded** (empty Site Settings record was seeded).

- [ ] **Step 3: AC7 — verify the admin surface**

In `http://localhost:1337/admin` (create the admin user if first run):
- The left "Content Manager" menu has a **"Site Settings"** single-type entry and **no "Themes"** entry.
- Open "Site Settings": confirm the grouped **SEO**, **Theme Colors**, and **Theme Radius** component sections render alongside `name`, `url`, `locale`, `logo`, `favicon`.

> If the single type fails to boot or the component sections don't render, fall back to the flat-scalar-field schema described in Task 2's risk note and adjust `mapSiteSettings` field paths accordingly, then re-run from Step 1.

- [ ] **Step 4: AC1 — edit without deploy**

In Site Settings, set `name` = "Acme Dogfood", upload a `logo`, set `seo.titleTemplate` = "%s | Acme Dogfood", and set `themeColors.primary` = `#7C3AED`. **Save.** Within ~60s (the revalidate window), reload `http://localhost:3000`:
- The header shows the logo + "Acme Dogfood".
- The primary token reflects `#7C3AED` (e.g. inspect `:root { --press-color-primary }` in the injected `<style>`).
- No rebuild/redeploy was run.

- [ ] **Step 5: AC6 — graceful CMS-down**

Stop only the CMS (in the `pnpm play` terminal, the simplest path is Ctrl-C to stop the stack, then boot web alone against a down CMS — or kill the cms child). Then load `http://localhost:3000`:
- The site **renders** (engine-default theme, unbranded — empty `name`, no logo), **no error page/crash**.

Restart with `pnpm play` when done.

- [ ] **Step 6: Commit (DB reset only; nothing else changed)**

The `.tmp` directory is gitignored (`apps/playground/packages/cms/.gitignore`), so there is nothing to commit here unless the playground tree changed. If `git status` shows changes, review them; otherwise skip the commit. Record the manual verification result in the task notes.

---

## Task 13: Changeset + final self-review

**Files:**
- Create: `.changeset/press-site-settings-cms.md`

**Interfaces:**
- Consumes: the completed feature.
- Produces: a `minor`/`minor` changeset for both packages with the migration note in its body (AC10).

- [ ] **Step 1: Write the changeset**

`.changeset/press-site-settings-cms.md`:

```markdown
---
"@ogs-tech/press-web": minor
"@ogs-tech/press-cms": minor
---

Move whitelabel identity, SEO, and editable theme values from `press.config.ts` into a CMS "Site Settings" single type, fetched at runtime so editors change them in the admin with no redeploy.

BREAKING (pre-1.0, shipped on a minor):

- `press.config.ts` / `PressConfig` no longer accept `brand`, `site`, `seo`, or `theme.colors` / `theme.radius`. Passing any of them is a type error at `defineConfig` (loud, intended). Move those values into **Site Settings** in the admin (now the source of truth, fetched at runtime). `press.config.ts` keeps `routes`, `theme.name`, and `theme.fonts`.
- The `theme` content-type and the "Themes" admin menu are removed; theme colours + radii now live under **Site Settings**. `@ogs-tech/press-cms` seeds one empty Site Settings record on bootstrap.

New: the web engine exports `getSiteConfig(buildTime)` — an ISR-cached (~60s) resolver that fetches `GET /api/site-setting` and produces the existing `ResolvedPressConfig` shape, so `buildMetadata` / `buildThemeStyle` are unchanged. When the CMS is unreachable, the site renders engine-default + unbranded (no crash, no config fallback). Unset theme tokens resolve over the engine's `DEFAULT_THEME`; unset identity/SEO stay empty (no inheritance).
```

- [ ] **Step 2: Run the full test + typecheck sweep for both packages**

Run:
```bash
pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck && pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back
```
Expected: all PASS.

- [ ] **Step 3: Final spec-coverage self-check (AC1–AC11)**

Confirm by inspection:
- AC2: `grep -nE "brand|site:|seo:|colors|radius" packages/web/src/config/types.ts` shows `PressConfig` has none of them as inputs (only `ResolvedPressConfig`/`DEFAULT_THEME`/`mapSiteSettings` reference colour/radius).
- AC5: `git diff` touches `build-metadata.ts` / `build-theme-style.ts` **not at all** (only their test fixtures and call sites).
- AC9: `getSiteConfig` is the single CMS-aware seam — reaching multi-tenant adds a `tenantKey` arg + a `Site` collection, no layout/page/pure-function edits.

- [ ] **Step 4: Commit**

```bash
git add .changeset/press-site-settings-cms.md
git commit -m "chore: changeset for Site Settings from the CMS (minor, breaking pre-1.0)"
```

---

## Self-Review (run by the plan author)

**1. Spec coverage:**

| Spec section | Task(s) |
|---|---|
| §2 data model (single type + 3 components) | 1, 2 |
| §3 `getSiteConfig` + pure `mapSiteSettings` | 6, 7 |
| §3.3 public exports | 7 |
| §4 materialized `layout.tsx` / `page.tsx` | 11 |
| §5 CMS added (schema, components, route, controller, seed) | 1, 2, 3, 4 |
| §5 CMS removed (theme CT, seedDefaultTheme, bootstrap call) | 4, 5 |
| §6 `press.config.ts` shrink → `BuildTimeConfig` | 9 |
| §7 resilience / graceful CMS-down | 7 (tests), 12 (manual) |
| §8 caching / `revalidate` | 7 (assertion), 11 |
| §9 multi-tenant seam | 7 (signature), 13 (inspection) |
| §10 tests (mapSiteSettings, getSiteConfig, seedSiteSetting, resolve-config) | 6, 7, 4, 9 |
| §11 delivery (changeset, playground dogfood) | 13, 12 |
| §11 adopter configs (CLI template + root) | 10 |
| AC1–AC11 | verified across 6/7/9/11/12/13 |

**2. Placeholder scan:** No TBD/TODO/"handle errors"/"similar to Task N" — every code step shows full content; every command shows expected output.

**3. Type consistency:** `BuildTimeConfig`, `SiteSettingsData`, `mapSiteSettings(buildTime, cms)`, `getSiteConfig(buildTime)`, `resolveConfig → BuildTimeConfig`, `SITE_SETTING_UID`, `seedSiteSetting` are named identically across Tasks 6/7/9 and the templates in Task 11. The materialized constant is `buildTime` everywhere (press-config.ts, layout.tsx, page.tsx). Color/radius keys match `DEFAULT_THEME` and the component JSONs.

**Note on `seo.titleTemplate`:** per spec §0/§3.2 ("Identity/SEO have no engine default: unset means empty"), `mapSiteSettings` maps an absent `titleTemplate` to `''` (not `'%s'`). This is the faithful "empty means empty" reading (AC3); the editor sets it in Site Settings. If product feedback later wants `'%s'` as a structural default, that is a one-line change in `mapSiteSettings` + its test — flagged here, not silently chosen.
