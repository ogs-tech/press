# Plugin/Legal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the engine's third real plugin — LGPD/GDPR compliance end-to-end: a
seeded privacy-policy page (Eixo A) and a category-based cookie-consent banner +
a public `hasConsent()` gate (Eixo B), both wired under one
`ResolvedPressConfig.plugins.legal` key.

**Architecture:** Follows the canonical plugin structure `example`/`seo` already
proved: one or more `preset-config` components on Site Settings → a pure
fail-open mapper → `ResolvedPressConfig.plugins.legal` → explicit mounts in the
host `layout.tsx`. Eixo A is a one-shot idempotent bootstrap seed
(`seedLegalPages`, built on the existing `seedPage` primitive). Eixo B is a
client-only cookie store (`useSyncExternalStore`) plus a hand-rolled
`'use client'` banner component, with an inline anti-flash `<script>` closing
the one-frame gap for returning visitors.

**Tech Stack:** Strapi 5 (component schemas, lifecycle-guarded bootstrap seed),
Next.js/React 19 (`useSyncExternalStore`, a `'use client'` banner), vitest
(fake-`strapi` unit tests on the cms side, hand-rolled `act()`+`createRoot` DOM
tests on the web side — never `@testing-library/react`).

## Global Constraints

- Node 20.x, pnpm 10.x (repo root requirement).
- No new npm dependencies. The consent store uses only React's built-in
  `useSyncExternalStore` — no cookie library.
- Cookie contract (Spec §4): name `press_consent`, `SameSite=Lax`, `Secure` on
  https only, `Path=/`, `Max-Age` 180 days (`15552000` seconds). Value:
  `{ v: 1, analytics: boolean, marketing: boolean, decidedAt: number }`
  (JSON, URI-encoded). `necessary` is never stored (always `true`). A version
  mismatch or malformed value parses as **no decision**, never a throw.
- `ConsentCategory = 'necessary' | 'analytics' | 'marketing'` is a closed
  union — never adopter-extensible (a 4th category is an additive engine
  change, `ThemeName`-style).
- Every plugin default (copy, labels) is **English**, matching every other
  engine default — the editor localizes in Site Settings like everything
  else. Do not default to Portuguese even though the feature is LGPD-driven.
- `legalPages`/`cookieConsent` attach ONLY to the `site-setting` single type —
  no `page` content-type schema change in this plan.
- Consent is **never** read via `next/headers` `cookies()` — that would force
  the whole route dynamic (killing ISR) and bake one visitor's decision into
  cached HTML. It is client-only state, full stop.
- No explicit boolean-seed step for `cookieConsent.enabled` — rely on
  `mapLegal`'s fail-open default, matching the `seo` precedent (`seo`'s admin
  toggle ships without one too).
- `PressPlugin<Id>` / `urn:plugin:legal` is **not** implemented in this plan —
  stays RESERVED, same as `example`/`seo`.
- Client-component interactive tests use the hand-rolled `act()` +
  `createRoot` harness (the `mobile-nav` precedent) — **never**
  `@testing-library/react` (the workspace's node-linker=hoisted layout only
  materializes Strapi-admin's React 19 RTL variant at the workspace root).
- Quality gate per task: `pnpm --filter @ogs-tech/press-cms test`,
  `pnpm --filter @ogs-tech/press-cms test:ts:back`,
  `pnpm --filter @ogs-tech/press-web test`,
  `pnpm --filter @ogs-tech/press-web typecheck` — there is no eslint, so
  typecheck + tests are the whole gate (per CLAUDE.md).
- Versioning: `@ogs-tech/press-web` **major** (new required `plugins.legal`
  key), `@ogs-tech/press-cms` **minor** (additive only) — a changeset is
  required for the release.

---

### Task 1: Fix `seedPage`'s `body` type from `unknown[]` to `PressTree`

`seedPage` (`packages/cms/server/src/lib/seed-page.ts`) still types `body` as
`unknown[]` — a leftover from the pre-composition-tree Dynamic Zone world,
where a page body was an array of `{ __component, ... }` blocks. Since the
tree migration, `page.body` is a `PressTree` object (`{ version, root }`),
never an array. `seedPage` is exported-but-unused today (no real caller), so
this type error has never surfaced — but Task 4 below is the first real
caller, and it must pass a real `PressTree`. Fixing the root cause here (not
working around it at the call site) keeps the primitive correct for every
future page-seeding consumer.

**Files:**
- Modify: `packages/cms/server/src/lib/seed-page.ts`
- Modify: `packages/cms/server/src/lib/seed-page.test.ts`

**Interfaces:**
- Consumes: `PressTree`, `PRESS_TREE_VERSION` from `@ogs-tech/press-shared`.
- Produces: `seedPage(strapi, opts: { slug: string; title: string; body: PressTree; flagKey: string }): Promise<void>` — the corrected signature every later task's `seedLegalPages` (Task 4) calls.

- [ ] **Step 1: Update the test fixture to build a valid `PressTree`**

In `packages/cms/server/src/lib/seed-page.test.ts`, replace the DZ-shaped
fixture with a real tree:

```ts
import { describe, expect, it } from 'vitest';
import type { PressTree } from '@ogs-tech/press-shared';
import { PRESS_TREE_VERSION } from '@ogs-tech/press-shared';
import { PAGE_UID, seedPage } from './seed-page';

const DEMO_BODY: PressTree = {
  version: PRESS_TREE_VERSION,
  root: {
    type: 'layout',
    header: { mode: 'inherit' },
    footer: { mode: 'inherit' },
    children: [],
  },
};

const OPTS = {
  slug: 'demo',
  title: 'Demo',
  flagKey: 'demoPageSeeded',
  body: DEMO_BODY,
};
```

Leave the rest of the file (the `fakeStrapi` helper and all four `it` blocks)
unchanged — they compare `creates`/`store` structurally and never inspect the
shape of `body` itself.

- [ ] **Step 2: Run the backend typecheck to see it fail**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: FAIL — `Type 'PressTree' is not assignable to type 'unknown[]'` (or
equivalent) at the `seedPage(strapi, OPTS)` call sites in the test file.

- [ ] **Step 3: Fix the signature in `seed-page.ts`**

```ts
import type { Core } from '@strapi/strapi';
import type { PressTree } from '@ogs-tech/press-shared';
import { pluginStore } from './plugin-store';

/** UID of the engine's page collection type (plugin name `press-cms`). */
export const PAGE_UID = 'plugin::press-cms.page';

/**
 * Generic, idempotent page seed — the reusable primitive behind future
 * page-seeding consumers (Plugin/Legal, archetype templates). Base itself does
 * not call it yet: exported-but-unused public API by design.
 *
 * Three invariants, identical to the retired privacy-policy seed:
 *
 * 1. Flag-first: `opts.flagKey` in the plugin store makes the pass literal-once.
 *    After the single seeding pass the page is never written again — an
 *    editor-deleted page is respected forever.
 * 2. Slug collision → the adopter's own page wins: the seed marks itself done
 *    without writing.
 * 3. The page is created as a DRAFT (`documents.create` without publish) — the
 *    engine never publishes content on its own; an editor reviews and publishes.
 */
export async function seedPage(
  strapi: Core.Strapi,
  opts: { slug: string; title: string; body: PressTree; flagKey: string },
): Promise<void> {
  const store = pluginStore(strapi);
  if (await store.get({ key: opts.flagKey })) return;

  const docs = strapi.documents(PAGE_UID);
  const existing = await docs.findFirst({ filters: { slug: opts.slug } } as any);
  if (!existing) {
    await docs.create({ data: { title: opts.title, slug: opts.slug, body: opts.body } as any });
  }

  await store.set({ key: opts.flagKey, value: true });
}
```

- [ ] **Step 4: Run the backend typecheck to confirm it passes**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS

- [ ] **Step 5: Run the unit tests to confirm behavior is unchanged**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/seed-page.test.ts`
Expected: PASS (all four cases)

- [ ] **Step 6: Commit**

```bash
git add packages/cms/server/src/lib/seed-page.ts packages/cms/server/src/lib/seed-page.test.ts
git commit -m "fix(cms): type seedPage's body as PressTree, not the pre-tree DZ array shape"
```

---

### Task 2: CMS schema — `legal-pages`, `cookie-consent`, `cookie-category` components

Three new `preset-config` components plus two new `site-setting` attributes,
following the exact pattern `basic-settings`/`seo`/`example-plugin` already
established: a JSON schema file per component, registered in
`inject-components.ts`, referenced from `site-setting/schema.json`, and
deep-populated by the `site-setting` controller where a nested component
needs it.

**Files:**
- Create: `packages/cms/server/src/components/config/legal-pages.json`
- Create: `packages/cms/server/src/components/config/cookie-category.json`
- Create: `packages/cms/server/src/components/config/cookie-consent.json`
- Modify: `packages/cms/server/src/lib/inject-components.ts`
- Modify: `packages/cms/server/src/lib/inject-components.test.ts`
- Modify: `packages/cms/server/src/content-types/site-setting/schema.json`
- Modify: `packages/cms/server/src/controllers/site-setting.ts`
- Modify: `packages/cms/server/src/controllers/site-setting.test.ts`

**Interfaces:**
- Produces: component uids `preset-config.legal-pages`, `preset-config.cookie-category`, `preset-config.cookie-consent`; `site-setting.legalPages` (component: `preset-config.legal-pages`), `site-setting.cookieConsent` (component: `preset-config.cookie-consent`) — the raw wire shapes Task 3's `SiteSettingsData` type mirrors.

- [ ] **Step 1: Write the failing schema-registration tests**

In `packages/cms/server/src/lib/inject-components.test.ts`, add the three new
uids to the "registers every engine preset-\* component" list:

```ts
  it('registers every engine preset-* component as a component model', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    const expected = [
      'preset-atom.paragraph', 'preset-atom.heading', 'preset-atom.list', 'preset-atom.quote',
      'preset-atom.image', 'preset-atom.button', 'preset-atom.separator', 'preset-atom.spacer',
      'preset-molecule.link',
      'preset-organism.hero', 'preset-organism.cta',
      'preset-organism.navbar', 'preset-organism.footer',
      'preset-layout.container', 'preset-layout.row', 'preset-layout.column',
      'preset-config.basic-settings', 'preset-config.theme-advanced', 'preset-config.example-plugin',
      'preset-config.seo-social', 'preset-config.seo', 'preset-config.seo-page',
      'preset-config.legal-pages', 'preset-config.cookie-category', 'preset-config.cookie-consent',
    ];
    for (const uid of expected) {
      expect(components.get(uid)?.modelType).toBe('component');
      expect(components.get(uid)?.uid).toBe(uid);
    }
  });
```

Then add a dedicated describe block, right after the existing
`describe('preset-config.seo / seo-social / seo-page components ...')` block:

```ts
  describe('preset-config.legal-pages / cookie-consent / cookie-category components (Plugin/Legal Spec §1)', () => {
    it('registers preset-config.legal-pages with the enabled gate only', () => {
      const { strapi, components } = makeStrapi();
      injectComponents({ strapi });
      expect(components.get('preset-config.legal-pages')?.category).toBe('preset-config');
      expect(components.get('preset-config.legal-pages')?.attributes).toEqual({
        enabled: { type: 'boolean', default: true },
      });
    });

    it('registers preset-config.cookie-category with label/description only', () => {
      const { strapi, components } = makeStrapi();
      injectComponents({ strapi });
      expect(components.get('preset-config.cookie-category')?.category).toBe('preset-config');
      expect(components.get('preset-config.cookie-category')?.attributes).toEqual({
        label: { type: 'string' },
        description: { type: 'text' },
      });
    });

    it('registers preset-config.cookie-consent with banner copy + three named category fields', () => {
      const { strapi, components } = makeStrapi();
      injectComponents({ strapi });
      expect(components.get('preset-config.cookie-consent')?.category).toBe('preset-config');
      expect(components.get('preset-config.cookie-consent')?.attributes).toEqual({
        enabled: { type: 'boolean', default: true },
        bannerTitle: { type: 'string' },
        bannerDescription: { type: 'text' },
        acceptAllLabel: { type: 'string' },
        savePreferencesLabel: { type: 'string' },
        reopenTriggerLabel: { type: 'string' },
        necessaryCategory: { type: 'component', repeatable: false, component: 'preset-config.cookie-category' },
        analyticsCategory: { type: 'component', repeatable: false, component: 'preset-config.cookie-category' },
        marketingCategory: { type: 'component', repeatable: false, component: 'preset-config.cookie-category' },
      });
    });
  });
```

Add two more describe blocks near the existing `'site-setting seo attribute'`
block, at the bottom of the same file:

```ts
describe('site-setting legalPages attribute (Plugin/Legal Spec §1)', () => {
  it('attaches preset-config.legal-pages as a config component', () => {
    expect((siteSettingSchema.attributes as any).legalPages).toEqual({
      type: 'component',
      repeatable: false,
      component: 'preset-config.legal-pages',
    });
  });
});

describe('site-setting cookieConsent attribute (Plugin/Legal Spec §1)', () => {
  it('attaches preset-config.cookie-consent as a config component', () => {
    expect((siteSettingSchema.attributes as any).cookieConsent).toEqual({
      type: 'component',
      repeatable: false,
      component: 'preset-config.cookie-consent',
    });
  });
});
```

In `packages/cms/server/src/controllers/site-setting.test.ts`, add two more
`it` blocks at the end of the `describe('site-setting controller', ...)`
block:

```ts
  it('populates legalPages as a shallow scalar component (no media/nested component to deep-populate)', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.legalPages).toBe(true);
  });

  it('deep-populates cookieConsent (three nested cookie-category components)', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.cookieConsent).toEqual({
      populate: { necessaryCategory: true, analyticsCategory: true, marketingCategory: true },
    });
  });
```

- [ ] **Step 2: Run the new tests to see them fail**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts src/controllers/site-setting.test.ts`
Expected: FAIL — the new uids/attributes/populate keys don't exist yet.

- [ ] **Step 3: Create the three component schema files**

`packages/cms/server/src/components/config/legal-pages.json`:

```json
{
  "collectionName": "components_preset_config_legal_pages",
  "info": {
    "displayName": "Legal Pages",
    "icon": "shield",
    "description": "Gates the privacy-policy seed on a fresh install — the seeded page's text is then edited normally in Content Manager"
  },
  "options": {},
  "attributes": {
    "enabled": { "type": "boolean", "default": true }
  },
  "config": {
    "metadatas": {
      "enabled": { "edit": { "label": "Enabled", "description": "Seeds a placeholder Privacy Policy page on a fresh install. Disabling later does not remove an already-seeded page." } }
    }
  }
}
```

`packages/cms/server/src/components/config/cookie-category.json`:

```json
{
  "collectionName": "components_preset_config_cookie_categories",
  "info": {
    "displayName": "Cookie Category",
    "icon": "list",
    "description": "Copy for one cookie-consent category — reused by the necessary/analytics/marketing fields"
  },
  "options": {},
  "attributes": {
    "label": { "type": "string" },
    "description": { "type": "text" }
  },
  "config": {
    "metadatas": {
      "label": { "edit": { "label": "Label", "description": "The category name shown in the cookie banner." } },
      "description": { "edit": { "label": "Description", "description": "Explains what this category of cookies is used for." } }
    }
  }
}
```

`packages/cms/server/src/components/config/cookie-consent.json`:

```json
{
  "collectionName": "components_preset_config_cookie_consents",
  "info": {
    "displayName": "Cookie Consent",
    "icon": "lock",
    "description": "The cookie-consent banner's copy and category descriptions"
  },
  "options": {},
  "attributes": {
    "enabled": { "type": "boolean", "default": true },
    "bannerTitle": { "type": "string" },
    "bannerDescription": { "type": "text" },
    "acceptAllLabel": { "type": "string" },
    "savePreferencesLabel": { "type": "string" },
    "reopenTriggerLabel": { "type": "string" },
    "necessaryCategory": { "type": "component", "repeatable": false, "component": "preset-config.cookie-category" },
    "analyticsCategory": { "type": "component", "repeatable": false, "component": "preset-config.cookie-category" },
    "marketingCategory": { "type": "component", "repeatable": false, "component": "preset-config.cookie-category" }
  },
  "config": {
    "metadatas": {
      "enabled": { "edit": { "label": "Enabled", "description": "Turns on the cookie-consent banner for every page. Ships on by default." } },
      "bannerTitle": { "edit": { "label": "Banner title", "description": "Heading shown at the top of the cookie banner." } },
      "bannerDescription": { "edit": { "label": "Banner description", "description": "Explains why the site uses cookies." } },
      "acceptAllLabel": { "edit": { "label": "Accept all label", "description": "Sets analytics and marketing on, saves, and dismisses the banner." } },
      "savePreferencesLabel": { "edit": { "label": "Save preferences label", "description": "Saves whatever the category toggles are currently set to — an all-off save is a one-click full rejection." } },
      "reopenTriggerLabel": { "edit": { "label": "Reopen trigger label", "description": "Label on the persistent floating button shown once a visitor has made a choice." } },
      "necessaryCategory": { "edit": { "label": "Necessary category", "description": "Always shown as locked-on in the banner — never a stored toggle." } },
      "analyticsCategory": { "edit": { "label": "Analytics category", "description": "Toggle copy for analytics cookies." } },
      "marketingCategory": { "edit": { "label": "Marketing category", "description": "Toggle copy for marketing cookies." } }
    }
  }
}
```

- [ ] **Step 4: Register the components in `inject-components.ts`**

Add the three imports near the other `config/*.json` imports:

```ts
import legalPagesSchema from '../components/config/legal-pages.json';
import cookieCategorySchema from '../components/config/cookie-category.json';
import cookieConsentSchema from '../components/config/cookie-consent.json';
```

Append to the end of the `ENGINE_COMPONENTS` array (nested child first, same
convention `seo-social`-before-`seo` uses):

```ts
  // Plugin/Legal (Plugin/Legal Spec §1) — the privacy-policy seed gate and the
  // cookie-consent banner's copy. Nested child first: cookie-consent references
  // cookie-category three times (necessary/analytics/marketing).
  { layer: 'config', name: 'legal-pages', schema: legalPagesSchema as Record<string, unknown> },
  { layer: 'config', name: 'cookie-category', schema: cookieCategorySchema as Record<string, unknown> },
  { layer: 'config', name: 'cookie-consent', schema: cookieConsentSchema as Record<string, unknown> },
```

- [ ] **Step 5: Wire the two new attributes into the Site Settings schema**

In `packages/cms/server/src/content-types/site-setting/schema.json`, add two
attributes after `seo`:

```json
    "seo": { "type": "component", "repeatable": false, "component": "preset-config.seo" },
    "legalPages": { "type": "component", "repeatable": false, "component": "preset-config.legal-pages" },
    "cookieConsent": { "type": "component", "repeatable": false, "component": "preset-config.cookie-consent" }
```

and two `config.metadatas` entries after the `seo` entry:

```json
      "seo": { "edit": { "label": "SEO", "description": "Head metadata defaults for every page — title template, description, share image, and social profiles." } },
      "legalPages": { "edit": { "label": "Legal Pages", "description": "Gates the seeded Privacy Policy page on a fresh install." } },
      "cookieConsent": { "edit": { "label": "Cookie Consent", "description": "The cookie-consent banner shown to visitors — copy, categories, and the enabled toggle." } }
```

- [ ] **Step 6: Populate the two new fields in the site-setting controller**

In `packages/cms/server/src/controllers/site-setting.ts`, extend
`settingsPopulate()`:

```ts
  const settingsPopulate = () => ({
    basicSettings: {
      populate: {
        logo: true,
        favicon: true,
        themeAdvanced: true,
      },
    },
    layout: { populate: LAYOUT_POPULATE },
    examplePlugin: true,
    seo: { populate: { ogImage: true, social: true } },
    // legalPages is a flat scalar component (just `enabled`) — shallow `true`
    // is enough, same reason as examplePlugin above.
    legalPages: true,
    // cookieConsent carries three nested cookie-category components — each
    // needs its own populate key, same reason as basicSettings/seo above.
    cookieConsent: { populate: { necessaryCategory: true, analyticsCategory: true, marketingCategory: true } },
  });
```

- [ ] **Step 7: Run the tests to confirm they pass**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts src/controllers/site-setting.test.ts`
Expected: PASS

- [ ] **Step 8: Run the full cms suite + backend typecheck**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/cms/server/src/components/config/legal-pages.json \
        packages/cms/server/src/components/config/cookie-category.json \
        packages/cms/server/src/components/config/cookie-consent.json \
        packages/cms/server/src/lib/inject-components.ts \
        packages/cms/server/src/lib/inject-components.test.ts \
        packages/cms/server/src/content-types/site-setting/schema.json \
        packages/cms/server/src/controllers/site-setting.ts \
        packages/cms/server/src/controllers/site-setting.test.ts
git commit -m "feat(cms): add legal-pages/cookie-consent/cookie-category Site Settings components"
```

---

### Task 3: Web — legal plugin types, defaults, mapper, and Site Settings wiring

Mirrors `plugins/seo` exactly: a `types.ts` (Raw/Resolved pairs), two default
constants, a fail-open pure mapper, then wiring into `ResolvedPressConfig`,
`SiteSettingsData`, and `mapSiteSettings`.

**Files:**
- Create: `packages/web/src/plugins/legal/types.ts`
- Create: `packages/web/src/plugins/legal/default-legal-pages.ts`
- Create: `packages/web/src/plugins/legal/default-cookie-consent.ts`
- Create: `packages/web/src/plugins/legal/map-legal.ts`
- Create: `packages/web/src/plugins/legal/map-legal.test.ts`
- Modify: `packages/web/src/config/types.ts`
- Modify: `packages/web/src/map-site-settings.ts`
- Modify: `packages/web/src/map-site-settings.test.ts`

**Interfaces:**
- Consumes: nothing outside this task (pure types + pure functions).
- Produces: `ConsentCategory`, `RawCookieCategory`, `ResolvedCookieCategory`, `RawLegalPages`, `ResolvedLegalPages`, `RawCookieConsent`, `ResolvedCookieConsent`, `ResolvedLegalPlugin` (`packages/web/src/plugins/legal/types.ts`); `DEFAULT_LEGAL_PAGES: ResolvedLegalPages`; `DEFAULT_COOKIE_CONSENT: ResolvedCookieConsent`; `mapLegal(pages: RawLegalPages | null | undefined, consent: RawCookieConsent | null | undefined): ResolvedLegalPlugin` — Task 6 (`consent-store.ts`) imports `ConsentCategory`; Task 7 (`banner.tsx`) imports `ResolvedCookieConsent`.

- [ ] **Step 1: Write the failing mapper test**

`packages/web/src/plugins/legal/map-legal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapLegal } from './map-legal';
import { DEFAULT_LEGAL_PAGES } from './default-legal-pages';
import { DEFAULT_COOKIE_CONSENT } from './default-cookie-consent';

describe('mapLegal', () => {
  it('resolves DEFAULT_LEGAL_PAGES and DEFAULT_COOKIE_CONSENT when both inputs are null', () => {
    const r = mapLegal(null, null);
    expect(r.pages.privacyPolicy).toEqual(DEFAULT_LEGAL_PAGES);
    expect(r.consent).toEqual(DEFAULT_COOKIE_CONSENT);
  });

  it('resolves defaults when both inputs are undefined', () => {
    const r = mapLegal(undefined, undefined);
    expect(r.pages.privacyPolicy).toEqual(DEFAULT_LEGAL_PAGES);
    expect(r.consent).toEqual(DEFAULT_COOKIE_CONSENT);
  });

  it('fails open on legalPages independently of cookieConsent', () => {
    const r = mapLegal(null, { enabled: false });
    expect(r.pages.privacyPolicy).toEqual(DEFAULT_LEGAL_PAGES);
    expect(r.consent.enabled).toBe(false);
  });

  it('fails open on cookieConsent independently of legalPages', () => {
    const r = mapLegal({ enabled: false }, null);
    expect(r.pages.privacyPolicy.enabled).toBe(false);
    expect(r.consent).toEqual(DEFAULT_COOKIE_CONSENT);
  });

  it('lets a present legalPages.enabled win over the default', () => {
    expect(mapLegal({ enabled: false }, null).pages.privacyPolicy.enabled).toBe(false);
  });

  it('lets present cookieConsent fields win over defaults, field by field', () => {
    const r = mapLegal(null, { bannerTitle: 'Custom', acceptAllLabel: 'Yes please' });
    expect(r.consent.bannerTitle).toBe('Custom');
    expect(r.consent.acceptAllLabel).toBe('Yes please');
    expect(r.consent.savePreferencesLabel).toBe(DEFAULT_COOKIE_CONSENT.savePreferencesLabel);
  });

  it('passes category copy through per-field, falling back per-field to the default category', () => {
    const r = mapLegal(null, { analyticsCategory: { label: 'Tracking' } });
    expect(r.consent.analyticsCategory).toEqual({
      label: 'Tracking',
      description: DEFAULT_COOKIE_CONSENT.analyticsCategory.description,
    });
    expect(r.consent.necessaryCategory).toEqual(DEFAULT_COOKIE_CONSENT.necessaryCategory);
  });

  it('resolves a null category component to the full default category', () => {
    expect(mapLegal(null, { marketingCategory: null }).consent.marketingCategory).toEqual(
      DEFAULT_COOKIE_CONSENT.marketingCategory,
    );
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/legal/map-legal.test.ts`
Expected: FAIL — none of the modules exist yet.

- [ ] **Step 3: Write `types.ts`**

```ts
/**
 * Wire + resolved shapes for the Legal plugin (Plugin/Legal Spec §2) — a
 * seeded privacy-policy page gate (Eixo A) plus a category-based
 * cookie-consent banner (Eixo B). `Raw` mirrors the CMS component verbatim
 * (every field optional); `Resolved` is TOTAL — the shape `CookieConsentBanner`
 * and `ResolvedPressConfig.plugins.legal` actually consume.
 */

/** Closed union by design — a 4th category is an additive engine change. */
export type ConsentCategory = 'necessary' | 'analytics' | 'marketing';

export interface RawCookieCategory {
  label?: string;
  description?: string;
}

export interface ResolvedCookieCategory {
  label: string;
  description: string;
}

export interface RawLegalPages {
  enabled?: boolean;
}

export interface ResolvedLegalPages {
  enabled: boolean;
}

export interface RawCookieConsent {
  enabled?: boolean;
  bannerTitle?: string;
  bannerDescription?: string;
  acceptAllLabel?: string;
  savePreferencesLabel?: string;
  reopenTriggerLabel?: string;
  necessaryCategory?: RawCookieCategory | null;
  analyticsCategory?: RawCookieCategory | null;
  marketingCategory?: RawCookieCategory | null;
}

export interface ResolvedCookieConsent {
  enabled: boolean;
  bannerTitle: string;
  bannerDescription: string;
  acceptAllLabel: string;
  savePreferencesLabel: string;
  reopenTriggerLabel: string;
  necessaryCategory: ResolvedCookieCategory;
  analyticsCategory: ResolvedCookieCategory;
  marketingCategory: ResolvedCookieCategory;
}

export interface ResolvedLegalPlugin {
  pages: { privacyPolicy: ResolvedLegalPages };
  consent: ResolvedCookieConsent;
}
```

- [ ] **Step 4: Write the two default constants**

`packages/web/src/plugins/legal/default-legal-pages.ts`:

```ts
import type { ResolvedLegalPages } from './types';

/** Ships enabled — same "core surface, not a demo" reasoning as SEO. */
export const DEFAULT_LEGAL_PAGES: ResolvedLegalPages = { enabled: true };
```

`packages/web/src/plugins/legal/default-cookie-consent.ts`:

```ts
import type { ResolvedCookieConsent } from './types';

/**
 * Ships ENABLED, with English copy (Plugin/Legal Spec §2) — the engine's
 * usual default-copy language, matching every other engine default; the
 * editor localizes in Site Settings same as everything else.
 */
export const DEFAULT_COOKIE_CONSENT: ResolvedCookieConsent = {
  enabled: true,
  bannerTitle: 'We use cookies',
  bannerDescription:
    'We use cookies to run this site and, with your permission, to measure usage and personalize marketing.',
  acceptAllLabel: 'Accept all',
  savePreferencesLabel: 'Save preferences',
  reopenTriggerLabel: 'Cookie preferences',
  necessaryCategory: {
    label: 'Necessary',
    description: 'Required for the site to function. Always on.',
  },
  analyticsCategory: {
    label: 'Analytics',
    description: 'Helps us understand how visitors use the site.',
  },
  marketingCategory: {
    label: 'Marketing',
    description: 'Used to show relevant ads and measure their performance.',
  },
};
```

- [ ] **Step 5: Write the mapper**

`packages/web/src/plugins/legal/map-legal.ts`:

```ts
import type {
  RawLegalPages,
  RawCookieConsent,
  RawCookieCategory,
  ResolvedCookieCategory,
  ResolvedLegalPlugin,
} from './types';
import { DEFAULT_LEGAL_PAGES } from './default-legal-pages';
import { DEFAULT_COOKIE_CONSENT } from './default-cookie-consent';

function mapCategory(
  raw: RawCookieCategory | null | undefined,
  fallback: ResolvedCookieCategory,
): ResolvedCookieCategory {
  return {
    label: raw?.label ?? fallback.label,
    description: raw?.description ?? fallback.description,
  };
}

/**
 * Pure CMS-shape → ResolvedLegalPlugin (Plugin/Legal Spec §2): FAIL-OPEN on
 * `pages` and `consent` independently, identical to mapExamplePlugin/
 * mapSeoPlugin — the established plugin-mapper convention, not a deliberate
 * exception.
 */
export function mapLegal(
  pages: RawLegalPages | null | undefined,
  consent: RawCookieConsent | null | undefined,
): ResolvedLegalPlugin {
  return {
    pages: {
      privacyPolicy: { enabled: pages?.enabled ?? DEFAULT_LEGAL_PAGES.enabled },
    },
    consent: {
      enabled: consent?.enabled ?? DEFAULT_COOKIE_CONSENT.enabled,
      bannerTitle: consent?.bannerTitle ?? DEFAULT_COOKIE_CONSENT.bannerTitle,
      bannerDescription: consent?.bannerDescription ?? DEFAULT_COOKIE_CONSENT.bannerDescription,
      acceptAllLabel: consent?.acceptAllLabel ?? DEFAULT_COOKIE_CONSENT.acceptAllLabel,
      savePreferencesLabel: consent?.savePreferencesLabel ?? DEFAULT_COOKIE_CONSENT.savePreferencesLabel,
      reopenTriggerLabel: consent?.reopenTriggerLabel ?? DEFAULT_COOKIE_CONSENT.reopenTriggerLabel,
      necessaryCategory: mapCategory(consent?.necessaryCategory, DEFAULT_COOKIE_CONSENT.necessaryCategory),
      analyticsCategory: mapCategory(consent?.analyticsCategory, DEFAULT_COOKIE_CONSENT.analyticsCategory),
      marketingCategory: mapCategory(consent?.marketingCategory, DEFAULT_COOKIE_CONSENT.marketingCategory),
    },
  };
}
```

- [ ] **Step 6: Run the mapper test to confirm it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/legal/map-legal.test.ts`
Expected: PASS

- [ ] **Step 7: Write the failing `mapSiteSettings` wiring tests**

Add to `packages/web/src/map-site-settings.test.ts` (near the `plugins.seo`
tests), plus the two new imports at the top:

```ts
import { DEFAULT_LEGAL_PAGES } from './plugins/legal/default-legal-pages';
import { DEFAULT_COOKIE_CONSENT } from './plugins/legal/default-cookie-consent';
```

```ts
  it('resolves plugins.legal to defaults when the CMS is null (Plugin/Legal Spec §2)', () => {
    const r = mapSiteSettings(buildTime, null);
    expect(r.plugins.legal.pages.privacyPolicy).toEqual(DEFAULT_LEGAL_PAGES);
    expect(r.plugins.legal.consent).toEqual(DEFAULT_COOKIE_CONSENT);
  });

  it('resolves plugins.legal from present legalPages/cookieConsent components', () => {
    const r = mapSiteSettings(buildTime, {
      legalPages: { enabled: false },
      cookieConsent: { enabled: false, bannerTitle: 'Custom title' },
    });
    expect(r.plugins.legal.pages.privacyPolicy.enabled).toBe(false);
    expect(r.plugins.legal.consent.enabled).toBe(false);
    expect(r.plugins.legal.consent.bannerTitle).toBe('Custom title');
  });
```

- [ ] **Step 8: Run it to see it fail**

Run: `pnpm --filter @ogs-tech/press-web test src/map-site-settings.test.ts`
Expected: FAIL — `SiteSettingsData` has no `legalPages`/`cookieConsent` fields yet and `plugins.legal` doesn't exist.

- [ ] **Step 9: Wire the types into `config/types.ts`**

Add the import near the other plugin type imports:

```ts
import type { RawLegalPages, RawCookieConsent, ResolvedLegalPlugin } from '../plugins/legal/types';
```

Extend `ResolvedPressConfig.plugins`:

```ts
  plugins: {
    example: ResolvedExamplePlugin;
    seo: ResolvedSeoPlugin;
    legal: ResolvedLegalPlugin;
  };
```

Extend `SiteSettingsData`:

```ts
  /** The `preset-config.legal-pages` component (Plugin/Legal Spec §1), RAW. */
  legalPages?: RawLegalPages | null;
  /** The `preset-config.cookie-consent` component (Plugin/Legal Spec §1), RAW. */
  cookieConsent?: RawCookieConsent | null;
```

- [ ] **Step 10: Wire the mapper call into `map-site-settings.ts`**

Add the import:

```ts
import { mapLegal } from './plugins/legal/map-legal';
```

Extend the returned `plugins` object:

```ts
    plugins: {
      example: mapExamplePlugin(c.examplePlugin),
      seo: mapSeoPlugin(c.seo),
      legal: mapLegal(c.legalPages, c.cookieConsent),
    },
```

- [ ] **Step 11: Run the tests to confirm they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/map-site-settings.test.ts src/plugins/legal/map-legal.test.ts`
Expected: PASS

- [ ] **Step 12: Run the full web suite + typecheck**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS (typecheck will fail here until every `ResolvedPressConfig` literal elsewhere in the package also supplies `plugins.legal` — there should be none outside tests already covered above, since real config only ever comes from `mapSiteSettings`).

- [ ] **Step 13: Commit**

```bash
git add packages/web/src/plugins/legal/types.ts \
        packages/web/src/plugins/legal/default-legal-pages.ts \
        packages/web/src/plugins/legal/default-cookie-consent.ts \
        packages/web/src/plugins/legal/map-legal.ts \
        packages/web/src/plugins/legal/map-legal.test.ts \
        packages/web/src/config/types.ts \
        packages/web/src/map-site-settings.ts \
        packages/web/src/map-site-settings.test.ts
git commit -m "feat(web): add legal plugin types, defaults, mapper, and Site Settings wiring"
```

---

### Task 4: CMS — `seedLegalPages` (Eixo A) + bootstrap wiring

The privacy-policy seed itself: a gated, idempotent call built on `seedPage`
(fixed in Task 1), wired into `bootstrap.ts` right after `seedSiteSetting`.

**Files:**
- Create: `packages/cms/server/src/lib/seed-legal-pages.ts`
- Create: `packages/cms/server/src/lib/seed-legal-pages.test.ts`
- Modify: `packages/cms/server/src/bootstrap.ts`

**Interfaces:**
- Consumes: `seedPage`, `PAGE_UID` from `./seed-page` (Task 1); `SITE_SETTING_UID` from `./seed-site-setting`; `PressTree`, `PRESS_TREE_VERSION` from `@ogs-tech/press-shared`.
- Produces: `seedLegalPages(strapi: Core.Strapi): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

`packages/cms/server/src/lib/seed-legal-pages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validatePressTree } from '@ogs-tech/press-shared';
import { seedLegalPages } from './seed-legal-pages';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';
const PAGE_UID = 'plugin::press-cms.page';

/** Minimal fake covering both UIDs seedLegalPages reads/writes (via seedPage), plus the plugin store. */
function fakeStrapi(siteSetting: any = null, pages: any[] = [], flags: Record<string, unknown> = {}) {
  const creates: Array<{ data: any }> = [];
  const store = new Map<string, unknown>(Object.entries(flags));
  const strapi = {
    documents: (uid: string) => {
      if (uid === SITE_SETTING_UID) {
        return { findFirst: async () => siteSetting };
      }
      if (uid === PAGE_UID) {
        return {
          findFirst: async ({ filters }: { filters: { slug: string } }) =>
            pages.find((p) => p.slug === filters.slug) ?? null,
          create: async (params: { data: any }) => {
            creates.push(params);
            pages.push({ documentId: `doc-${pages.length + 1}`, ...params.data });
            return pages[pages.length - 1];
          },
        };
      }
      throw new Error(`unexpected uid ${uid}`);
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
  return { strapi, creates, store };
}

describe('seedLegalPages (Plugin/Legal Spec §3)', () => {
  it('seeds the privacy-policy page as a DRAFT when legalPages is absent (defaults to enabled)', async () => {
    const { strapi, creates, store } = fakeStrapi(null);
    await seedLegalPages(strapi);
    expect(creates).toHaveLength(1);
    expect(creates[0].data.slug).toBe('privacy-policy');
    expect(creates[0].data.title).toBe('Privacy Policy');
    expect(creates[0].data).not.toHaveProperty('publishedAt');
    expect(store.get('legalPrivacyPolicySeeded')).toBe(true);
  });

  it('seeds when legalPages.enabled is explicitly true', async () => {
    const { strapi, creates } = fakeStrapi({ legalPages: { enabled: true } });
    await seedLegalPages(strapi);
    expect(creates).toHaveLength(1);
  });

  it('does not seed when legalPages.enabled is explicitly false (gate respected)', async () => {
    const { strapi, creates, store } = fakeStrapi({ legalPages: { enabled: false } });
    await seedLegalPages(strapi);
    expect(creates).toEqual([]);
    expect(store.get('legalPrivacyPolicySeeded')).toBeUndefined();
  });

  it('builds a valid PressTree body — heading + paragraph under an inherited header/footer', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await seedLegalPages(strapi);
    const body = creates[0].data.body;
    expect(body.version).toBe(2);
    expect(body.root.header).toEqual({ mode: 'inherit' });
    expect(body.root.footer).toEqual({ mode: 'inherit' });
    expect(body.root.children).toHaveLength(2);
    expect(body.root.children[0]).toMatchObject({
      type: 'block',
      component: 'preset-atom.heading',
      data: { text: 'Privacy Policy', level: '1' },
    });
    expect(body.root.children[1]).toMatchObject({ type: 'block', component: 'preset-atom.paragraph' });
  });

  it('is idempotent across repeated boots — one create only', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await seedLegalPages(strapi);
    await seedLegalPages(strapi);
    expect(creates).toHaveLength(1);
  });

  it('produces a body that the real validatePressTree accepts with no errors/warnings — the fake strapi here bypasses the beforeCreate lifecycle guard (assertValidPageWrite), same caveat seed-page.test.ts documents, so this test is the one place that actually proves a real write would not be rejected', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await seedLegalPages(strapi);
    const { errors, warnings } = validatePressTree(creates[0].data.body);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('respects an adopter page already on the privacy-policy slug — no create, flag still set', async () => {
    const { strapi, creates, store } = fakeStrapi(null, [{ documentId: 'doc-9', slug: 'privacy-policy' }]);
    await seedLegalPages(strapi);
    expect(creates).toEqual([]);
    expect(store.get('legalPrivacyPolicySeeded')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/seed-legal-pages.test.ts`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Write `seed-legal-pages.ts`**

```ts
import { randomUUID } from 'node:crypto';
import type { Core } from '@strapi/strapi';
import type { PressTree } from '@ogs-tech/press-shared';
import { PRESS_TREE_VERSION } from '@ogs-tech/press-shared';
import { seedPage } from './seed-page';
import { SITE_SETTING_UID } from './seed-site-setting';

const PRIVACY_POLICY_BODY: PressTree = {
  version: PRESS_TREE_VERSION,
  root: {
    type: 'layout',
    header: { mode: 'inherit' },
    footer: { mode: 'inherit' },
    children: [
      {
        id: randomUUID(),
        type: 'block',
        component: 'preset-atom.heading',
        data: { text: 'Privacy Policy', level: '1' },
      },
      {
        id: randomUUID(),
        type: 'block',
        component: 'preset-atom.paragraph',
        data: {
          content:
            'This page is a placeholder — replace it with your actual privacy policy before launch.',
        },
      },
    ],
  },
};

/**
 * Seeds the privacy-policy page exactly once (Plugin/Legal Spec §3). The
 * `legalPages.enabled` gate is read ONCE, at seed time — same "checked once"
 * contract as seedPage's own flag: disabling the gate after the page already
 * exists does not retroactively remove it. Absent component (fresh install,
 * nothing populated yet) reads as enabled (`=== false` check, not `!== true`).
 */
export async function seedLegalPages(strapi: Core.Strapi): Promise<void> {
  const site = (await strapi.documents(SITE_SETTING_UID).findFirst({
    populate: { legalPages: true },
  } as any)) as { legalPages?: { enabled?: boolean } | null } | null;

  if (site?.legalPages?.enabled === false) return;

  await seedPage(strapi, {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    body: PRIVACY_POLICY_BODY,
    flagKey: 'legalPrivacyPolicySeeded',
  });
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/seed-legal-pages.test.ts`
Expected: PASS

- [ ] **Step 5: Wire it into `bootstrap.ts`**

```ts
import type { Core } from '@strapi/strapi';
import { seedSiteSetting } from './lib/seed-site-setting';
import { seedLegalPages } from './lib/seed-legal-pages';
import { syncPluginEntries } from './lib/sync-plugin-entries';
import { assertValidPageWrite, assertValidSiteSettingWrite } from './lib/validate-write';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  // Write-path backstop (Spec §4): the admin builder can't produce an invalid
  // tree; raw API writes are rejected here with actionable messages.
  const guard = (event: any): void => {
    if (event.model?.uid === 'plugin::press-cms.page') assertValidPageWrite(event.params?.data);
    else assertValidSiteSettingWrite(event.params?.data);
  };
  strapi.db.lifecycles.subscribe({
    models: ['plugin::press-cms.page', 'plugin::press-cms.site-setting'],
    beforeCreate(event: any) {
      guard(event);
    },
    beforeUpdate(event: any) {
      guard(event);
    },
  } as any);

  await seedSiteSetting(strapi);
  await seedLegalPages(strapi);
  // Last (Spec §4): the CM plugin index mirrors whatever Site Settings holds
  // after seeding, and runs every boot (not seed-once) so an editor toggle is
  // never permanently stale.
  await syncPluginEntries(strapi);
};

export default bootstrap;
```

- [ ] **Step 6: Run the full cms suite + backend typecheck**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/cms/server/src/lib/seed-legal-pages.ts \
        packages/cms/server/src/lib/seed-legal-pages.test.ts \
        packages/cms/server/src/bootstrap.ts
git commit -m "feat(cms): seed a placeholder privacy-policy page on bootstrap (Plugin/Legal Eixo A)"
```

---

### Task 5: CMS — `PLUGIN_DEFINITIONS` entries for `legal-pages` and `legal-consent`

Gives Content-Manager visibility into both new toggles via the existing
read-only `plugin` collection-type mirror, exactly like `example`/`seo`.
Two entries, kept separate because they're independently toggleable (an
adopter can want the page without the banner, or vice versa).

**Files:**
- Modify: `packages/cms/server/src/lib/sync-plugin-entries.ts`
- Modify: `packages/cms/server/src/lib/sync-plugin-entries.test.ts`

**Interfaces:**
- Produces: two more `PLUGIN_DEFINITIONS` rows (`id: 'legal-pages'`, `id: 'legal-consent'`) — no new function signatures.

- [ ] **Step 1: Write the failing tests**

Add to `packages/cms/server/src/lib/sync-plugin-entries.test.ts`, inside the
existing `describe` block:

```ts
  it('creates the legal-pages entry with defaultEnabled true when Site Settings is null (Plugin/Legal Spec §2)', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await syncPluginEntries(strapi);
    const entry = creates.find((c) => c.data.pluginId === 'legal-pages');
    expect(entry?.data).toEqual({
      pluginId: 'legal-pages',
      label: 'Legal Pages',
      configHost: 'site-setting.legalPages',
      enabled: true,
    });
  });

  it('creates the legal-consent entry with defaultEnabled true when Site Settings is null', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await syncPluginEntries(strapi);
    const entry = creates.find((c) => c.data.pluginId === 'legal-consent');
    expect(entry?.data).toEqual({
      pluginId: 'legal-consent',
      label: 'Cookie Consent',
      configHost: 'site-setting.cookieConsent',
      enabled: true,
    });
  });

  it('mirrors the live Site Settings legalPages.enabled and cookieConsent.enabled values on create', async () => {
    const { strapi, creates } = fakeStrapi({ legalPages: { enabled: false }, cookieConsent: { enabled: false } });
    await syncPluginEntries(strapi);
    expect(creates.find((c) => c.data.pluginId === 'legal-pages')?.data.enabled).toBe(false);
    expect(creates.find((c) => c.data.pluginId === 'legal-consent')?.data.enabled).toBe(false);
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/sync-plugin-entries.test.ts`
Expected: FAIL — no `legal-pages`/`legal-consent` entries exist yet (the
existing length-based assertion `expect(creates).toHaveLength(PLUGIN_DEFINITIONS.length)`
still passes since it reads the array's own length, so it won't itself fail —
only the three new `it` blocks above fail).

- [ ] **Step 3: Extend `sync-plugin-entries.ts`**

Extend `SiteSettingSnapshot`:

```ts
interface SiteSettingSnapshot {
  examplePlugin?: { enabled?: boolean } | null;
  seo?: { enabled?: boolean } | null;
  legalPages?: { enabled?: boolean } | null;
  cookieConsent?: { enabled?: boolean } | null;
}
```

Append to `PLUGIN_DEFINITIONS`:

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
  {
    id: 'legal-pages',
    label: 'Legal Pages',
    configHost: 'site-setting.legalPages',
    defaultEnabled: true,
    readEnabled: (site) => site?.legalPages?.enabled,
  },
  {
    id: 'legal-consent',
    label: 'Cookie Consent',
    configHost: 'site-setting.cookieConsent',
    defaultEnabled: true,
    readEnabled: (site) => site?.cookieConsent?.enabled,
  },
];
```

Extend the populate call in `syncPluginEntries`:

```ts
  const site = (await strapi
    .documents(SITE_SETTING_UID as any)
    .findFirst({
      populate: { examplePlugin: true, seo: true, legalPages: true, cookieConsent: true } as any,
    })) as SiteSettingSnapshot | null;
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/sync-plugin-entries.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full cms suite + backend typecheck**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cms/server/src/lib/sync-plugin-entries.ts packages/cms/server/src/lib/sync-plugin-entries.test.ts
git commit -m "feat(cms): mirror legal-pages/legal-consent enabled state into the plugin index"
```

---

### Task 6: Web — the consent store (`consent-store.ts`)

The cookie contract, the `useSyncExternalStore`-backed hook, and the public
`hasConsent`/`setConsent`/`resetConsent` primitives, plus the anti-flash
script string Task 8 mounts in `<head>`.

**Files:**
- Create: `packages/web/src/plugins/legal/consent-store.ts`
- Create: `packages/web/src/plugins/legal/consent-store.test.ts`

**Interfaces:**
- Consumes: `ConsentCategory` from `./types` (Task 3).
- Produces: `ConsentDecision` (`{ analytics: boolean; marketing: boolean; decidedAt: number }`); `readConsentCookie(): ConsentDecision | null`; `useConsentDecision(): ConsentDecision | null`; `setConsent(decision: { analytics: boolean; marketing: boolean }): void`; `resetConsent(): void`; `hasConsent(category: ConsentCategory): boolean`; `CONSENT_ANTI_FLASH_SCRIPT: string`; `CONSENT_COOKIE_NAME: string` — Task 7 (`banner.tsx`) imports `useConsentDecision`/`setConsent`; Task 8 (`layout.tsx` mount) imports `CONSENT_ANTI_FLASH_SCRIPT`; Task 9 (`index.ts`) re-exports `hasConsent`/`resetConsent`/`CONSENT_ANTI_FLASH_SCRIPT`.

- [ ] **Step 1: Write the failing tests**

`packages/web/src/plugins/legal/consent-store.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { hasConsent, readConsentCookie, resetConsent, setConsent, CONSENT_COOKIE_NAME } from './consent-store';

afterEach(() => {
  resetConsent();
});

describe('consent-store cookie round-trip', () => {
  it('reads null when no cookie is set', () => {
    expect(readConsentCookie()).toBeNull();
  });

  it('round-trips a decision through setConsent/readConsentCookie', () => {
    setConsent({ analytics: true, marketing: false });
    const decision = readConsentCookie();
    expect(decision).not.toBeNull();
    expect(decision!.analytics).toBe(true);
    expect(decision!.marketing).toBe(false);
    expect(typeof decision!.decidedAt).toBe('number');
  });

  it('clears the decision on resetConsent', () => {
    setConsent({ analytics: true, marketing: true });
    resetConsent();
    expect(readConsentCookie()).toBeNull();
  });

  it('writes the cookie under the documented name with SameSite=Lax and Path=/', () => {
    setConsent({ analytics: true, marketing: true });
    expect(document.cookie).toContain(`${CONSENT_COOKIE_NAME}=`);
  });
});

describe('consent-store malformed/version-mismatched values', () => {
  it('reads null for a malformed (non-JSON) cookie value', () => {
    document.cookie = `${CONSENT_COOKIE_NAME}=not-json; Path=/`;
    expect(readConsentCookie()).toBeNull();
  });

  it('reads null for a version-mismatched cookie value (forces re-consent)', () => {
    document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(
      JSON.stringify({ v: 99, analytics: true, marketing: true, decidedAt: 1 }),
    )}; Path=/`;
    expect(readConsentCookie()).toBeNull();
  });

  it('reads null for a structurally incomplete cookie value', () => {
    document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify({ v: 1 }))}; Path=/`;
    expect(readConsentCookie()).toBeNull();
  });
});

describe('hasConsent', () => {
  it('is always true for necessary, decision or not', () => {
    expect(hasConsent('necessary')).toBe(true);
    setConsent({ analytics: false, marketing: false });
    expect(hasConsent('necessary')).toBe(true);
  });

  it('fails closed for analytics/marketing with no decision stored', () => {
    expect(hasConsent('analytics')).toBe(false);
    expect(hasConsent('marketing')).toBe(false);
  });

  it('reflects the stored decision once one exists', () => {
    setConsent({ analytics: true, marketing: false });
    expect(hasConsent('analytics')).toBe(true);
    expect(hasConsent('marketing')).toBe(false);
  });

  it('fails closed for non-necessary categories when document is undefined (SSR)', () => {
    const originalDocument = globalThis.document;
    // @ts-expect-error simulating an SSR environment where document doesn't exist
    delete globalThis.document;
    try {
      expect(hasConsent('necessary')).toBe(true);
      expect(hasConsent('analytics')).toBe(false);
      expect(hasConsent('marketing')).toBe(false);
    } finally {
      globalThis.document = originalDocument;
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/legal/consent-store.test.ts`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Write `consent-store.ts`**

```ts
import { useSyncExternalStore } from 'react';
import type { ConsentCategory } from './types';

/** Plugin/Legal Spec §4 cookie contract. */
export const CONSENT_COOKIE_NAME = 'press_consent';
const CONSENT_COOKIE_VERSION = 1;
const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // 180 days

export interface ConsentDecision {
  analytics: boolean;
  marketing: boolean;
  decidedAt: number;
}

interface StoredConsent {
  v: number;
  analytics: boolean;
  marketing: boolean;
  decidedAt: number;
}

function readRawCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/** A version mismatch or malformed value parses as no decision (re-consent), never a throw. */
function parseConsentCookie(raw: string | undefined): ConsentDecision | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (parsed.v !== CONSENT_COOKIE_VERSION) return null;
    if (
      typeof parsed.analytics !== 'boolean' ||
      typeof parsed.marketing !== 'boolean' ||
      typeof parsed.decidedAt !== 'number'
    ) {
      return null;
    }
    return { analytics: parsed.analytics, marketing: parsed.marketing, decidedAt: parsed.decidedAt };
  } catch {
    return null;
  }
}

export function readConsentCookie(): ConsentDecision | null {
  return parseConsentCookie(readRawCookie(CONSENT_COOKIE_NAME));
}

type Listener = () => void;
const listeners = new Set<Listener>();
function notify(): void {
  for (const listener of listeners) listener();
}
function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): ConsentDecision | null {
  return readConsentCookie();
}
function getServerSnapshot(): ConsentDecision | null {
  return null;
}

/**
 * React-native hydration-safe read (Plugin/Legal Spec §4): server (and first
 * client paint) always see `null`; React swaps to the real cookie value
 * immediately after hydration commits.
 */
export function useConsentDecision(): ConsentDecision | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setConsent(decision: { analytics: boolean; marketing: boolean }): void {
  const stored: StoredConsent = {
    v: CONSENT_COOKIE_VERSION,
    analytics: decision.analytics,
    marketing: decision.marketing,
    decidedAt: Date.now(),
  };
  writeCookie(CONSENT_COOKIE_NAME, JSON.stringify(stored), CONSENT_MAX_AGE_SECONDS);
  notify();
}

export function resetConsent(): void {
  clearCookie(CONSENT_COOKIE_NAME);
  notify();
}

/** Fail-closed: 'necessary' is always true; any other category is false during SSR or before a decision exists. */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === 'necessary') return true;
  if (typeof document === 'undefined') return false;
  const decision = readConsentCookie();
  if (!decision) return false;
  return category === 'analytics' ? decision.analytics : decision.marketing;
}

/**
 * Anti-flash (Plugin/Legal Spec §5): stamps `data-press-consent-decided` on
 * `<html>` before hydration when a decision cookie already exists, so
 * `theme.css` can hide the full-banner state for the one frame a returning
 * visitor's browser would otherwise paint the server-rendered "no decision"
 * markup before React corrects the `useSyncExternalStore` snapshot. Mounted
 * as a raw `<script>` in the host `layout.tsx` `<head>` — the `buildThemeStyle`
 * `<style>` injection precedent — never read via `next/headers` `cookies()`,
 * which would force the route dynamic.
 */
export const CONSENT_ANTI_FLASH_SCRIPT = `(function(){try{if(document.cookie.indexOf('${CONSENT_COOKIE_NAME}=')!==-1){document.documentElement.setAttribute('data-press-consent-decided','');}}catch(e){}})();`;
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/legal/consent-store.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full web suite + typecheck**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/plugins/legal/consent-store.ts packages/web/src/plugins/legal/consent-store.test.ts
git commit -m "feat(web): add the press_consent cookie store, useConsentDecision, and hasConsent (Plugin/Legal Eixo B)"
```

---

### Task 7: Web — the `CookieConsentBanner` component (`banner.tsx`)

The engine's second client component (after `MobileNav`): three states driven
by `useConsentDecision()` plus one local `panelOpen` flag.

**Files:**
- Create: `packages/web/src/plugins/legal/banner.tsx`
- Create: `packages/web/src/plugins/legal/banner.test.tsx`

**Interfaces:**
- Consumes: `ResolvedCookieConsent` from `./types` (Task 3); `useConsentDecision`, `setConsent` from `./consent-store` (Task 6).
- Produces: `CookieConsentBanner(props: Omit<ResolvedCookieConsent, 'enabled'>): JSX.Element` — Task 8's `layout.tsx` mount and Task 9's `index.ts` export consume this.

- [ ] **Step 1: Write the failing tests**

`packages/web/src/plugins/legal/banner.test.tsx`:

```tsx
// @vitest-environment jsdom
//
// Interactive-flow tests for the cookie-consent banner — a stateful client
// component. Same hand-rolled act() + createRoot harness as mobile-nav.test.tsx
// (CLAUDE.md testing note): NEVER @testing-library/react.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CookieConsentBanner } from './banner';
import { readConsentCookie, resetConsent } from './consent-store';
import { DEFAULT_COOKIE_CONSENT } from './default-cookie-consent';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(ui: React.ReactElement): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(ui));
}

function banner(): HTMLElement | null {
  return container.querySelector('[data-press-consent="banner"]');
}
function reopenTrigger(): HTMLButtonElement | null {
  return container.querySelector('[data-press-consent="reopen"]');
}
function acceptAllButton(): HTMLButtonElement {
  const el = container.querySelector('[data-press-consent="accept-all"]') as HTMLButtonElement | null;
  if (!el) throw new Error('accept-all button not found');
  return el;
}
function savePreferencesButton(): HTMLButtonElement {
  const el = container.querySelector('[data-press-consent="save-preferences"]') as HTMLButtonElement | null;
  if (!el) throw new Error('save-preferences button not found');
  return el;
}

const { enabled: _enabled, ...CONSENT_PROPS } = DEFAULT_COOKIE_CONSENT;

beforeEach(() => {
  resetConsent();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  resetConsent();
});

describe('<CookieConsentBanner>', () => {
  it('renders the full banner when no decision is stored', () => {
    render(<CookieConsentBanner {...CONSENT_PROPS} />);
    const b = banner();
    expect(b).not.toBeNull();
    expect(b!.textContent).toContain(DEFAULT_COOKIE_CONSENT.bannerTitle);
    expect(reopenTrigger()).toBeNull();
  });

  it('Accept All persists {analytics:true,marketing:true} and swaps to the floating trigger', () => {
    render(<CookieConsentBanner {...CONSENT_PROPS} />);
    act(() => acceptAllButton().click());
    expect(readConsentCookie()).toMatchObject({ analytics: true, marketing: true });
    expect(banner()).toBeNull();
    expect(reopenTrigger()).not.toBeNull();
  });

  it('Save Preferences with both toggles off persists an all-false decision (one-click full rejection)', () => {
    render(<CookieConsentBanner {...CONSENT_PROPS} />);
    act(() => savePreferencesButton().click());
    expect(readConsentCookie()).toMatchObject({ analytics: false, marketing: false });
    expect(banner()).toBeNull();
    expect(reopenTrigger()).not.toBeNull();
  });

  it('clicking the trigger reopens the panel pre-filled from the stored decision', () => {
    render(<CookieConsentBanner {...CONSENT_PROPS} />);
    act(() => acceptAllButton().click());
    act(() => reopenTrigger()!.click());
    const b = banner();
    expect(b).not.toBeNull();
    const analyticsInput = b!.querySelector('[data-category="analytics"] input') as HTMLInputElement;
    const marketingInput = b!.querySelector('[data-category="marketing"] input') as HTMLInputElement;
    expect(analyticsInput.checked).toBe(true);
    expect(marketingInput.checked).toBe(true);
  });

  it('always renders the necessary category checkbox as checked and disabled', () => {
    render(<CookieConsentBanner {...CONSENT_PROPS} />);
    const necessaryInput = banner()!.querySelector('[data-category="necessary"] input') as HTMLInputElement;
    expect(necessaryInput.checked).toBe(true);
    expect(necessaryInput.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/legal/banner.test.tsx`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Write `banner.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { ResolvedCookieConsent } from './types';
import { setConsent, useConsentDecision } from './consent-store';

type CookieConsentBannerProps = Omit<ResolvedCookieConsent, 'enabled'>;

/**
 * The engine's second client component (after MobileNav) — global,
 * always-mounted UI, not something an editor places in the composition tree
 * (Plugin/Legal Spec §5), same hand-rolled-not-DZ precedent ExamplePlugin set.
 *
 * Three states driven by useConsentDecision() plus one local panelOpen flag:
 * 1. No decision — the full banner (category rows + Accept All / Save Preferences).
 * 2. Decision exists, panel closed — a small persistent floating trigger.
 * 3. Trigger clicked — the same form as state 1, pre-filled from the current decision.
 */
export function CookieConsentBanner({
  bannerTitle,
  bannerDescription,
  acceptAllLabel,
  savePreferencesLabel,
  reopenTriggerLabel,
  necessaryCategory,
  analyticsCategory,
  marketingCategory,
}: CookieConsentBannerProps) {
  const decision = useConsentDecision();
  const [panelOpen, setPanelOpen] = useState(false);
  const [analytics, setAnalytics] = useState(decision?.analytics ?? false);
  const [marketing, setMarketing] = useState(decision?.marketing ?? false);

  const openPanel = () => {
    setAnalytics(decision?.analytics ?? false);
    setMarketing(decision?.marketing ?? false);
    setPanelOpen(true);
  };

  const acceptAll = () => {
    setConsent({ analytics: true, marketing: true });
    setPanelOpen(false);
  };

  const savePreferences = () => {
    setConsent({ analytics, marketing });
    setPanelOpen(false);
  };

  if (decision !== null && !panelOpen) {
    return (
      <button type="button" data-press-consent="reopen" onClick={openPanel}>
        {reopenTriggerLabel}
      </button>
    );
  }

  return (
    <div data-press-consent="banner" role="region" aria-label="Cookie preferences">
      <p data-press-consent="title">{bannerTitle}</p>
      <p data-press-consent="description">{bannerDescription}</p>
      <div data-press-consent="category" data-category="necessary">
        <label>
          <input type="checkbox" checked disabled />
          {necessaryCategory.label}
        </label>
        <p>{necessaryCategory.description}</p>
      </div>
      <div data-press-consent="category" data-category="analytics">
        <label>
          <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
          {analyticsCategory.label}
        </label>
        <p>{analyticsCategory.description}</p>
      </div>
      <div data-press-consent="category" data-category="marketing">
        <label>
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
          {marketingCategory.label}
        </label>
        <p>{marketingCategory.description}</p>
      </div>
      <button type="button" data-press-consent="accept-all" onClick={acceptAll}>
        {acceptAllLabel}
      </button>
      <button type="button" data-press-consent="save-preferences" onClick={savePreferences}>
        {savePreferencesLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/legal/banner.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full web suite + typecheck**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/plugins/legal/banner.tsx packages/web/src/plugins/legal/banner.test.tsx
git commit -m "feat(web): add the CookieConsentBanner client component (Plugin/Legal Eixo B)"
```

---

### Task 8: Web — anti-flash mount + `theme.css` rule + host `layout.tsx` wiring

Closes the one-frame flash gap for returning visitors and mounts the banner
in the host template, gated the same way `ExamplePlugin` is.

**Files:**
- Modify: `packages/web/theme.css`
- Modify: `packages/web/templates/host/app/layout.tsx`

**Interfaces:**
- Consumes: `CONSENT_ANTI_FLASH_SCRIPT` (Task 6), `CookieConsentBanner` (Task 7) — both re-exported by Task 9, imported here from `@ogs-tech/press-web` exactly like `ExamplePlugin` already is.

- [ ] **Step 1: Add the banner + anti-flash CSS to `theme.css`**

Append at the end of `packages/web/theme.css` (after the existing mobile-nav
block):

```css

/* Cookie consent banner + floating reopen trigger (Plugin/Legal Spec §5).
   Mounted globally in layout.tsx's <body>, not a tree-placed block — same
   data-attr namespace precedent as mobile-nav. The anti-flash script
   (consent-store.ts's CONSENT_ANTI_FLASH_SCRIPT) stamps
   data-press-consent-decided on <html> before hydration when a decision
   cookie already exists; this hides the momentarily server-rendered full
   banner for a returning visitor until React swaps to the floating trigger. */
[data-press-consent="banner"] {
  position: fixed;
  left: var(--press-space-4);
  right: var(--press-space-4);
  bottom: var(--press-space-4);
  z-index: 80;
  display: flex;
  flex-direction: column;
  gap: var(--press-space-3);
  max-width: 480px;
  margin-inline: auto;
  padding: var(--press-space-5);
  background: var(--press-color-surface);
  border: 1px solid var(--press-color-border);
  border-radius: var(--press-radius-md);
  box-shadow: 0 4px 24px color-mix(in srgb, var(--press-color-ink) 20%, transparent);
}
[data-press-consent-decided] [data-press-consent="banner"] {
  display: none;
}
[data-press-consent="title"] {
  margin: 0;
  font-weight: 600;
}
[data-press-consent="description"] {
  margin: 0;
  font-size: var(--press-text-sm);
  color: var(--press-color-ink);
}
[data-press-consent="category"] {
  display: flex;
  flex-direction: column;
  gap: var(--press-space-1);
}
[data-press-consent="category"] label {
  display: flex;
  align-items: center;
  gap: var(--press-space-2);
  font-weight: 500;
}
[data-press-consent="category"] p {
  margin: 0;
  font-size: var(--press-text-sm);
  color: var(--press-color-ink);
}
[data-press-consent="accept-all"],
[data-press-consent="save-preferences"] {
  padding: var(--press-space-2) var(--press-space-4);
  border-radius: var(--press-radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 500;
}
[data-press-consent="accept-all"] {
  background: var(--press-color-primary);
  color: var(--press-color-on-primary);
}
[data-press-consent="save-preferences"] {
  background: transparent;
  border-color: var(--press-color-border);
  color: var(--press-color-ink);
}
[data-press-consent="reopen"] {
  position: fixed;
  left: var(--press-space-4);
  bottom: var(--press-space-4);
  z-index: 80;
  padding: var(--press-space-2) var(--press-space-4);
  border-radius: var(--press-radius-sm);
  border: 1px solid var(--press-color-border);
  background: var(--press-color-surface);
  cursor: pointer;
  font-size: var(--press-text-sm);
}
```

- [ ] **Step 2: Verify the breakpoints/tokens guard still passes**

Run: `pnpm --filter @ogs-tech/press-web test src/layout/breakpoints.test.ts`
Expected: PASS (this task adds no new breakpoint, so the file's literal-vs-`BREAKPOINTS` guard is untouched — this step only confirms the CSS edit didn't break the file's parseability for that test's own reads).

- [ ] **Step 3: Mount the banner + anti-flash script in the host `layout.tsx`**

`packages/web/templates/host/app/layout.tsx`:

```tsx
import { Archivo, Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import {
  buildSeoMetadata,
  buildThemeStyle,
  getSiteConfig,
  ExamplePlugin,
  CookieConsentBanner,
  CONSENT_ANTI_FLASH_SCRIPT,
} from '@ogs-tech/press-web';
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

// Brand defaults, no page: title.template (or brand.name when the SEO plugin
// is disabled) + favicon. Fetched at runtime from the CMS (ISR ~60s) so
// editor changes appear without a redeploy. No `path` — this fallback only
// fires for routes outside the catch-all (e.g. error boundaries), where a
// page-specific canonical doesn't apply.
export async function generateMetadata() {
  return buildSeoMetadata(await getSiteConfig(buildTime), null);
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteConfig(buildTime);
  return (
    <html lang={site.site.locale} data-theme={buildTime.theme.name} className={fontVars}>
      <head>
        {/* The single injection point for token values (CMS-sourced or DEFAULT_THEME). */}
        <style dangerouslySetInnerHTML={{ __html: buildThemeStyle(site) }} />
        {/* Anti-flash (Plugin/Legal Spec §5): stamps data-press-consent-decided
            on <html> before hydration when a decision cookie already exists. */}
        <script dangerouslySetInnerHTML={{ __html: CONSENT_ANTI_FLASH_SCRIPT }} />
      </head>
      <body>
        {/* The page shell (header/main/footer) is rendered by TreeRenderer inside the
            route — the layout cannot see the slug, so it cannot resolve per-page
            slots (Spec §5). It keeps html/head and the theme injection only. */}
        {children}
        {site.plugins.example.enabled && <ExamplePlugin message={site.plugins.example.message} />}
        {site.plugins.legal.consent.enabled && <CookieConsentBanner {...site.plugins.legal.consent} />}
      </body>
    </html>
  );
}
```

Note: `packages/web/tsconfig.json` excludes `templates/`, so this file is
**not** covered by `pnpm --filter @ogs-tech/press-web typecheck` — it is only
typechecked when materialized into a real project's `.press/web`. Task 10
verifies it compiles and renders for real.

- [ ] **Step 4: Commit**

```bash
git add packages/web/theme.css packages/web/templates/host/app/layout.tsx
git commit -m "feat(web): mount CookieConsentBanner + anti-flash script in the host layout"
```

---

### Task 9: Web — package export surface + changesets

**Files:**
- Modify: `packages/web/src/index.ts`
- Create: `.changeset/plugin-legal.md`

**Interfaces:**
- Produces: public exports `CookieConsentBanner`, `hasConsent`, `resetConsent`, `CONSENT_ANTI_FLASH_SCRIPT`, and the `ResolvedLegalPlugin` type from `@ogs-tech/press-web` — the surface the host template (Task 8) and any adopter code consume. `setConsent`/`useConsentDecision` stay internal to `banner.tsx` — no external consumer needs them yet.

- [ ] **Step 1: Add the exports**

In `packages/web/src/index.ts`, right after the existing
`export type { ResolvedSeoPlugin } from './plugins/seo/types';` line:

```ts
export { CookieConsentBanner } from './plugins/legal/banner';
export { hasConsent, resetConsent, CONSENT_ANTI_FLASH_SCRIPT } from './plugins/legal/consent-store';
export type { ResolvedLegalPlugin } from './plugins/legal/types';
```

(`CONSENT_ANTI_FLASH_SCRIPT` is exported alongside `hasConsent`/`resetConsent`
so the host template's `layout.tsx` — outside this package — can mount it;
the original spec's §6 list omitted it, but §5's own mount instruction
requires the host to reach it, so this is a direct extension of that list,
not a deviation from it.)

- [ ] **Step 2: Run the full web suite + typecheck**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS

- [ ] **Step 3: Write the changeset**

`.changeset/plugin-legal.md`:

```markdown
---
'@ogs-tech/press-web': major
'@ogs-tech/press-cms': minor
---

feat: Plugin/Legal — seeded privacy-policy page + category-based cookie-consent banner

The engine's third real plugin, built on the Base/Plugin framework: LGPD/GDPR
compliance end-to-end under one `ResolvedPressConfig.plugins.legal` key.

**Eixo A — privacy-policy seed.** A new `preset-config.legal-pages` Site
Settings component (`enabled`, default true) gates `seedLegalPages`, a
bootstrap step built on the existing `seedPage` primitive: it creates a DRAFT
"Privacy Policy" page (slug `privacy-policy`, a placeholder heading +
paragraph) exactly once, respecting an adopter's own page on that slug and
never re-seeding after an editor deletes it. `seedPage`'s `body` parameter is
also corrected from the pre-tree Dynamic Zone array shape (`unknown[]`) to
`PressTree` — a stale type nobody had exercised since the composition-tree
migration, since `seedPage` had no real caller until this plugin.

**Eixo B — cookie-consent banner + hasConsent() gate.** A new
`preset-config.cookie-consent` Site Settings component (banner copy + three
named category fields — necessary/analytics/marketing, a closed union, not a
repeatable list) feeds a client-only `press_consent` cookie store
(`useSyncExternalStore`, 180-day `SameSite=Lax` cookie, version-guarded
parsing that treats any malformed value as no decision) and a hand-rolled
`'use client'` `CookieConsentBanner` — the engine's second client component
after `MobileNav`. Three states: full banner (no decision), a floating reopen
trigger (decision exists), and the same form reopened pre-filled. An inline
anti-flash `<script>` (the `buildThemeStyle` `<style>`-injection precedent)
stamps `data-press-consent-decided` on `<html>` before hydration so a
returning visitor never sees the full banner flash. `hasConsent(category)` is
exported, tested, fail-closed — no consumer wired in this plugin yet (same
"ready, not yet called" posture `seedPage` had before this spec).

Both toggles are mirrored into the read-only `plugin::press-cms.plugin`
Content-Manager index as two independently-toggleable entries (`legal-pages`,
`legal-consent`), same as every prior plugin.

**Ships enabled by default** — the "core surface, not a demo" reasoning `seo`
already established, not `example`'s "ships disabled" precedent.

BREAKING (press-web): `ResolvedPressConfig.plugins` gains the required
`legal: ResolvedLegalPlugin` key.

press-cms is additive only: three new components, two new Site Settings
attributes, one controller populate change, one bootstrap step, two new
`PLUGIN_DEFINITIONS` entries.
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/index.ts .changeset/plugin-legal.md
git commit -m "feat(web): export CookieConsentBanner/hasConsent/resetConsent; add plugin-legal changeset"
```

---

### Task 10: Manual verification in the dogfood playground

CLAUDE.md requires starting the dev server and exercising a UI change in a
browser before calling it done — automated tests cover correctness, not
whether the feature actually renders end to end. The playground loads the
compiled `press-cms` `dist`, so it must be rebuilt first.

**Files:** none (verification only).

- [ ] **Step 1: Rebuild `press-cms`**

Run: `pnpm --filter @ogs-tech/press-cms build`
Expected: builds cleanly (this compiles `server/src` → `dist`, which is what
the playground's Strapi instance actually loads).

- [ ] **Step 2: Boot the playground**

Run: `pnpm dev`
Expected: cms boots at `:1337/admin`, web at `:3000`, no crash-exit (per
CLAUDE.md's "process orchestration is crash-aware" — a non-zero exit here
means stop and diagnose, not proceed).

- [ ] **Step 3: Verify the Site Settings admin fields**

In `http://localhost:1337/admin`, open Content Manager → Site Settings.
Expected: a "Legal Pages" section (one `Enabled` toggle) and a "Cookie
Consent" section (banner copy fields + Necessary/Analytics/Marketing
sub-sections) both render, matching the labels from Task 2.

- [ ] **Step 4: Verify the seeded privacy-policy page**

In Content Manager → Page (or Pages), confirm a **draft** page titled
"Privacy Policy" exists at slug `privacy-policy` with a heading and one
paragraph block in its Composition field.

- [ ] **Step 5: Verify the plugin index**

In Content Manager → Plugin, confirm two rows: `legal-pages` and
`legal-consent`, both `enabled: true`.

- [ ] **Step 6: Verify the cookie banner in the browser**

Open `http://localhost:3000` in a fresh/incognito session (no `press_consent`
cookie). Expected: the cookie banner renders with the default English copy
("We use cookies", Accept all / Save preferences buttons, three category
rows, Necessary locked on).

- [ ] **Step 7: Verify Accept All + the anti-flash swap**

Click "Accept all". Expected: the banner disappears and the floating "Cookie
preferences" trigger appears. Reload the page. Expected: the full banner does
**not** flash before the trigger appears (the anti-flash script hid it).

- [ ] **Step 8: Verify the reopen flow**

Click the floating trigger. Expected: the full form reopens with Analytics
and Marketing both checked (matching the Accept All decision from Step 7).

- [ ] **Step 9: Stop the dev server**

Stop `pnpm dev` (Ctrl+C). No commit for this task — it is verification only.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-01-plugin-legal.md`.
