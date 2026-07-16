# BASE/PLUGIN — CMS management (plugin entity + toggle + config re-home) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the engine a CMS-managed `plugin` collection type — one entry per installed engine plugin — where an `enabled` toggle natively shows/hides that plugin's config (Strapi conditional fields), and re-home the cookie-consent config from Site Settings onto its plugin entry so `enabled` has a single source of truth.

**Architecture:** A plugin is a canonical entity the engine installs/uninstalls. `press-cms` gains a `plugin` collection type whose entries are upserted every boot from a static `PLUGIN_MANIFEST` (`syncPluginEntries`), pruning entries no longer shipped. Each entry carries `enabled` (editor-owned) + a `config` dynamiczone gated by a schema-declared `conditions.visible` JSON-Logic rule (same-entry boolean → native, no custom admin JS). Cookie-consent's config component moves off the Site Settings single type onto the plugin entry, and its old top-level `enabled` field is deleted (the plugin entry's `enabled` is now the only source). `press-web` reads the entries from a new public `GET /api/press/plugins`, maps them into the existing `ResolvedPressConfig.plugins` named map (fail-open), and mounts the banner exactly as before.

**Tech Stack:** TypeScript, Strapi 5.48 plugin (Document Service + plugin-store + schema-declared `conditions.visible` JSON Logic), Next.js 15 App Router (RSC + ISR), vitest, changesets, pnpm workspaces.

## Global Constraints

- **Node 20.x, pnpm 10.x** — run everything from the repo root.
- **Quality gate is typecheck + tests** (there is no eslint): `pnpm -r --if-present typecheck` and `pnpm -r test`.
- **Single source of truth for `enabled`** — after this plan, a plugin's on/off lives ONLY on its `plugin` entry. No `enabled` field survives on `preset-config.cookie-consent`. Never reintroduce a second toggle.
- **`conditions.visible` is JSON Logic**, shape `{ "<op>": [ ... ] }` where each op maps to an array (Strapi's `conditionSchema = z.object({ visible: z.record(z.string(), z.array(z.any())) })`). The one used here is `{ "==": [ { "var": "enabled" }, true ] }`.
- **Cookie-consent FAILS OPEN** — an absent/unreachable CMS (or a missing plugin entry) still resolves `enabled: true` + total default copy. This is the deliberate exception to identity/SEO's fail-to-empty rule; never "fix" it to fail closed.
- **A urn is never sent or stored by press-cms** — the `plugin` content-type has NO `urn` field; the web synthesizes `urn:plugin:{id}`.
- **`preset-config.*` stays outside the type-sync pipeline** (`GET /api/press/schema` + generator). The plugin `config` DZ must NOT change `shared/types/generated.ts`. Verify with a gen + git-diff check.
- **Never hand-edit `apps/playground/.press/web/**`** — engine-owned, regenerated. Edit only `packages/web/templates/host/**` source.
- **All code, comments, identifiers in English.**
- **Changesets required** for every engine change (`.changeset/`). Both packages bump `minor` (pre-release 0.x); flag the breaking nature with `!` in commit subjects.
- **Do not `git push`, publish, or run `changeset publish`.** This plan ends at a committed, green working tree.
- **cms single-file test invocation:** cms has no vitest config; run one file via `pnpm --filter @ogs-tech/press-cms exec vitest run <path>`. Backend tsc: `pnpm --filter @ogs-tech/press-cms test:ts:back`.
- **web single-file test invocation:** `pnpm --filter @ogs-tech/press-web test <path>`.

---

## File Structure

**`packages/cms` (press-cms) — producer:**
- Create: `server/src/content-types/plugin/schema.json` — the `plugin` collection type (`pluginId`, `displayName`, `description`, `enabled`, `config` DZ with `conditions.visible`).
- Modify: `server/src/content-types/index.ts` — register the new content-type.
- Create: `server/src/lib/plugin-manifest.ts` — `PLUGIN_MANIFEST` + `PluginManifestEntry`.
- Create: `server/src/lib/sync-plugin-entries.ts` — `PLUGIN_UID` + `syncPluginEntries()` (upsert existence/metadata + prune).
- Create: `server/src/lib/sync-plugin-entries.test.ts` — unit tests (fake-strapi harness).
- Modify: `server/src/bootstrap.ts` — call `syncPluginEntries`; drop `seedCookieConsent`.
- Create: `server/src/controllers/plugin.ts` — public `find` returning entries with `config` populated.
- Modify: `server/src/controllers/index.ts` — register the `plugin` controller.
- Modify: `server/src/routes/content-api/index.ts` — add `GET /press/plugins`.
- Modify: `server/src/components/config/cookie-consent.json` — remove the `enabled` attribute + metadata.
- Modify: `server/src/content-types/site-setting/schema.json` — remove the `cookieConsent` attribute + metadata.
- Modify: `server/src/controllers/site-setting.ts` — remove the `cookieConsent` populate.
- Delete: `server/src/lib/seed-cookie-consent.ts` + `server/src/lib/seed-cookie-consent.test.ts`.

**`packages/web` (press-web) — consumer:**
- Modify: `src/config/types.ts` — add `RawPluginEntry`; remove `cookieConsent` from `SiteSettingsData`.
- Modify: `src/plugins/cookie-consent/types.ts` — remove `enabled` from `RawCookieConsent`.
- Modify: `src/plugins/cookie-consent/map-cookie-consent.ts` — take `enabled` as a parameter (no longer read from raw config).
- Modify: `src/plugins/cookie-consent/map-cookie-consent.test.ts` — pass `enabled`.
- Create: `src/plugins/map-plugins.ts` — `mapPlugins(entries, homeSlug)` → `ResolvedPressConfig['plugins']`.
- Create: `src/plugins/map-plugins.test.ts` — unit tests (fail-open, entry-sourced enabled).
- Modify: `src/map-site-settings.ts` — take `plugins` arg; delegate to `mapPlugins`; drop the inline cookie-consent call.
- Modify: `src/map-site-settings.test.ts` — new `mapSiteSettings` signature; move the cookie-consent assertions.
- Modify: `src/get-site-config.ts` — parallel-fetch site-setting + plugins (both fail-open), pass both to `mapSiteSettings`.
- Modify: `src/get-site-config.test.ts` — stub both endpoints.

**Repo root — release:**
- Create: `.changeset/base-plugin-cms-management.md`.

**Reconnaissance already confirmed (do not re-litigate):**
- `conditions` is a base-attribute schema property (`@strapi/types/dist/schema/attribute/base.d.ts:47`) validated by the content-type-builder — it is declarable in `schema.json`, not admin-only. Shape: `conditions: { visible: JsonLogicCondition }`.
- `serialize-schema` walks only `page` + `site-setting` and their DZ-admitted/nested components; the new `plugin` content-type + its `config` DZ are outside the type-sync pipeline (like `cookieConsent` is today). No generator change expected — Task 8 verifies.
- The layout mount reads `site.plugins.cookieConsent` (`templates/host/app/layout.tsx:59`) — unchanged; the data source behind it changes, the mount does not.
- `preset-config.cookie-consent` is already injected (`inject-components.ts:94`) and stays injected; only the plugin content-type's `config` DZ now references it (in addition to nothing else — it leaves Site Settings).

---

### Task 1: The `plugin` content-type + manifest + native conditional visibility (`press-cms`)

**Files:**
- Create: `packages/cms/server/src/content-types/plugin/schema.json`
- Modify: `packages/cms/server/src/content-types/index.ts:1-7`
- Create: `packages/cms/server/src/lib/plugin-manifest.ts`

**Interfaces:**
- Produces:
  - Content-type UID `plugin::press-cms.plugin` (collectionType, `draftAndPublish: false`) with attributes `pluginId: string (unique, required)`, `displayName: string`, `description: text`, `enabled: boolean (default false)`, `config: dynamiczone` admitting `preset-config.cookie-consent`, gated by `conditions.visible = { "==": [ { "var": "enabled" }, true ] }`.
  - `export interface PluginManifestEntry { id: string; displayName: string; description: string; defaultEnabled: boolean }`
  - `export const PLUGIN_MANIFEST: readonly PluginManifestEntry[]` — one entry, `cookie-consent` (`defaultEnabled: true`).

- [ ] **Step 1: Create the content-type schema**

Create `packages/cms/server/src/content-types/plugin/schema.json`:

```json
{
  "kind": "collectionType",
  "collectionName": "press_plugins",
  "info": {
    "singularName": "plugin",
    "pluralName": "plugins",
    "displayName": "Plugins",
    "description": "Engine plugins installed on this site. Entries are engine-managed (synced on boot); an editor toggles each plugin on/off and edits its configuration."
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {},
  "attributes": {
    "pluginId": { "type": "string", "required": true, "unique": true },
    "displayName": { "type": "string" },
    "description": { "type": "text" },
    "enabled": { "type": "boolean", "default": false },
    "config": {
      "type": "dynamiczone",
      "components": ["preset-config.cookie-consent"],
      "conditions": { "visible": { "==": [{ "var": "enabled" }, true] } }
    }
  },
  "config": {
    "metadatas": {
      "pluginId": { "edit": { "label": "Plugin ID", "description": "Engine-managed identifier — do not edit." } },
      "displayName": { "edit": { "label": "Name", "description": "Engine-managed." } },
      "description": { "edit": { "label": "Description", "description": "Engine-managed." } },
      "enabled": { "edit": { "label": "Enabled", "description": "Turn this plugin on or off. Its configuration appears only while enabled." } },
      "config": { "edit": { "label": "Configuration", "description": "Settings for this plugin. Shown only when the plugin is enabled." } }
    }
  }
}
```

- [ ] **Step 2: Register the content-type**

Replace `packages/cms/server/src/content-types/index.ts` with:

```ts
import page from './page/schema.json';
import siteSetting from './site-setting/schema.json';
import plugin from './plugin/schema.json';

export default {
  page: { schema: page },
  'site-setting': { schema: siteSetting },
  plugin: { schema: plugin },
};
```

- [ ] **Step 3: Create the plugin manifest**

Create `packages/cms/server/src/lib/plugin-manifest.ts`:

```ts
/**
 * The engine's INSTALLED plugin manifest — the CMS-side source of truth for
 * "which plugins ship with this engine build". press-cms and press-web version
 * independently and share no runtime code (press-shared is imported type-only),
 * so the CMS keeps its own list; adding a plugin already costs a coordinated
 * cms+web change, and one manifest line is part of that cost.
 *
 * `syncPluginEntries` upserts one `plugin` collection entry per manifest entry
 * on every boot (installing the canonical `plugin` entity) and prunes entries
 * whose id left the manifest (uninstalling). `defaultEnabled` is the on/off state
 * a FRESH entry is created with — cookie-consent installs enabled (fails open on
 * an LGPD obligation); a later editor toggle is never overwritten.
 */
export interface PluginManifestEntry {
  /** Compile-time constant id — the sync key and the web urn segment (urn:plugin:{id}). */
  id: string;
  /** Human label mirrored onto the entry (engine-owned). */
  displayName: string;
  /** Short description mirrored onto the entry (engine-owned). */
  description: string;
  /** Enabled state a freshly-installed entry is created with. Editor toggles win thereafter. */
  defaultEnabled: boolean;
}

export const PLUGIN_MANIFEST: readonly PluginManifestEntry[] = [
  {
    id: 'cookie-consent',
    displayName: 'Cookie Consent',
    description: 'LGPD/GDPR cookie-consent banner served at runtime by the engine.',
    defaultEnabled: true,
  },
];
```

- [ ] **Step 4: Typecheck the cms backend**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: clean (new JSON + TS compile; `conditions` is a valid attribute property in `@strapi/types`).

- [ ] **Step 5: Verify the content-type + native conditional visibility in the admin**

Boot the playground and drive the admin (this de-risks the load-bearing assumption that `conditions.visible` hides a dynamiczone based on a same-entry boolean):

```bash
pnpm dev   # boots cms :1337/admin + web :3000
```

In the admin (`http://localhost:1337/admin`), verify (via `/run` or the browser):
- **Content Manager shows a "Plugins" collection type.**
- Create/open an entry, set `enabled = false` → the **Configuration** dynamiczone is HIDDEN.
- Set `enabled = true` → the **Configuration** dynamiczone APPEARS and offers the "Cookie Consent" block.

Record the observed evidence (screenshot or note) in the task notes. **If the DZ does not hide/show:** the fallback is a non-repeatable `component` field (`"config": { "type": "component", "repeatable": false, "component": "preset-config.cookie-consent", "conditions": {...} }`) — a component field is the simplest attribute the feature supports; note the pivot and re-verify before proceeding. Do not proceed to Task 2 until the toggle demonstrably gates the config's visibility.

- [ ] **Step 6: Commit**

```bash
git add packages/cms/server/src/content-types/plugin/schema.json \
  packages/cms/server/src/content-types/index.ts \
  packages/cms/server/src/lib/plugin-manifest.ts
git commit -m "feat(cms): add engine plugin collection type + manifest (enabled gates config via native conditions)"
```

---

### Task 2: `syncPluginEntries` — install/uninstall the plugin entities on boot (`press-cms`)

**Files:**
- Create: `packages/cms/server/src/lib/sync-plugin-entries.ts`
- Create: `packages/cms/server/src/lib/sync-plugin-entries.test.ts`
- Modify: `packages/cms/server/src/bootstrap.ts:1-13`

**Interfaces:**
- Consumes: `PLUGIN_MANIFEST` from `./plugin-manifest`; `strapi.documents(uid)` Document Service (`findFirst`, `findMany`, `create`, `update`, `delete`).
- Produces:
  - `export const PLUGIN_UID = 'plugin::press-cms.plugin'`
  - `export async function syncPluginEntries(strapi: Core.Strapi): Promise<void>`
  Behavior: for each manifest entry, create it (with `enabled: defaultEnabled`) if absent, else update ONLY `displayName`/`description` if they drifted (never `enabled`/`config`); then delete any entry whose `pluginId` is not in the manifest. No plugin-store flag — this is an unconditional per-boot upsert (a stronger guarantee than "seed once").

- [ ] **Step 1: Write the failing test**

Create `packages/cms/server/src/lib/sync-plugin-entries.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PLUGIN_UID, syncPluginEntries } from './sync-plugin-entries';
import { PLUGIN_MANIFEST } from './plugin-manifest';

/**
 * Minimal Document-Service fake: a mutable entry list keyed by pluginId,
 * recording creates/updates/deletes. No plugin-store — syncPluginEntries is
 * flagless (unconditional per-boot upsert).
 */
function fakeStrapi(entries: any[] = []) {
  const creates: Array<{ data: any }> = [];
  const updates: Array<{ documentId: string; data: any }> = [];
  const deletes: Array<{ documentId: string }> = [];
  const list = [...entries];
  const strapi = {
    documents: (uid: string) => {
      expect(uid).toBe(PLUGIN_UID);
      return {
        findFirst: async (params: any) => list.find((e) => e.pluginId === params?.filters?.pluginId) ?? null,
        findMany: async () => list,
        create: async (params: { data: any }) => {
          creates.push(params);
          const doc = { documentId: `doc-${list.length + 1}`, ...params.data };
          list.push(doc);
          return doc;
        },
        update: async (params: { documentId: string; data: any }) => {
          updates.push(params);
          const doc = list.find((e) => e.documentId === params.documentId);
          Object.assign(doc, params.data);
          return doc;
        },
        delete: async (params: { documentId: string }) => {
          deletes.push(params);
          const i = list.findIndex((e) => e.documentId === params.documentId);
          if (i >= 0) list.splice(i, 1);
        },
      };
    },
  } as any;
  return { strapi, creates, updates, deletes, list };
}

const CC = PLUGIN_MANIFEST.find((p) => p.id === 'cookie-consent')!;

describe('syncPluginEntries — install/uninstall canonical plugin entities per boot', () => {
  it('creates a missing manifest entry with defaultEnabled and the engine metadata', async () => {
    const { strapi, creates } = fakeStrapi();
    await syncPluginEntries(strapi);
    expect(creates).toEqual([
      { data: { pluginId: 'cookie-consent', displayName: CC.displayName, description: CC.description, enabled: CC.defaultEnabled } },
    ]);
    // cookie-consent fails open: installs enabled.
    expect(CC.defaultEnabled).toBe(true);
  });

  it('never overwrites an editor-owned enabled or config on an existing entry', async () => {
    const { strapi, creates, updates } = fakeStrapi([
      { documentId: 'doc-1', pluginId: 'cookie-consent', displayName: CC.displayName, description: CC.description, enabled: false, config: [{ __component: 'preset-config.cookie-consent', title: 'Custom' }] },
    ]);
    await syncPluginEntries(strapi);
    expect(creates).toEqual([]);
    expect(updates).toEqual([]); // metadata unchanged → no write; enabled:false + config preserved
  });

  it('syncs drifted engine metadata (displayName/description) but not enabled/config', async () => {
    const { strapi, updates } = fakeStrapi([
      { documentId: 'doc-1', pluginId: 'cookie-consent', displayName: 'Stale', description: 'old', enabled: false },
    ]);
    await syncPluginEntries(strapi);
    expect(updates).toEqual([
      { documentId: 'doc-1', data: { displayName: CC.displayName, description: CC.description } },
    ]);
  });

  it('prunes an entry whose pluginId left the manifest (uninstall)', async () => {
    const { strapi, deletes, list } = fakeStrapi([
      { documentId: 'doc-1', pluginId: 'cookie-consent', displayName: CC.displayName, description: CC.description, enabled: true },
      { documentId: 'doc-9', pluginId: 'legacy-thing', displayName: 'Legacy', description: '', enabled: true },
    ]);
    await syncPluginEntries(strapi);
    expect(deletes).toEqual([{ documentId: 'doc-9' }]);
    expect(list.map((e) => e.pluginId)).toEqual(['cookie-consent']);
  });

  it('is idempotent across repeated boots — no create/update/delete on a steady state', async () => {
    const { strapi, creates, updates, deletes } = fakeStrapi();
    await syncPluginEntries(strapi); // installs
    await syncPluginEntries(strapi); // steady
    await syncPluginEntries(strapi); // steady
    expect(creates).toHaveLength(1);
    expect(updates).toEqual([]);
    expect(deletes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-cms exec vitest run server/src/lib/sync-plugin-entries.test.ts`
Expected: FAIL — `Cannot find module './sync-plugin-entries'`.

- [ ] **Step 3: Implement `syncPluginEntries`**

Create `packages/cms/server/src/lib/sync-plugin-entries.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { PLUGIN_MANIFEST } from './plugin-manifest';

/** UID of the engine's plugin collection type (plugin name `press-cms`). */
export const PLUGIN_UID = 'plugin::press-cms.plugin';

/**
 * Installs/uninstalls the canonical `plugin` entities on every boot — the CMS
 * mirror of what the engine build ships (PLUGIN_MANIFEST). Unlike the seed
 * helpers (run-once, plugin-store-flagged), this is an UNCONDITIONAL upsert:
 * "read-only mirror, resynced every boot" is a stronger guarantee than "seeded
 * once", so there is no flag.
 *
 * Ownership split (no ambiguity): the ENGINE owns each entry's existence +
 * display metadata (pluginId/displayName/description); the EDITOR owns `enabled`
 * and `config`. So:
 *   - missing entry  → create with { enabled: defaultEnabled } (fresh install).
 *   - existing entry → update ONLY drifted displayName/description; NEVER touch
 *     enabled/config (an editor's toggle + settings are respected forever).
 *   - entry whose pluginId left the manifest → delete (uninstall).
 */
export async function syncPluginEntries(strapi: Core.Strapi): Promise<void> {
  const docs = strapi.documents(PLUGIN_UID as any);
  const manifestIds = new Set(PLUGIN_MANIFEST.map((p) => p.id));

  for (const p of PLUGIN_MANIFEST) {
    const existing = (await docs.findFirst({ filters: { pluginId: p.id } } as any)) as any;
    if (!existing) {
      await docs.create({
        data: { pluginId: p.id, displayName: p.displayName, description: p.description, enabled: p.defaultEnabled } as any,
      });
    } else if (existing.displayName !== p.displayName || existing.description !== p.description) {
      // Engine owns display metadata only — enabled + config are the editor's.
      await docs.update({
        documentId: existing.documentId,
        data: { displayName: p.displayName, description: p.description } as any,
      });
    }
  }

  // Uninstall: an entry whose plugin left the build is pruned. Its config is
  // engine-scoped data (not editor content that lives elsewhere), so removing it
  // with the plugin is correct.
  const all = (await docs.findMany({ fields: ['pluginId'] } as any)) as any[];
  for (const entry of all) {
    if (!manifestIds.has(entry.pluginId)) {
      await docs.delete({ documentId: entry.documentId } as any);
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-cms exec vitest run server/src/lib/sync-plugin-entries.test.ts`
Expected: PASS — all five tests green.

- [ ] **Step 5: Wire `syncPluginEntries` into bootstrap (and drop `seedCookieConsent`)**

Replace `packages/cms/server/src/bootstrap.ts` with:

```ts
import type { Core } from '@strapi/strapi';
import { seedSiteSetting } from './lib/seed-site-setting';
import { syncPluginEntries } from './lib/sync-plugin-entries';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  await seedSiteSetting(strapi);
  // Installs/uninstalls the canonical `plugin` entities to mirror the engine
  // build (PLUGIN_MANIFEST). Independent of the Site Settings record — plugin
  // config now lives on the plugin entries, not on Site Settings.
  await syncPluginEntries(strapi);
};

export default bootstrap;
```

> Note: `seedCookieConsent` is intentionally removed here. Its file + test are deleted in Task 4 (with the rest of the Site Settings cookie-consent surface) so this task stays a clean "add the sync" unit. Between this commit and Task 4 the `seed-cookie-consent.ts` file is unused but still compiles.

- [ ] **Step 6: Typecheck the cms backend + run the cms suite**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back && pnpm --filter @ogs-tech/press-cms test`
Expected: typecheck clean; all cms tests PASS (existing seed-cookie-consent test still green — it is deleted in Task 4).

- [ ] **Step 7: Commit**

```bash
git add packages/cms/server/src/lib/sync-plugin-entries.ts \
  packages/cms/server/src/lib/sync-plugin-entries.test.ts \
  packages/cms/server/src/bootstrap.ts
git commit -m "feat(cms): syncPluginEntries — install/uninstall plugin entities per boot"
```

---

### Task 3: Public read API — `GET /api/press/plugins` (`press-cms`)

**Files:**
- Create: `packages/cms/server/src/controllers/plugin.ts`
- Modify: `packages/cms/server/src/controllers/index.ts:1-6`
- Modify: `packages/cms/server/src/routes/content-api/index.ts:14-22`

**Interfaces:**
- Consumes: `strapi.documents(PLUGIN_UID).findMany(...)`.
- Produces: `GET /api/press/plugins` (public, `auth: false`, `prefix: ''`) → `{ data: PluginEntry[] }`, each entry with `pluginId`, `enabled`, and a deep-populated `config` dynamiczone (cookie-consent block → `necessary`/`analytics`/`marketing` components + `privacyPage.slug`).

- [ ] **Step 1: Create the controller**

Create `packages/cms/server/src/controllers/plugin.ts`:

```ts
import type { Core } from '@strapi/strapi';

const PLUGIN_UID = 'plugin::press-cms.plugin';

/**
 * Engine-owned public read for the plugin entries (the CMS mirror of installed
 * plugins). The web resolver maps this into ResolvedPressConfig.plugins; the urn
 * is synthesized web-side and never travels here.
 *
 * The `config` dynamiczone is deep-populated per component: `populate: '*'` is
 * shallow, so the cookie-consent block's nested category components and its
 * privacy page's slug (one level below `'*'`) are requested explicitly — the
 * same reason site-setting.ts deep-populates cookieConsent today.
 */
const plugin = ({ strapi }: { strapi: Core.Strapi }) => {
  const configPopulate = () => ({
    on: {
      'preset-config.cookie-consent': {
        populate: {
          necessary: true,
          analytics: true,
          marketing: true,
          privacyPage: { fields: ['slug'] },
        },
      },
    },
  });

  return {
    async find(ctx: any) {
      const data = await strapi
        .documents(PLUGIN_UID as any)
        .findMany({ populate: { config: configPopulate() } } as any);
      ctx.body = { data };
    },
  };
};

export default plugin;
```

- [ ] **Step 2: Register the controller**

Replace `packages/cms/server/src/controllers/index.ts` with:

```ts
import controller from './controller';
import page from './page';
import plugin from './plugin';
import schema from './schema';
import siteSetting from './site-setting';

export default { controller, page, plugin, schema, 'site-setting': siteSetting };
```

- [ ] **Step 3: Add the route**

In `packages/cms/server/src/routes/content-api/index.ts`, add the plugins route to the `routes` array (after the `/site-setting` line):

```ts
    { method: 'GET', path: '/site-setting', handler: 'site-setting.find', config: { auth: false, prefix: '' } },
    { method: 'GET', path: '/press/plugins', handler: 'plugin.find', config: { auth: false, prefix: '' } },
```

- [ ] **Step 4: Typecheck + verify the endpoint end-to-end**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: clean.

Then boot and hit the endpoint:

```bash
pnpm dev
curl -s http://localhost:1337/api/press/plugins | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
```

Expected: `{ "data": [ { "pluginId": "cookie-consent", "enabled": true, ... "config": [] } ] }` (config empty until an editor adds the block). Confirm the entry was installed by `syncPluginEntries` on boot. Record the output in the task notes.

- [ ] **Step 5: Commit**

```bash
git add packages/cms/server/src/controllers/plugin.ts \
  packages/cms/server/src/controllers/index.ts \
  packages/cms/server/src/routes/content-api/index.ts
git commit -m "feat(cms): public GET /api/press/plugins (entries + populated config DZ)"
```

---

### Task 4: Single source of truth — remove cookie-consent from Site Settings (`press-cms`)

**Files:**
- Modify: `packages/cms/server/src/components/config/cookie-consent.json:9-25`
- Modify: `packages/cms/server/src/content-types/site-setting/schema.json:21,63`
- Modify: `packages/cms/server/src/controllers/site-setting.ts:30-38`
- Delete: `packages/cms/server/src/lib/seed-cookie-consent.ts`
- Delete: `packages/cms/server/src/lib/seed-cookie-consent.test.ts`

**Interfaces:**
- Produces: `preset-config.cookie-consent` with NO `enabled` attribute; Site Settings with NO `cookieConsent` attribute; the site-setting controller no longer populates `cookieConsent`. The plugin entry's `enabled` is now the only enabled source.

- [ ] **Step 1: Remove the `enabled` attribute from the cookie-consent component**

In `packages/cms/server/src/components/config/cookie-consent.json`, delete the `enabled` line from `attributes` (line 10) and the `enabled` line from `config.metadatas` (line 25). The `attributes` block becomes:

```json
  "attributes": {
    "title": { "type": "string" },
    "description": { "type": "text" },
    "acceptAllLabel": { "type": "string" },
    "rejectAllLabel": { "type": "string" },
    "manageLabel": { "type": "string" },
    "saveLabel": { "type": "string" },
    "privacyLinkLabel": { "type": "string" },
    "privacyPage": { "type": "relation", "relation": "oneToOne", "target": "plugin::press-cms.page" },
    "necessary": { "type": "component", "repeatable": false, "component": "preset-config.cookie-category" },
    "analytics": { "type": "component", "repeatable": false, "component": "preset-config.cookie-category" },
    "marketing": { "type": "component", "repeatable": false, "component": "preset-config.cookie-category" }
  },
```

and the `config.metadatas` block drops its `enabled` entry (keep every other key exactly as-is):

```json
  "config": {
    "metadatas": {
      "title": { "edit": { "label": "Title", "description": "Leave empty to use the engine default." } },
      "description": { "edit": { "label": "Banner text", "description": "Leave empty to use the engine default." } },
      "acceptAllLabel": { "edit": { "label": "\"Accept all\" label" } },
      "rejectAllLabel": { "edit": { "label": "\"Reject optional\" label" } },
      "manageLabel": { "edit": { "label": "\"Manage preferences\" label" } },
      "saveLabel": { "edit": { "label": "\"Save preferences\" label" } },
      "privacyLinkLabel": { "edit": { "label": "Privacy link label" } },
      "privacyPage": { "edit": { "label": "Privacy policy page", "description": "Internal page linked from the banner (resolves to its slug; survives renames)." } },
      "necessary": { "edit": { "label": "Necessary category", "description": "Always granted — visitors cannot opt out of it." } },
      "analytics": { "edit": { "label": "Analytics category" } },
      "marketing": { "edit": { "label": "Marketing category" } }
    }
  }
```

- [ ] **Step 2: Remove the `cookieConsent` attribute from Site Settings**

In `packages/cms/server/src/content-types/site-setting/schema.json`, delete the `cookieConsent` attribute (line 21) and its `config.metadatas` entry (line 63). Nothing else changes.

- [ ] **Step 3: Remove the `cookieConsent` populate from the site-setting controller**

In `packages/cms/server/src/controllers/site-setting.ts`, delete the `cookieConsent` block from `chromePopulate()` (lines 29-38, the `// Nested category components...` comment through the closing `},`). The returned object becomes:

```ts
    return {
      logo: true,
      favicon: true,
      seo: { populate: { image: true } },
      themeColors: true,
      themeRadius: true,
      header: buildChromeDzPopulate(header),
      footer: buildChromeDzPopulate(footer),
    };
```

- [ ] **Step 4: Delete the seed-cookie-consent module + test**

```bash
git rm packages/cms/server/src/lib/seed-cookie-consent.ts \
       packages/cms/server/src/lib/seed-cookie-consent.test.ts
```

(The bootstrap call was already removed in Task 2.)

- [ ] **Step 5: Verify nothing still references the removed symbols**

Run: `grep -rn "seedCookieConsent\|DEFAULT_COOKIE_CONSENT_SEED\|cookieConsent" packages/cms/server/src`
Expected: **no matches.** (Every cms-side reference is gone. The web-side `cookieConsent` key on `ResolvedPressConfig.plugins` is a different concept and is handled in Tasks 5-7.)

- [ ] **Step 6: Typecheck + run the cms suite**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back && pnpm --filter @ogs-tech/press-cms test`
Expected: typecheck clean; cms tests PASS (seed-cookie-consent test is gone; sync-plugin-entries + seed-site-setting + seed-page remain green).

- [ ] **Step 7: Commit**

```bash
git add -A packages/cms
git commit -m "refactor(cms)!: move cookie-consent off Site Settings onto its plugin entry (single enabled source)"
```

---

### Task 5: Web — cookie-consent `enabled` becomes a parameter (`press-web`)

**Files:**
- Modify: `packages/web/src/plugins/cookie-consent/types.ts:38-51`
- Modify: `packages/web/src/plugins/cookie-consent/map-cookie-consent.ts:29-64`
- Modify: `packages/web/src/plugins/cookie-consent/map-cookie-consent.test.ts`

**Interfaces:**
- Produces: `mapCookieConsent(raw: RawCookieConsent | null | undefined, homeSlug: string, enabled: boolean): ResolvedCookieConsentPlugin`. `RawCookieConsent` no longer has an `enabled` field (it is not a config field anymore). The resolved `enabled` is taken from the `enabled` parameter (sourced from the plugin entry by the caller).

- [ ] **Step 1: Remove `enabled` from `RawCookieConsent`**

In `packages/web/src/plugins/cookie-consent/types.ts`, delete the `enabled?: boolean;` line (line 39) from the `RawCookieConsent` interface. The interface now starts at `title?`:

```ts
export interface RawCookieConsent {
  title?: string;
  description?: string;
  acceptAllLabel?: string;
  rejectAllLabel?: string;
  manageLabel?: string;
  saveLabel?: string;
  privacyLinkLabel?: string;
  privacyPage?: { slug?: string } | null;
  necessary?: RawCookieCategory | null;
  analytics?: RawCookieCategory | null;
  marketing?: RawCookieCategory | null;
}
```

- [ ] **Step 2: Rewrite the map-cookie-consent test for the new signature (failing)**

Replace the two `enabled` assertions in `packages/web/src/plugins/cookie-consent/map-cookie-consent.test.ts` so the mapper takes `enabled` as a third argument. Find every `mapCookieConsent(<raw>, <homeSlug>)` call and add the third argument; add a dedicated test that `enabled` comes from the parameter, not the raw config. Concretely, ensure the file includes:

```ts
it('takes enabled from the parameter (the plugin entry), not the raw config', () => {
  // raw config has no enabled field anymore; the entry drives it.
  expect(mapCookieConsent({ title: 'X' }, 'home', false).enabled).toBe(false);
  expect(mapCookieConsent({ title: 'X' }, 'home', true).enabled).toBe(true);
});

it('fails open with total default copy when raw is null but enabled is true', () => {
  const r = mapCookieConsent(null, 'home', true);
  expect(r.enabled).toBe(true);
  expect(r.urn).toBe('urn:plugin:cookie-consent');
  expect(r.texts.title).not.toBe('');
  expect(r.categories.necessary.enabled).toBe(true);
});
```

Update any pre-existing call sites in this test that pass only two arguments to pass a third (`true` unless the case is specifically about disabled).

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/cookie-consent/map-cookie-consent.test.ts`
Expected: FAIL — `mapCookieConsent` currently accepts 2 args and reads `enabled` from `r.enabled`; the new `enabled`-param assertions fail (and TS reports arity if run under typecheck).

- [ ] **Step 4: Update `mapCookieConsent` to take `enabled`**

In `packages/web/src/plugins/cookie-consent/map-cookie-consent.ts`, change the signature and the returned `enabled`. Replace the function header (lines 29-33) and the `enabled` line (line 52):

```ts
export function mapCookieConsent(
  raw: RawCookieConsent | null | undefined,
  homeSlug: string,
  enabled: boolean,
): ResolvedCookieConsentPlugin {
```

and, in the returned object, replace `enabled: r.enabled ?? true,` with:

```ts
    enabled,
```

Also update the doc-comment's "resolves `enabled: true`" clause to reflect that fail-open now means the CALLER passes `enabled: true` when the entry is absent (the mapper no longer defaults it):

```ts
/**
 * Pure CMS-shape → ResolvedCookieConsentPlugin (cookie-consent Spec §3). Same
 * input → same output, no I/O — the mapSiteSettings pure-mapper discipline.
 *
 * `enabled` is passed in — it lives on the plugin ENTRY now (single source of
 * truth), not on this config block. The FAIL-OPEN policy is enforced by the
 * caller (mapPlugins): a missing/unreachable entry yields `enabled: true` +
 * this mapper's total default copy. A consent gate that silently disappears on
 * a CMS hiccup fails open on a legal obligation — the worst failure mode under
 * LGPD. Copy still merges with `||` (not `??`) so an editor-cleared '' also
 * falls back (the preset-organism.footer `text || fallback` precedent).
 *
 * The urn is SYNTHETIC (`urn:plugin:cookie-consent`) — identity is never
 * CMS-sourced (canonical-urn Spec §3 applied to plugins, Spec §1).
 */
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/cookie-consent/map-cookie-consent.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/plugins/cookie-consent/types.ts \
  packages/web/src/plugins/cookie-consent/map-cookie-consent.ts \
  packages/web/src/plugins/cookie-consent/map-cookie-consent.test.ts
git commit -m "refactor(web): mapCookieConsent takes enabled as a param (sourced from the plugin entry)"
```

---

### Task 6: Web — `mapPlugins` + `mapSiteSettings` reads from plugin entries (`press-web`)

**Files:**
- Modify: `packages/web/src/config/types.ts:180-197` (`SiteSettingsData`) and add `RawPluginEntry`
- Create: `packages/web/src/plugins/map-plugins.ts`
- Create: `packages/web/src/plugins/map-plugins.test.ts`
- Modify: `packages/web/src/map-site-settings.ts:1-11,90-135`
- Modify: `packages/web/src/map-site-settings.test.ts:191-212` (+ every `mapSiteSettings(...)` call site)

**Interfaces:**
- Consumes: `mapCookieConsent(raw, homeSlug, enabled)` (Task 5).
- Produces:
  - `export interface RawPluginEntry { pluginId?: string; enabled?: boolean; config?: Array<{ __component: string; [k: string]: unknown }> | null }`
  - `export function mapPlugins(entries: RawPluginEntry[] | null | undefined, homeSlug: string): ResolvedPressConfig['plugins']`
  - `mapSiteSettings(buildTime: BuildTimeConfig, cms: SiteSettingsData | null, plugins: RawPluginEntry[] | null): ResolvedPressConfig` — new third parameter.

- [ ] **Step 1: Add `RawPluginEntry` and drop `cookieConsent` from `SiteSettingsData`**

In `packages/web/src/config/types.ts`:

(a) Remove the import of `RawCookieConsent` if it is now unused there, and delete the `cookieConsent?: RawCookieConsent | null;` line (line 194) from `SiteSettingsData`. Keep `ResolvedCookieConsentPlugin` imported (it is still referenced by `ResolvedPressConfig.plugins`).

Change the top import to keep only what is used:

```ts
import type { ResolvedCookieConsentPlugin } from '../plugins/cookie-consent/types';
```

(b) Add the `RawPluginEntry` wire type near `SiteSettingsData` (e.g. directly below it):

```ts
/**
 * One entry from GET /api/press/plugins (Strapi 5 flattened). EVERY field is
 * optional: a missing entry and an unreachable CMS both map as absent. `config`
 * is the plugin's `config` dynamiczone — a list of blocks discriminated by
 * `__component`; the per-plugin mapper picks the block it owns. `enabled` is the
 * single source of truth for the plugin's on/off (no longer on the config block).
 */
export interface RawPluginEntry {
  pluginId?: string;
  enabled?: boolean;
  config?: Array<{ __component: string; [k: string]: unknown }> | null;
}
```

- [ ] **Step 2: Write the failing map-plugins test**

Create `packages/web/src/plugins/map-plugins.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapPlugins } from './map-plugins';
import type { RawPluginEntry } from '../config/types';

describe('mapPlugins', () => {
  it('fails open — null entries yield an enabled cookie-consent with total default copy', () => {
    const p = mapPlugins(null, 'home');
    expect(p.cookieConsent.urn).toBe('urn:plugin:cookie-consent');
    expect(p.cookieConsent.enabled).toBe(true);
    expect(p.cookieConsent.texts.title).not.toBe('');
    expect(p.cookieConsent.categories.necessary.enabled).toBe(true);
  });

  it('sources enabled from the entry, not the config block', () => {
    const entries: RawPluginEntry[] = [{ pluginId: 'cookie-consent', enabled: false, config: [] }];
    expect(mapPlugins(entries, 'home').cookieConsent.enabled).toBe(false);
  });

  it('maps the cookie-consent config block (title + privacy home-slug collapse)', () => {
    const entries: RawPluginEntry[] = [
      {
        pluginId: 'cookie-consent',
        enabled: true,
        config: [{ __component: 'preset-config.cookie-consent', title: 'Cookies', privacyPage: { slug: 'home' } }],
      },
    ];
    const cc = mapPlugins(entries, 'home').cookieConsent;
    expect(cc.enabled).toBe(true);
    expect(cc.texts.title).toBe('Cookies');
    expect(cc.privacyPolicyHref).toBe('/');
  });

  it('fails open when the cookie-consent entry is absent from a non-empty list', () => {
    const entries: RawPluginEntry[] = [{ pluginId: 'some-other-plugin', enabled: true }];
    expect(mapPlugins(entries, 'home').cookieConsent.enabled).toBe(true);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/map-plugins.test.ts`
Expected: FAIL — `Cannot find module './map-plugins'`.

- [ ] **Step 4: Implement `mapPlugins`**

Create `packages/web/src/plugins/map-plugins.ts`:

```ts
import type { RawPluginEntry, ResolvedPressConfig } from '../config/types';
import { mapCookieConsent } from './cookie-consent/map-cookie-consent';
import type { RawCookieConsent } from './cookie-consent/types';

const COOKIE_CONSENT_ID = 'cookie-consent';
const COOKIE_CONSENT_COMPONENT = 'preset-config.cookie-consent';

/**
 * Builds ResolvedPressConfig.plugins from the GET /api/press/plugins entries.
 * A NAMED map — one required key per engine plugin — mirroring the fixed
 * ResolvedPressConfig.plugins shape (each new plugin adds a key + a lookup +
 * a mapper call, a deliberate press-web major).
 *
 * Per plugin: find its entry by pluginId, pull the block it owns out of the
 * entry's `config` dynamiczone (discriminated by `__component`), and hand both
 * the block and the entry's `enabled` to the plugin's pure mapper. Cookie-consent
 * FAILS OPEN: a missing entry (empty list / unreachable CMS) → enabled + total
 * default copy (mapCookieConsent's fail-open, driven by `enabled: true` here).
 */
export function mapPlugins(
  entries: RawPluginEntry[] | null | undefined,
  homeSlug: string,
): ResolvedPressConfig['plugins'] {
  const list = entries ?? [];
  const cc = list.find((e) => e.pluginId === COOKIE_CONSENT_ID);
  // The DZ block is typed `{ __component: string; [k]: unknown }`; reshape it to
  // the plugin's raw config via `unknown` (the `as` cannot bridge the index
  // signature directly). The mapper treats every field as optional anyway.
  const block = cc?.config?.find((b) => b.__component === COOKIE_CONSENT_COMPONENT);
  const rawConfig = (block as unknown as RawCookieConsent | undefined) ?? null;
  // Fail-open: no entry ⇒ enabled. A present entry's `enabled` is authoritative.
  const enabled = cc?.enabled ?? true;
  return {
    cookieConsent: mapCookieConsent(rawConfig, homeSlug, enabled),
  };
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/map-plugins.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire `mapPlugins` into `mapSiteSettings` (new signature)**

In `packages/web/src/map-site-settings.ts`:

(a) Replace the `mapCookieConsent` import (line 9) with `mapPlugins`:

```ts
import { mapPlugins } from './plugins/map-plugins';
```

and add `RawPluginEntry` to the type import from `./config/types` (top of file):

```ts
import type {
  BuildTimeConfig,
  ChromeBlock,
  RawPluginEntry,
  ResolvedNavLink,
  ResolvedPressConfig,
  SiteSettingsData,
} from './config/types';
```

(b) Add the third parameter and delegate `plugins`. Change the function signature (lines 90-93) and the `plugins` block (lines 129-133):

```ts
export function mapSiteSettings(
  buildTime: BuildTimeConfig,
  cms: SiteSettingsData | null,
  plugins: RawPluginEntry[] | null,
): ResolvedPressConfig {
```

and

```ts
    // Engine plugins now come from GET /api/press/plugins (their own entries),
    // not from Site Settings. mapPlugins fails OPEN for cookie-consent.
    plugins: mapPlugins(plugins, buildTime.routes.home),
```

- [ ] **Step 7: Update `map-site-settings.test.ts`**

(a) Every existing `mapSiteSettings(buildTime, <cms>)` call must pass a third argument. For all chrome/identity/theme tests that do not care about plugins, pass `null`. Do a find-and-replace so each call reads `mapSiteSettings(buildTime, <cms>, null)`.

(b) Replace the whole `describe('mapSiteSettings — cookie-consent plugin ...')` block (lines 191-212) with a plugins-sourced version:

```ts
describe('mapSiteSettings — plugins (sourced from GET /api/press/plugins)', () => {
  it('fails open — null plugins yield an enabled cookie-consent with default copy', () => {
    const r = mapSiteSettings(buildTime, null, null);
    expect(r.plugins.cookieConsent.urn).toBe('urn:plugin:cookie-consent');
    expect(r.plugins.cookieConsent.enabled).toBe(true);
    expect(r.plugins.cookieConsent.texts.title).not.toBe('');
    expect(r.plugins.cookieConsent.categories.necessary.enabled).toBe(true);
  });

  it('threads a plugin entry (enabled + config block + home anchor) into the plugin map', () => {
    const r = mapSiteSettings(buildTime, null, [
      {
        pluginId: 'cookie-consent',
        enabled: false,
        config: [{ __component: 'preset-config.cookie-consent', title: 'Cookies', privacyPage: { slug: 'home' } }],
      },
    ]);
    expect(r.plugins.cookieConsent.enabled).toBe(false);
    expect(r.plugins.cookieConsent.texts.title).toBe('Cookies');
    expect(r.plugins.cookieConsent.privacyPolicyHref).toBe('/');
  });
});
```

- [ ] **Step 8: Typecheck web + run the affected suites**

Run: `pnpm --filter @ogs-tech/press-web --if-present typecheck && pnpm --filter @ogs-tech/press-web test src/map-site-settings.test.ts src/plugins/map-plugins.test.ts`
Expected: typecheck clean (all `mapSiteSettings` call sites now pass three args); both suites PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/config/types.ts \
  packages/web/src/plugins/map-plugins.ts \
  packages/web/src/plugins/map-plugins.test.ts \
  packages/web/src/map-site-settings.ts \
  packages/web/src/map-site-settings.test.ts
git commit -m "feat(web): resolve plugins from GET /api/press/plugins (mapPlugins → ResolvedPressConfig.plugins)"
```

---

### Task 7: Web — `getSiteConfig` parallel-fetches the plugin entries (`press-web`)

**Files:**
- Modify: `packages/web/src/get-site-config.ts` (whole file)
- Modify: `packages/web/src/get-site-config.test.ts`

**Interfaces:**
- Consumes: `mapSiteSettings(buildTime, cms, plugins)` (Task 6); `RawPluginEntry`.
- Produces: `getSiteConfig(buildTime): Promise<ResolvedPressConfig>` — unchanged signature — now fetching `/api/site-setting` AND `/api/press/plugins` in parallel (ISR `revalidate: 60`), each failing to `null` independently.

- [ ] **Step 1: Rewrite the get-site-config test to expect both fetches (failing)**

Add cases to `packages/web/src/get-site-config.test.ts`. Keep the existing tests but adjust the fetch stub to be endpoint-aware, and add plugin-sourced assertions. Replace the `stubFetch` helper and add tests so the file drives BOTH endpoints:

```ts
function stubFetchByUrl(routes: Record<string, () => Promise<any>>) {
  const mock = vi.fn(async (url: string) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected url ${url}`);
    return routes[key]();
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('getSiteConfig — plugins endpoint', () => {
  it('fetches both /api/site-setting and /api/press/plugins with the ISR option', async () => {
    const mock = stubFetchByUrl({
      '/api/site-setting': async () => ({ ok: true, json: async () => ({ data: { name: 'Acme' } }) }),
      '/api/press/plugins': async () => ({ ok: true, json: async () => ({ data: [] }) }),
    });
    await getSiteConfig(buildTime);
    expect(mock).toHaveBeenCalledWith(expect.stringContaining('/api/site-setting'), { next: { revalidate: 60 } });
    expect(mock).toHaveBeenCalledWith(expect.stringContaining('/api/press/plugins'), { next: { revalidate: 60 } });
  });

  it('sources plugins.cookieConsent.enabled from the plugins endpoint', async () => {
    stubFetchByUrl({
      '/api/site-setting': async () => ({ ok: true, json: async () => ({ data: { name: 'Acme' } }) }),
      '/api/press/plugins': async () => ({
        ok: true,
        json: async () => ({ data: [{ pluginId: 'cookie-consent', enabled: false, config: [] }] }),
      }),
    });
    const r = await getSiteConfig(buildTime);
    expect(r.plugins.cookieConsent.enabled).toBe(false);
  });

  it('fails open on the plugins endpoint — a 500 there still yields an enabled banner', async () => {
    stubFetchByUrl({
      '/api/site-setting': async () => ({ ok: true, json: async () => ({ data: { name: 'Acme' } }) }),
      '/api/press/plugins': async () => ({ ok: false, json: async () => ({}) }),
    });
    const r = await getSiteConfig(buildTime);
    expect(r.plugins.cookieConsent.enabled).toBe(true); // fail-open default
    expect(r.brand.name).toBe('Acme'); // site settings still mapped
  });
});
```

Also update the existing single-endpoint tests (lines 15-85) to use `stubFetchByUrl` with both routes present (the site-setting cases can return `{ data: [] }` for `/api/press/plugins`), OR keep the old `stubFetch` for the ones that only assert site-setting behavior AND make it return the same body for any url — whichever keeps them green. The simplest is: replace `stubFetch` usages with `stubFetchByUrl` providing both routes.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/get-site-config.test.ts`
Expected: FAIL — current `getSiteConfig` calls `fetch` once (`/api/site-setting`) and calls `mapSiteSettings(buildTime, data)` with two args; the plugins-endpoint assertions fail.

- [ ] **Step 3: Rewrite `get-site-config.ts`**

Replace the whole of `packages/web/src/get-site-config.ts` with:

```ts
import type { BuildTimeConfig, RawPluginEntry, ResolvedPressConfig, SiteSettingsData } from './config/types';
import { mapSiteSettings } from './map-site-settings';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

// Next.js augments RequestInit with `next.revalidate` at the host; the engine
// package typechecks with only @types/node, so name the option locally.
type RevalidateInit = RequestInit & { next?: { revalidate?: number } };

/**
 * Fetches one engine wire endpoint and returns its `data` payload, or null on
 * ANY failure (non-OK, network error, malformed body). Never throws — each
 * endpoint fails independently so one being down cannot take out the other.
 */
async function fetchData<T>(url: string, init: RevalidateInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return ((await res.json()) as { data: T | null }).data;
  } catch {
    return null;
  }
}

/**
 * Fetches the Site Settings single type AND the installed plugin entries, maps
 * them into the full ResolvedPressConfig with the build-time anchors (routes,
 * theme.name, theme.fonts). Both endpoints are fetched in parallel and ISR-cached
 * (~60s) so editor changes appear without a deploy; both fail INDEPENDENTLY to
 * null. Site Settings failing → engine-default theme + empty identity (fail to
 * empty). Plugins failing → mapPlugins fails OPEN for cookie-consent (an enabled
 * banner with default copy — a consent gate must not vanish on a CMS hiccup).
 * There is NO press.config fallback for identity/SEO by design.
 *
 * Multi-tenant seam: a later `tenantKey` argument selects a row from a `Site`
 * collection with the SAME return shape — no consumer changes.
 */
export async function getSiteConfig(buildTime: BuildTimeConfig): Promise<ResolvedPressConfig> {
  const init: RevalidateInit = { next: { revalidate: 60 } };
  const [site, plugins] = await Promise.all([
    fetchData<SiteSettingsData>(`${CMS_URL}/api/site-setting`, init),
    fetchData<RawPluginEntry[]>(`${CMS_URL}/api/press/plugins`, init),
  ]);
  return mapSiteSettings(buildTime, site, plugins);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/get-site-config.test.ts`
Expected: PASS — all cases green (both endpoints stubbed, fail-open verified).

- [ ] **Step 5: Typecheck web + run the full web suite**

Run: `pnpm --filter @ogs-tech/press-web --if-present typecheck && pnpm --filter @ogs-tech/press-web test`
Expected: typecheck clean; ALL web tests PASS (map-cookie-consent, map-plugins, map-site-settings, get-site-config, and the untouched banner/consent-store suites).

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/get-site-config.ts packages/web/src/get-site-config.test.ts
git commit -m "feat(web): getSiteConfig parallel-fetches plugin entries (fail-open, ISR)"
```

---

### Task 8: Changeset, full-gate verification, and end-to-end drive

**Files:**
- Create: `.changeset/base-plugin-cms-management.md`

**Interfaces:** none (release + verification wrap).

- [ ] **Step 1: Add the changeset**

Create `.changeset/base-plugin-cms-management.md`:

```markdown
---
'@ogs-tech/press-cms': minor
'@ogs-tech/press-web': minor
---

feat: BASE/PLUGIN — CMS-managed plugin entities with a native enabled toggle

**press-cms — plugin collection + install/uninstall sync.** New `plugin`
collection type (`plugin::press-cms.plugin`) whose entries are the CMS mirror of
the installed engine plugins. `syncPluginEntries` upserts one entry per
`PLUGIN_MANIFEST` line on every boot (installing the canonical `plugin` entity)
and prunes entries whose id left the manifest (uninstalling); it owns each
entry's existence + display metadata while the editor owns `enabled` + `config`.
Each entry's `config` dynamiczone is gated by a schema-declared
`conditions.visible` JSON-Logic rule (`enabled == true`) — native Strapi
conditional fields, no custom admin code. New public `GET /api/press/plugins`.

**press-cms — cookie-consent re-homed (breaking).** The `preset-config.cookie-consent`
config moves off the Site Settings single type onto its plugin entry, and its
top-level `enabled` field is removed: the plugin entry's `enabled` is now the
single source of truth (no ambiguity). `seedCookieConsent` is deleted.

**press-web — plugins resolved from their entries (breaking).** `getSiteConfig`
now parallel-fetches `/api/press/plugins` alongside `/api/site-setting` and maps
the entries via `mapPlugins` into the existing `ResolvedPressConfig.plugins`
named map. `mapCookieConsent` takes `enabled` as a parameter (sourced from the
entry). Both endpoints fail independently; cookie-consent still FAILS OPEN. The
host layout mount is unchanged.
```

- [ ] **Step 2: Run the full repo quality gate**

Run: `pnpm -r --if-present typecheck && pnpm -r test`
Expected: every package's typecheck clean; all vitest suites (`cli`, `web`, `cms`) PASS.

- [ ] **Step 3: Verify the type-sync pipeline is untouched**

The plugin `config` DZ must NOT enter `GET /api/press/schema` / the generator. Boot, regenerate, and confirm no diff:

```bash
pnpm dev   # (in another shell, or use the running instance from earlier)
# with the playground booted, trigger a schema sync (press dev re-syncs on change),
# then:
git status --porcelain apps/playground
git diff --stat -- '*shared/types/generated.ts'
```

Expected: `generated.ts` is unchanged (no `plugin`/`config`-DZ types leak in). If it changed, the plugin content-type was wrongly pulled into the walk — stop and investigate `serialize-schema.ts` scoping. Record the result.

- [ ] **Step 4: End-to-end drive (the DONE gate)**

With `pnpm dev` running, verify the full loop (use `/run` or the browser; record evidence):

1. **Admin — Plugins collection:** open `http://localhost:1337/admin` → Content Manager → **Plugins**. Exactly one entry, `cookie-consent`, `enabled = true` (installed by `syncPluginEntries`).
2. **Toggle gates config visibility:** on that entry, `enabled = false` → **Configuration** DZ hidden; `enabled = true` → it appears (native condition, Task 1 evidence re-confirmed on the real entry).
3. **Enabled → banner renders:** with `enabled = true` and no stored consent, load `http://localhost:3000/` → the cookie banner shows (default copy).
4. **Disabled → banner gone:** set `enabled = false`, save, wait past the ISR window (~60s) or restart web, reload `/` → the banner does NOT render. This proves the single-source `enabled` drives runtime through `/api/press/plugins`.
5. **Config edits apply:** re-enable, add a Cookie Consent block to the config DZ with a custom `title`, save; after revalidation the banner shows the custom title.

Record the observed evidence (screenshots or notes) per superpowers:verification-before-completion. Do not claim DONE without steps 1-4 observed.

- [ ] **Step 5: Commit the changeset**

```bash
git add .changeset/base-plugin-cms-management.md
git commit -m "chore: changeset for BASE/PLUGIN (CMS-managed plugin entities + toggle)"
```

- [ ] **Step 6: Hand the CRM DONE note to the user**

There is no MCP access to Zoho — surface the closing note verbatim so the user pastes it into the card manually. Print exactly:

```
[OGS] [PRESS] BASE / PLUGIN — DONE

Contrato PressPlugin<Id> + padrão canônico: prontos (já existiam).
1 plugin de exemplo wired end-to-end: cookie-consent, re-homed para a entity plugin.
Entity plugin refletindo o instalado: collection type `plugin` (read via CMS),
  syncPluginEntries faz upsert/prune por boot (instala/desinstala entidades canônicas).
Gerenciamento via CMS: toggle `enabled` na entrada do plugin, com a config aparecendo/
  sumindo por condição nativa do Strapi (conditions.visible JSON Logic, mesma entrada).
Fonte única de verdade do enabled: a entrada plugin (removido o enabled duplicado do
  componente cookie-consent). Sem ambiguidade.
Coexiste com o Marketplace (v0.2): install/codegen herdará deste contrato.
Kind que instala páginas (Legal) fica para o item Plugin/Legal — seedPage() já pronto.
```

---

## Verification against DONE

| DONE (from the card) | Task / How |
| --- | --- |
| contrato `PressPlugin<Id>` + padrão canônico prontos | Pre-existing (`packages/web/src/plugin.ts`, `urn.ts`); unchanged, re-confirmed by the cookie-consent path |
| 1 plugin de exemplo wired end-to-end | Tasks 4-7 (cookie-consent re-homed onto its entry; web reads it end-to-end) + Task 8 Step 4 |
| entity plugin refletindo o instalado (upsert por boot) | Task 1 (content-type) + Task 2 (`syncPluginEntries` upsert + prune) |
| gerenciamento via CMS (enabled → config aparece/some) | Task 1 (`conditions.visible`) + Task 8 Step 4.2 |
| sem ambiguidade (fonte única do enabled) | Task 4 (remove component `enabled`) + Task 5 (`enabled` as param) |
| um plugin instala/desinstala entidades canônicas | Task 2 (`syncPluginEntries` installs entries / prunes on uninstall) |

## Rollout notes

- Both packages bump `minor` (pre-release 0.x): press-cms (plugin CT + sync + cookie-consent re-home) and press-web (plugins from `/api/press/plugins` + mapCookieConsent signature). One changeset covers both (Task 8).
- The cookie-consent re-home is a visible data-model change (config leaves Site Settings). Acceptable pre-release; an existing dev DB will show an empty `config` on the synced entry until an editor re-adds the block (the banner meanwhile runs on defaults — fail-open).
- The load-bearing assumption (native `conditions.visible` hides a dynamiczone on a same-entry boolean) is verified EARLY, in Task 1 Step 5, with a documented component-field fallback — before any web work depends on it.
- This plan stops at a committed, green working tree. It does **not** push, publish, or run `pnpm version-packages` / `changeset publish`.
```
