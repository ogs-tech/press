# Base/Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every future engine plugin (Legal, Forms, SMTP, i18n, SEO, Site
for Company, Marketplace) a proven, copyable structure, by wiring one
synthetic `example` plugin through the real pipeline end to end, plus a
read-only Content-Manager index of installed plugins.

**Architecture:** `PressPlugin<Id>` (already shipped, RESERVED) gets its
first consumer. The example plugin follows the canonical
`packages/web/src/plugins/<id>/` structure (types → default → mapper →
React shell), wired by hand through six points: CMS component → Site
Settings attribute → controller populate → raw type → mapper →
`ResolvedPressConfig.plugins` → one mount line in the host `layout.tsx`. A
second, independent piece — a new `plugin::press-cms.plugin` collection
type plus a `syncPluginEntries` boot step — mirrors every known plugin's
`enabled` state into the Content Manager as a pure view.

**Tech Stack:** Strapi 5 plugin (`@ogs-tech/press-cms`), Next.js host
template (`@ogs-tech/press-web`), TypeScript, vitest.

## Global Constraints

- The example plugin ships **disabled by default** (`DEFAULT_EXAMPLE_PLUGIN.enabled = false`) — a fresh adopter site shows nothing extra out of the box.
- No client interactivity in the example plugin: its React component is a plain server component, never `'use client'`.
- **No shared plugin-authoring helper** (`definePlugin()` or similar) — the canonical structure is convention, not shared code. Revisit only once a second real plugin exists.
- **No generic `configHost` string-path walker** — each `PLUGIN_DEFINITIONS` entry hand-writes its own `readEnabled` closure.
- The plugin-entity mirror does **not** re-derive the "true resolved" value via the web-side mapper — each definition carries its own `defaultEnabled` literal, kept in sync by hand.
- `syncPluginEntries` runs **every boot** (not seed-once) — an editor's Site Settings toggle must never go stale under a run-once flag. The mirror only refreshes on the *next* boot (accepted limitation; a lifecycle-hook refresh is a named follow-up, out of scope).
- Every field on the `plugin` collection type is `editable: false` in `config.metadatas` (visible, never editable in the admin).
- Any Strapi content-type/component that declares `config.settings` at all must declare the **full** shape (`bulkable`/`filterable`/`pageSize`/`searchable`) — a partial override throws (repo gotcha, already hit once).
- `ResolvedPressConfig` gains a **required** `plugins` field — a press-web **major** version bump (the `pageDefaults`/`layout` discipline: hand-constructed literals must fail `tsc`).
- `@ogs-tech/press-cms` changes are additive only — a press-cms **minor**.
- `packages/shared` is untouched — the example plugin's fields are plain scalars, never touch `PressTree`/validators.

---

### Task 1: CMS component `preset-config.example-plugin` + registry injection

**Files:**
- Create: `packages/cms/server/src/components/config/example-plugin.json`
- Modify: `packages/cms/server/src/lib/inject-components.ts`
- Test: `packages/cms/server/src/lib/inject-components.test.ts`

**Interfaces:**
- Produces: the registered component uid `preset-config.example-plugin`, attributes `{ enabled: boolean; message: string }`, category `preset-config` — consumed by Task 2 (Site Settings attribute references this uid).

- [ ] **Step 1: Write the failing test**

Add this `it` inside the existing `describe('injectComponents', ...)` block in `packages/cms/server/src/lib/inject-components.test.ts` (after the `'preset-config.basic-settings'`/`'preset-config.theme-advanced'` assertions, e.g. right after the `'skips a component already present...'` test):

```ts
  it('registers preset-config.example-plugin with enabled/message fields (base-plugin Spec §3.1)', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    expect(components.get('preset-config.example-plugin')?.category).toBe('preset-config');
    expect(components.get('preset-config.example-plugin')?.attributes).toEqual({
      enabled: { type: 'boolean', default: false },
      message: { type: 'string' },
    });
  });
```

Also add `'preset-config.example-plugin'` to the `expected` array in the `'registers every engine preset-* component as a component model'` test, right after `'preset-config.theme-advanced'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts`
Expected: FAIL — `components.get('preset-config.example-plugin')` is `undefined` (`Cannot read properties of undefined (reading 'category')`).

- [ ] **Step 3: Create the component JSON**

Create `packages/cms/server/src/components/config/example-plugin.json`:

```json
{
  "collectionName": "components_preset_config_example_plugins",
  "info": {
    "displayName": "Example Plugin",
    "icon": "apps",
    "description": "Synthetic reference plugin proving the plugin-wiring contract end to end"
  },
  "options": {},
  "attributes": {
    "enabled": { "type": "boolean", "default": false },
    "message": { "type": "string" }
  },
  "config": {
    "metadatas": {
      "enabled": { "edit": { "label": "Enabled", "description": "Turns the example plugin's banner on for every page. Ships off by default." } },
      "message": { "edit": { "label": "Message", "description": "The text the example plugin renders when enabled." } }
    }
  }
}
```

- [ ] **Step 4: Register it in `inject-components.ts`**

In `packages/cms/server/src/lib/inject-components.ts`, add the import near the other `config/*` imports:

```ts
import examplePluginSchema from '../components/config/example-plugin.json';
```

Add a new entry to `ENGINE_COMPONENTS`, after the `layout-defaults` group at the end of the array, with its own comment:

```ts
  // Plugin config (base-plugin Spec §3.1) — the example plugin's own
  // `enabled`/`message` fields, the first real consumer of PressPlugin<Id>.
  { layer: 'config', name: 'example-plugin', schema: examplePluginSchema as Record<string, unknown> },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cms/server/src/components/config/example-plugin.json packages/cms/server/src/lib/inject-components.ts packages/cms/server/src/lib/inject-components.test.ts
git commit -m "feat(cms): register preset-config.example-plugin component"
```

---

### Task 2: Site Settings attribute + controller populate

**Files:**
- Modify: `packages/cms/server/src/content-types/site-setting/schema.json`
- Modify: `packages/cms/server/src/controllers/site-setting.ts`
- Test: `packages/cms/server/src/lib/inject-components.test.ts`
- Test: `packages/cms/server/src/controllers/site-setting.test.ts`

**Interfaces:**
- Consumes: `preset-config.example-plugin` uid (Task 1).
- Produces: `site-setting.examplePlugin` attribute (component, non-repeatable); the `find()` controller's populate map including `examplePlugin: true` — consumed by Task 4's web-side `SiteSettingsData.examplePlugin`.

- [ ] **Step 1: Write the failing tests**

In `packages/cms/server/src/lib/inject-components.test.ts`, add a new top-level `describe` block (after the existing `describe('site-setting layout attribute ...)` block, same file):

```ts
describe('site-setting examplePlugin attribute (base-plugin Spec §3.2)', () => {
  it('attaches preset-config.example-plugin as a config component', () => {
    expect((siteSettingSchema.attributes as any).examplePlugin).toEqual({
      type: 'component',
      repeatable: false,
      component: 'preset-config.example-plugin',
    });
  });
});
```

In `packages/cms/server/src/controllers/site-setting.test.ts`, add a new `it` inside `describe('site-setting controller', ...)`, after the `'deep-populates layout ...'` test:

```ts
  it('populates examplePlugin as a shallow scalar component (no media/nested component to deep-populate)', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.examplePlugin).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts src/controllers/site-setting.test.ts`
Expected: FAIL — `examplePlugin` is `undefined` in both assertions.

- [ ] **Step 3: Add the schema attribute**

In `packages/cms/server/src/content-types/site-setting/schema.json`, add to `attributes` (after `pageDefaults`):

```json
    "examplePlugin": { "type": "component", "repeatable": false, "component": "preset-config.example-plugin" }
```

Add to `config.metadatas` (after `pageDefaults`):

```json
      "examplePlugin": { "edit": { "label": "Example Plugin", "description": "Reference plugin proving the plugin framework end to end. Ships disabled." } }
```

- [ ] **Step 4: Add the populate key**

In `packages/cms/server/src/controllers/site-setting.ts`, add `examplePlugin: true` to the object returned by `settingsPopulate()`, after the `layout` key:

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
  });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts src/controllers/site-setting.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cms/server/src/content-types/site-setting/schema.json packages/cms/server/src/controllers/site-setting.ts packages/cms/server/src/lib/inject-components.test.ts packages/cms/server/src/controllers/site-setting.test.ts
git commit -m "feat(cms): add examplePlugin to Site Settings + controller populate"
```

---

### Task 3: web-side types, default, and pure mapper

**Files:**
- Create: `packages/web/src/plugins/example/types.ts`
- Create: `packages/web/src/plugins/example/default-example-plugin.ts`
- Create: `packages/web/src/plugins/example/map-example-plugin.ts`
- Test: `packages/web/src/plugins/example/map-example-plugin.test.ts`

**Interfaces:**
- Produces: `RawExamplePlugin` (`{ enabled?: boolean; message?: string }`), `ResolvedExamplePlugin` (`{ enabled: boolean; message: string }`), `DEFAULT_EXAMPLE_PLUGIN: ResolvedExamplePlugin`, `mapExamplePlugin(raw: RawExamplePlugin | null | undefined): ResolvedExamplePlugin` — consumed by Task 4 (`mapSiteSettings`) and Task 5 (`ExamplePlugin` component's prop type).

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/plugins/example/map-example-plugin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapExamplePlugin } from './map-example-plugin';
import { DEFAULT_EXAMPLE_PLUGIN } from './default-example-plugin';

describe('mapExamplePlugin', () => {
  it('resolves DEFAULT_EXAMPLE_PLUGIN (disabled) when the CMS component is null', () => {
    expect(mapExamplePlugin(null)).toEqual(DEFAULT_EXAMPLE_PLUGIN);
  });

  it('resolves DEFAULT_EXAMPLE_PLUGIN when the CMS component is absent (undefined)', () => {
    expect(mapExamplePlugin(undefined)).toEqual(DEFAULT_EXAMPLE_PLUGIN);
  });

  it('resolves DEFAULT_EXAMPLE_PLUGIN when the CMS component is an empty object', () => {
    expect(mapExamplePlugin({})).toEqual(DEFAULT_EXAMPLE_PLUGIN);
  });

  it('lets a present enabled/message win over the default', () => {
    expect(mapExamplePlugin({ enabled: true, message: 'Toggled on' })).toEqual({
      enabled: true,
      message: 'Toggled on',
    });
  });

  it('keeps the default message when only enabled is set', () => {
    expect(mapExamplePlugin({ enabled: true })).toEqual({
      enabled: true,
      message: DEFAULT_EXAMPLE_PLUGIN.message,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/example/map-example-plugin.test.ts`
Expected: FAIL with a module-not-found error for `./map-example-plugin`.

- [ ] **Step 3: Write the types**

Create `packages/web/src/plugins/example/types.ts`:

```ts
/**
 * Wire + resolved shapes for the example plugin (base-plugin Spec §2/§3) — the
 * canonical plugin structure every future plugin author copies. `Raw` mirrors
 * the CMS component verbatim (every field optional, the wire is never
 * trusted); `Resolved` is TOTAL — the shape `ExamplePlugin` (the React shell)
 * and `ResolvedPressConfig.plugins.example` actually consume.
 */
export interface RawExamplePlugin {
  enabled?: boolean;
  message?: string;
}

export interface ResolvedExamplePlugin {
  enabled: boolean;
  message: string;
}
```

- [ ] **Step 4: Write the default constant**

Create `packages/web/src/plugins/example/default-example-plugin.ts`:

```ts
import type { ResolvedExamplePlugin } from './types';

/**
 * Ships DISABLED by default (base-plugin Spec §3): a fresh adopter site shows
 * nothing extra out of the box, fully wired and provably works once toggled
 * on in Site Settings.
 */
export const DEFAULT_EXAMPLE_PLUGIN: ResolvedExamplePlugin = {
  enabled: false,
  message: 'Hello from the example plugin!',
};
```

- [ ] **Step 5: Write the mapper**

Create `packages/web/src/plugins/example/map-example-plugin.ts`:

```ts
import type { RawExamplePlugin, ResolvedExamplePlugin } from './types';
import { DEFAULT_EXAMPLE_PLUGIN } from './default-example-plugin';

/**
 * Pure CMS-shape → ResolvedExamplePlugin (base-plugin Spec §2 mapper role):
 * FAIL-OPEN — a null/absent CMS component still resolves a total, well-typed
 * value (DEFAULT_EXAMPLE_PLUGIN), never throws, no I/O. A present field wins
 * over the default; an absent/undefined field keeps the default.
 */
export function mapExamplePlugin(raw: RawExamplePlugin | null | undefined): ResolvedExamplePlugin {
  return {
    enabled: raw?.enabled ?? DEFAULT_EXAMPLE_PLUGIN.enabled,
    message: raw?.message ?? DEFAULT_EXAMPLE_PLUGIN.message,
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/example/map-example-plugin.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/plugins/example/types.ts packages/web/src/plugins/example/default-example-plugin.ts packages/web/src/plugins/example/map-example-plugin.ts packages/web/src/plugins/example/map-example-plugin.test.ts
git commit -m "feat(web): example plugin types, default, and mapper"
```

---

### Task 4: wire `mapExamplePlugin` into `mapSiteSettings` + `ResolvedPressConfig.plugins`

**Files:**
- Modify: `packages/web/src/config/types.ts`
- Modify: `packages/web/src/map-site-settings.ts`
- Test: `packages/web/src/map-site-settings.test.ts`

**Interfaces:**
- Consumes: `RawExamplePlugin`, `ResolvedExamplePlugin`, `mapExamplePlugin` (Task 3).
- Produces: `ResolvedPressConfig.plugins.example: ResolvedExamplePlugin` (required field) and `SiteSettingsData.examplePlugin?: RawExamplePlugin | null` — consumed by Task 5 (`site.plugins.example.enabled`/`.message` in the host template).

- [ ] **Step 1: Write the failing tests**

In `packages/web/src/map-site-settings.test.ts`, add the import at the top:

```ts
import { DEFAULT_EXAMPLE_PLUGIN } from './plugins/example/default-example-plugin';
```

Add two `it` blocks inside `describe('mapSiteSettings', ...)`, after the `'attaches the synthetic site-setting urn ...'` test:

```ts
  it('resolves plugins.example to DEFAULT_EXAMPLE_PLUGIN (disabled) when the CMS is null (base-plugin Spec §3)', () => {
    const r = mapSiteSettings(buildTime, null);
    expect(r.plugins.example).toEqual(DEFAULT_EXAMPLE_PLUGIN);
  });

  it('resolves plugins.example from a present examplePlugin component', () => {
    const r = mapSiteSettings(buildTime, { examplePlugin: { enabled: true, message: 'On' } });
    expect(r.plugins.example).toEqual({ enabled: true, message: 'On' });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/map-site-settings.test.ts`
Expected: FAIL — first with a TS error (`Property 'plugins' does not exist on type 'ResolvedPressConfig'`), or at minimum `r.plugins` is `undefined`.

- [ ] **Step 3: Extend `SiteSettingsData` and `ResolvedPressConfig`**

In `packages/web/src/config/types.ts`, add the import (alongside the existing `Canonical`/`ResolvedLink` imports at the top). This file lives at `packages/web/src/config/types.ts`, so the relative path up to `plugins/example/types.ts` is `../plugins/example/types`:

```ts
import type { RawExamplePlugin, ResolvedExamplePlugin } from '../plugins/example/types';
```

In `ResolvedPressConfig`, add a new required field after `layout: LayoutDefaults;`:

```ts
  /**
   * Resolved engine plugins (base-plugin Spec §3), one required key per wired
   * plugin — additive is a press-web MAJOR, the `pageDefaults`/`layout`
   * discipline. A future plugin adds its own key beside `example`.
   */
  plugins: {
    example: ResolvedExamplePlugin;
  };
```

In `SiteSettingsData`, add a new field after `layout?: unknown;`:

```ts
  /** The `preset-config.example-plugin` component (base-plugin Spec §3), RAW. */
  examplePlugin?: RawExamplePlugin | null;
```

- [ ] **Step 4: Wire the mapper into `mapSiteSettings`**

In `packages/web/src/map-site-settings.ts`, add the import:

```ts
import { mapExamplePlugin } from './plugins/example/map-example-plugin';
```

In the object returned by `mapSiteSettings`, add a new field after `layout: resolveLayoutDefaults(c.layout),`:

```ts
    plugins: {
      example: mapExamplePlugin(c.examplePlugin),
    },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/map-site-settings.test.ts`
Expected: PASS (all tests in the file, including the pre-existing ones — `plugins` is additive, so nothing else should regress).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS — this is also where a hand-constructed `ResolvedPressConfig` literal anywhere else in the package would now fail `tsc` if it didn't include `plugins`; none currently exist outside `mapSiteSettings`.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/config/types.ts packages/web/src/map-site-settings.ts packages/web/src/map-site-settings.test.ts
git commit -m "feat(web)!: ResolvedPressConfig gains required plugins.example"
```

---

### Task 5: React shell, public export, host template mount

**Files:**
- Create: `packages/web/src/plugins/example/example-plugin.tsx`
- Test: `packages/web/src/plugins/example/example-plugin.test.tsx`
- Modify: `packages/web/src/index.ts`
- Modify: `packages/web/templates/host/app/layout.tsx`

**Interfaces:**
- Consumes: `ResolvedExamplePlugin` (Task 3), `site.plugins.example` (Task 4).
- Produces: `ExamplePlugin` component, exported from `@ogs-tech/press-web`; the host template mount point.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/plugins/example/example-plugin.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExamplePlugin } from './example-plugin';

describe('ExamplePlugin renderer', () => {
  it('renders the resolved message inside a data-press-plugin="example" wrapper', () => {
    const html = renderToStaticMarkup(ExamplePlugin({ message: 'Hello from the example plugin!' }));
    expect(html).toBe('<div data-press-plugin="example">Hello from the example plugin!</div>');
  });

  it('renders whatever message it is given — it never re-resolves a default itself', () => {
    const html = renderToStaticMarkup(ExamplePlugin({ message: 'Custom toggled-on copy' }));
    expect(html).toContain('Custom toggled-on copy');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/example/example-plugin.test.tsx`
Expected: FAIL with a module-not-found error for `./example-plugin`.

- [ ] **Step 3: Write the component**

Create `packages/web/src/plugins/example/example-plugin.tsx`:

```tsx
import type { ResolvedExamplePlugin } from './types';

/**
 * The example plugin's React shell (base-plugin Spec §2/§3) — a plain server
 * component, not a `'use client'` shell: it carries no client interactivity,
 * a better structural precedent for most future plugins than
 * cookie-consent's client-heavy banner was. Receives the already-resolved
 * message and renders; never re-resolves DEFAULT_EXAMPLE_PLUGIN itself — the
 * mapper already did that, and the `enabled` gate lives at the mount call
 * site (host layout.tsx), not here.
 */
export function ExamplePlugin({ message }: Pick<ResolvedExamplePlugin, 'message'>) {
  return <div data-press-plugin="example">{message}</div>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/plugins/example/example-plugin.test.tsx`
Expected: PASS

- [ ] **Step 5: Export from the package's public API**

In `packages/web/src/index.ts`, add after `export type { PressPlugin } from './plugin';`:

```ts
export { ExamplePlugin } from './plugins/example/example-plugin';
export type { ResolvedExamplePlugin } from './plugins/example/types';
```

- [ ] **Step 6: Mount it in the host template**

In `packages/web/templates/host/app/layout.tsx`, change the import line:

```tsx
import { buildMetadata, buildThemeStyle, getSiteConfig, ExamplePlugin } from '@ogs-tech/press-web';
```

And add the mount line right after `{children}` inside `<body>`:

```tsx
      <body>
        {/* The page shell (header/main/footer) is rendered by TreeRenderer inside the
            route — the layout cannot see the slug, so it cannot resolve per-page
            slots (Spec §5). It keeps html/head and the theme injection only. */}
        {children}
        {site.plugins.example.enabled && <ExamplePlugin message={site.plugins.example.message} />}
      </body>
```

Note: `packages/web/tsconfig.json` excludes `templates` from `tsc --noEmit`, so this file is **not** covered by the package typecheck — Step 7's manual verification is the only check for this edit.

- [ ] **Step 7: Manual end-to-end verification**

Run: `pnpm dev` (boots the dogfood playground: cms on `:1337/admin`, web on `:3000`).

1. Open `http://localhost:3000` — confirm there is **no** `data-press-plugin="example"` element anywhere on the page (ships disabled by default).
2. Open `http://localhost:1337/admin`, navigate to Content Manager → Site Settings, find the "Example Plugin" section, set **Enabled** on and **Message** to e.g. "Wired end to end", Save.
3. Reload `http://localhost:3000` (a hard refresh may be needed to bypass the ~60s ISR window, or wait ~60s) — confirm a `<div data-press-plugin="example">Wired end to end</div>` now renders on the page.
4. Toggle **Enabled** back off in the admin, Save, reload — confirm the element disappears again.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/plugins/example/example-plugin.tsx packages/web/src/plugins/example/example-plugin.test.tsx packages/web/src/index.ts packages/web/templates/host/app/layout.tsx
git commit -m "feat(web): mount ExamplePlugin in the host layout template"
```

---

### Task 6: `plugin` collection type — read-only installed-plugins schema

**Files:**
- Create: `packages/cms/server/src/content-types/plugin/schema.json`
- Modify: `packages/cms/server/src/content-types/index.ts`
- Test: `packages/cms/server/src/lib/inject-components.test.ts`

**Interfaces:**
- Produces: content-type uid `plugin::press-cms.plugin` with attributes `{ pluginId: string (unique); label: string; configHost: string; enabled: boolean }` — consumed by Task 7 (`syncPluginEntries` reads/writes this uid).

- [ ] **Step 1: Write the failing test**

In `packages/cms/server/src/lib/inject-components.test.ts`, add the import at the top (alongside `pageSchema`/`siteSettingSchema`):

```ts
import pluginSchema from '../content-types/plugin/schema.json';
```

Add a new top-level `describe` block (after the `site-setting layout attribute` block):

```ts
describe('plugin content-type schema (base-plugin Spec §4)', () => {
  it('declares a read-only collection type with the four mirror fields', () => {
    expect(pluginSchema.kind).toBe('collectionType');
    expect((pluginSchema.attributes as any).pluginId).toEqual({ type: 'string', required: true, unique: true });
    expect((pluginSchema.attributes as any).label).toEqual({ type: 'string', required: true });
    expect((pluginSchema.attributes as any).configHost).toEqual({ type: 'string', required: true });
    expect((pluginSchema.attributes as any).enabled).toEqual({ type: 'boolean', required: true, default: false });
  });

  it('marks every field non-editable in the admin — a view, never a second source of truth', () => {
    const metas = (pluginSchema as any).config.metadatas;
    for (const field of ['pluginId', 'label', 'configHost', 'enabled']) {
      expect(metas[field].edit.editable).toBe(false);
    }
  });

  it('declares the full config.settings shape (bulkable/filterable/pageSize/searchable) per the repo gotcha', () => {
    expect((pluginSchema as any).config.settings).toEqual({
      bulkable: true,
      filterable: true,
      pageSize: 10,
      searchable: true,
      mainField: 'pluginId',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts`
Expected: FAIL with a module-not-found error for `../content-types/plugin/schema.json`.

- [ ] **Step 3: Create the schema**

Create `packages/cms/server/src/content-types/plugin/schema.json`:

```json
{
  "kind": "collectionType",
  "collectionName": "plugins",
  "info": {
    "singularName": "plugin",
    "pluralName": "plugins",
    "displayName": "Plugins",
    "description": "Read-only index of engine plugins the CMS knows about and their configured state"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {},
  "attributes": {
    "pluginId": { "type": "string", "required": true, "unique": true },
    "label": { "type": "string", "required": true },
    "configHost": { "type": "string", "required": true },
    "enabled": { "type": "boolean", "required": true, "default": false }
  },
  "config": {
    "settings": { "bulkable": true, "filterable": true, "pageSize": 10, "searchable": true, "mainField": "pluginId" },
    "metadatas": {
      "pluginId": { "edit": { "label": "Plugin", "description": "Stable identifier of the engine plugin.", "editable": false } },
      "label": { "edit": { "label": "Name", "description": "Human-readable plugin name.", "editable": false } },
      "configHost": { "edit": { "label": "Configured at", "description": "Where this plugin is configured — a display-only pointer, not a link.", "editable": false } },
      "enabled": { "edit": { "label": "Enabled", "description": "Mirrors the live Site Settings value as of the last CMS boot.", "editable": false } }
    }
  }
}
```

- [ ] **Step 4: Register the content type**

Replace the contents of `packages/cms/server/src/content-types/index.ts`:

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

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cms/server/src/content-types/plugin/schema.json packages/cms/server/src/content-types/index.ts packages/cms/server/src/lib/inject-components.test.ts
git commit -m "feat(cms): add read-only plugin::press-cms.plugin collection type"
```

---

### Task 7: `syncPluginEntries` + bootstrap wiring

**Files:**
- Create: `packages/cms/server/src/lib/sync-plugin-entries.ts`
- Test: `packages/cms/server/src/lib/sync-plugin-entries.test.ts`
- Modify: `packages/cms/server/src/bootstrap.ts`

**Interfaces:**
- Consumes: `plugin::press-cms.plugin` uid (Task 6), `plugin::press-cms.site-setting` uid + `examplePlugin` attribute (Task 2).
- Produces: `PLUGIN_DEFINITIONS: PluginDefinition[]`, `syncPluginEntries(strapi: Core.Strapi): Promise<void>` — called from `bootstrap.ts`, last.

- [ ] **Step 1: Write the failing tests**

Create `packages/cms/server/src/lib/sync-plugin-entries.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { syncPluginEntries, PLUGIN_DEFINITIONS } from './sync-plugin-entries';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';
const PLUGIN_UID = 'plugin::press-cms.plugin';

/** Minimal Document-Service fake covering both UIDs sync-plugin-entries reads/writes. */
function fakeStrapi(siteSetting: any = null, pluginRows: Record<string, any> = {}) {
  const creates: Array<{ data: any }> = [];
  const updates: Array<{ documentId: string; data: any }> = [];
  const rows = new Map<string, any>(Object.entries(pluginRows));
  const strapi = {
    documents: (uid: string) => {
      if (uid === SITE_SETTING_UID) {
        return { findFirst: async () => siteSetting };
      }
      if (uid === PLUGIN_UID) {
        return {
          findFirst: async ({ filters }: { filters: { pluginId: string } }) => rows.get(filters.pluginId) ?? null,
          create: async (params: { data: any }) => {
            creates.push(params);
            const doc = { documentId: `doc-${params.data.pluginId}`, ...params.data };
            rows.set(params.data.pluginId, doc);
            return doc;
          },
          update: async (params: { documentId: string; data: any }) => {
            updates.push(params);
            const existing = [...rows.values()].find((r) => r.documentId === params.documentId);
            const doc = { ...existing, ...params.data };
            rows.set(params.data.pluginId, doc);
            return doc;
          },
        };
      }
      throw new Error(`unexpected uid ${uid}`);
    },
  } as any;
  return { strapi, creates, updates, rows };
}

describe('syncPluginEntries (base-plugin Spec §4)', () => {
  it('creates one row per PLUGIN_DEFINITIONS entry on a fresh DB, defaultEnabled when Site Settings is null', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await syncPluginEntries(strapi);
    expect(creates).toHaveLength(PLUGIN_DEFINITIONS.length);
    expect(creates[0].data).toEqual({
      pluginId: 'example',
      label: 'Example Plugin',
      configHost: 'site-setting.examplePlugin',
      enabled: false,
    });
  });

  it('mirrors the live Site Settings enabled value on create', async () => {
    const { strapi, creates } = fakeStrapi({ examplePlugin: { enabled: true } });
    await syncPluginEntries(strapi);
    expect(creates[0].data.enabled).toBe(true);
  });

  it('updates the existing row on the next boot instead of creating a duplicate (idempotent upsert)', async () => {
    const { strapi, creates, updates } = fakeStrapi(
      { examplePlugin: { enabled: true } },
      {
        example: {
          documentId: 'doc-example',
          pluginId: 'example',
          label: 'Example Plugin',
          configHost: 'site-setting.examplePlugin',
          enabled: false,
        },
      },
    );
    await syncPluginEntries(strapi);
    expect(creates).toEqual([]);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      documentId: 'doc-example',
      data: { pluginId: 'example', label: 'Example Plugin', configHost: 'site-setting.examplePlugin', enabled: true },
    });
  });

  it('falls back to defaultEnabled when the Site Settings record has no examplePlugin component', async () => {
    const { strapi, creates } = fakeStrapi({});
    await syncPluginEntries(strapi);
    expect(creates[0].data.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/sync-plugin-entries.test.ts`
Expected: FAIL with a module-not-found error for `./sync-plugin-entries`.

- [ ] **Step 3: Write the implementation**

Create `packages/cms/server/src/lib/sync-plugin-entries.ts`:

```ts
import type { Core } from '@strapi/strapi';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';
const PLUGIN_UID = 'plugin::press-cms.plugin';

/** A live Site Settings record, populated exactly enough for readEnabled below. */
interface SiteSettingSnapshot {
  examplePlugin?: { enabled?: boolean } | null;
}

interface PluginDefinition {
  id: string;
  label: string;
  configHost: string;
  /** Mirrors the plugin's own DEFAULT_<PLUGIN>.enabled (web) — kept in sync by hand (base-plugin Spec §4). */
  defaultEnabled: boolean;
  /** No generic configHost string-path walker (base-plugin Spec §4 trade-off) — each plugin hand-writes its own read. */
  readEnabled: (site: SiteSettingSnapshot | null) => boolean | undefined;
}

/**
 * Every engine plugin the Content-Manager index mirrors (base-plugin Spec
 * §4). Adding a plugin here is the "+1 PLUGIN_DEFINITIONS entry" line
 * CLAUDE.md's "Engine plugins" section tracks, on top of the wiring in
 * map-example-plugin.ts.
 */
export const PLUGIN_DEFINITIONS: PluginDefinition[] = [
  {
    id: 'example',
    label: 'Example Plugin',
    configHost: 'site-setting.examplePlugin',
    defaultEnabled: false,
    readEnabled: (site) => site?.examplePlugin?.enabled,
  },
];

/**
 * Upserts one row per PLUGIN_DEFINITIONS entry into the read-only `plugin`
 * collection type — a VIEW, never a second source of truth (base-plugin
 * Spec §4). Runs every boot (not seed-once): an editor's Site Settings
 * toggle must not go stale under a run-once flag, though the mirror still
 * only refreshes on the NEXT boot (accepted limitation, no lifecycle-hook
 * refresh here).
 */
export async function syncPluginEntries(strapi: Core.Strapi): Promise<void> {
  const site = (await strapi
    .documents(SITE_SETTING_UID as any)
    .findFirst({ populate: { examplePlugin: true } as any })) as SiteSettingSnapshot | null;

  const docs = strapi.documents(PLUGIN_UID as any);

  for (const def of PLUGIN_DEFINITIONS) {
    const enabled = def.readEnabled(site) ?? def.defaultEnabled;
    const data = { pluginId: def.id, label: def.label, configHost: def.configHost, enabled };
    const existing = (await docs.findFirst({ filters: { pluginId: def.id } } as any)) as { documentId: string } | null;
    if (!existing) {
      await docs.create({ data } as any);
    } else {
      await docs.update({ documentId: existing.documentId, data } as any);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/sync-plugin-entries.test.ts`
Expected: PASS

- [ ] **Step 5: Wire it into bootstrap, last**

In `packages/cms/server/src/bootstrap.ts`, add the import:

```ts
import { syncPluginEntries } from './lib/sync-plugin-entries';
```

Change the end of the `bootstrap` function:

```ts
  await seedSiteSetting(strapi);
  // Last (Spec §4): the CM plugin index mirrors whatever Site Settings holds
  // after seeding, and runs every boot (not seed-once) so an editor toggle is
  // never permanently stale.
  await syncPluginEntries(strapi);
};
```

- [ ] **Step 6: Run the full cms test suite**

Run: `pnpm --filter @ogs-tech/press-cms test`
Expected: PASS (all suites, no regressions)

- [ ] **Step 7: Commit**

```bash
git add packages/cms/server/src/lib/sync-plugin-entries.ts packages/cms/server/src/lib/sync-plugin-entries.test.ts packages/cms/server/src/bootstrap.ts
git commit -m "feat(cms): sync PLUGIN_DEFINITIONS into the plugin collection type on every boot"
```

---

### Task 8: changeset + full verification + end-to-end smoke test

**Files:**
- Create: `.changeset/base-plugin.md`

**Interfaces:**
- Consumes: nothing new — this task verifies the whole plan's output together.

- [ ] **Step 1: Add the changeset**

Create `.changeset/base-plugin.md`:

```md
---
'@ogs-tech/press-web': major
'@ogs-tech/press-cms': minor
---

feat: Base/Plugin framework — the example plugin, wired end to end, plus a Content-Manager plugin index

The reusable plugin framework every future engine plugin builds on:
`PressPlugin<Id>` (already merged, RESERVED since the cookie-consent
retirement) gets its first real consumer. A synthetic `example` plugin — one
boolean (`enabled`, off by default) and one string (`message`) — is wired
through the full pipeline: a new `preset-config.example-plugin` CMS
component on Site Settings, a pure fail-open mapper
(`plugins/example/map-example-plugin.ts`), and a plain server-component
shell mounted with one line in the host `layout.tsx`
(`{site.plugins.example.enabled && <ExamplePlugin ... />}`). A fresh adopter
site shows nothing extra out of the box; toggling it on in Site Settings
proves the whole contract works.

A new read-only `plugin::press-cms.plugin` collection type gives
Content-Manager visibility into every plugin the engine knows about and its
currently-configured `enabled` state (`syncPluginEntries`, run every boot,
wired last in `bootstrap.ts`) — a view, never a second source of truth.
Every field is `editable: false`; the mirror only refreshes on the next
boot (a lifecycle-hook refresh is a named follow-up, out of scope here).

BREAKING (press-web): `ResolvedPressConfig` gains a REQUIRED `plugins: {
example: ResolvedExamplePlugin }` key — hand-constructed literals fail
`tsc`, the same discipline `pageDefaults`/`layout` already follow.

press-cms is additive only: one component, one Site Settings attribute, one
populate key, one new collection type, one bootstrap step.
```

- [ ] **Step 2: Run the full test suites**

Run: `pnpm --filter @ogs-tech/press-web test`
Expected: PASS

Run: `pnpm --filter @ogs-tech/press-cms test`
Expected: PASS

- [ ] **Step 3: Run typechecks**

Run: `pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS

Run: `pnpm -r --if-present typecheck`
Expected: PASS across every package (`shared`, `cli` included — neither should be affected, confirming no accidental cross-package breakage)

- [ ] **Step 4: Full-stack end-to-end smoke test**

Run: `pnpm dev`

1. Open `http://localhost:1337/admin` → Content Manager → confirm a new **Plugins** collection type is listed in the sidebar (Content Manager sees `plugin::press-cms.plugin` automatically — no admin registration step exists in this repo for content-types, matching the `page`/`site-setting` precedent).
2. Open the Plugins list — confirm exactly one row: `pluginId: example`, `label: Example Plugin`, `configHost: site-setting.examplePlugin`, `enabled: false`. Confirm every field is read-only (no save affordance on any cell).
3. Go to Site Settings, enable the Example Plugin (as in Task 5 Step 7), Save.
4. Restart `pnpm dev` (Ctrl-C, re-run) — confirm the Plugins list row now reads `enabled: true` (the mirror refreshes on the next boot, per the accepted limitation).
5. Confirm `http://localhost:3000` still renders the `data-press-plugin="example"` element from Task 5.

- [ ] **Step 5: Commit**

```bash
git add .changeset/base-plugin.md
git commit -m "chore: add changeset for Base/Plugin framework"
```
