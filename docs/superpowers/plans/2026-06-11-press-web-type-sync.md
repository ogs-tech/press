# `@press/web` + type-sync contract — Implementation Plan (Spec 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@press/web` (the front-end engine) and a CMS→TypeScript type-sync contract so a page authored in `@press/cms` — including the adopter's `custom.callout` and a `press.hero` with an image — renders end-to-end in a server-rendered Next 15 app, with types auto-synced from the engine's runtime schema.

**Architecture:** Three engine-owned contract surfaces ship from `@press/cms`: a public REST `page` route (dynamic-zone populated), a public `/press/schema` endpoint serializing the engine's *runtime* registry (the type-sync source of truth), and the existing `custom.*` admission. A new versioned package `@press/web` provides `BlockRenderer`, the reference `Hero` block, `getPage()`, and a `sync-types` generator that turns the runtime schema into plain TS. The thin host `apps/web` (Project zone) wires its own `custom.callout` React component via an explicit block map — the engine never names the adopter's block.

**Tech Stack:** Strapi 5.48 (plugin), Next 15 App Router + React 19 RSC, TypeScript, pnpm workspaces + Turborepo, Verdaccio (engine tarball), Vitest (pure-logic unit tests), `tsx` (run the TS generator).

---

## Orientation — read before starting

The repo is the Spec 0 skeleton. Key existing facts the plan builds on:

- **Engine** `packages/press-cms` (published `@press/cms`, currently `0.2.0`), a Strapi plugin:
  - `server/src/content-types/page/schema.json` — `page` collection type, `draftAndPublish: true`, `body` dynamic zone (`["press.hero"]`).
  - `server/src/components/hero.json` — `press.hero` (heading/subheading/ctaLabel; **no image yet**).
  - `server/src/lib/inject-components.ts` — `injectComponents` (ships `press.hero`) + `admitCustomBlocks` (admits any `custom.*` from the host into `page.body` at `register`).
  - `server/src/routes/content-api/index.ts` — **stub** `routes: []`. We fill this.
  - `server/src/controllers/{index,controller}.ts`, `services/{index,service}.ts` — placeholder welcome handler we extend.
- **Host (CMS)** `apps/cms` (private `cms`), Project zone: `config/plugins.ts` enables the engine; `src/components/custom/callout.json` is the adopter `custom.callout` (message + variant enum). `src/index.ts` is an intentionally empty lifecycle.
- **Consumption model:** `.npmrc` sets `link-workspace-packages=false` and routes `@press:registry` to Verdaccio, so `apps/cms` consumes the engine **tarball** (`"@press/cms": "0.2.0"`). The `workspace:` protocol is the documented exception that always symlinks — we use it for `@press/web`.
- **Verification patterns** (mirror these): `scripts/contract-check.mjs` (boot smoke + allowed-delta diff), `scripts/assert-no-engine-in-host.mjs` (host-thinness), `scripts/registry.sh` (Verdaccio start/stop).
- **Toolchain:** Node 20.19 (`.nvmrc` `20`), pnpm 10.28. `pnpm --filter <name> <script>`.

**Naming/type contract used across tasks (keep consistent):**
- Schema endpoint path: `GET /api/press/schema`. Page paths: `GET /api/pages`, `GET /api/pages/:slug`.
- Generator emits interfaces named `PascalCase(category)+PascalCase(name)`: `press.hero`→`PressHero`, `custom.callout`→`CustomCallout`. Plus a fixed `PressMedia`, a `PageBody` union array, and a `Page` interface.
- `getPage(slug): Promise<Page | null>` reads `json.data`. `BlockRenderer` props: `{ blocks, components }`. Reference registry export: `referenceBlocks`. Host map export: `customBlocks`.
- `CMS_URL` env var (default `http://localhost:1337`) is read by `getPage`, `Hero`, and `sync-types`.

---

## Phase 1 — Engine contract surfaces (`@press/cms`)

### Task 1.1: Add the `image` media field to `press.hero` + bump engine version

AC 1 requires the hero to carry an image so media serialization crosses the contract. This is an **additive** schema change.

**Files:**
- Modify: `packages/press-cms/server/src/components/hero.json`
- Modify: `packages/press-cms/package.json` (version)
- Modify: `apps/cms/package.json` (consumer version range — done at publish step 1.4)

- [ ] **Step 1: Add the media attribute to `hero.json`**

Replace the `attributes` block in `packages/press-cms/server/src/components/hero.json` so the file reads:

```json
{
  "collectionName": "components_press_heroes",
  "info": { "displayName": "Hero", "description": "Reference hero block shipped by the press engine" },
  "options": {},
  "attributes": {
    "heading": { "type": "string", "required": true },
    "subheading": { "type": "string" },
    "ctaLabel": { "type": "string" },
    "image": { "type": "media", "multiple": false, "allowedTypes": ["images"] }
  }
}
```

- [ ] **Step 2: Bump the engine version**

In `packages/press-cms/package.json` change `"version": "0.2.0"` to `"version": "0.3.0"` (additive feature → minor bump).

- [ ] **Step 3: Verify the schema is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/press-cms/server/src/components/hero.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add packages/press-cms/server/src/components/hero.json packages/press-cms/package.json
git commit -m "feat(press-cms): add image media field to press.hero (Spec 1 AC1)"
```

---

### Task 1.2: Pure engine libs — dynamic-zone populate builder + schema serializer

These two pure functions hold the engine's contract logic and are the only engine pieces unit-testable without a booted Strapi. The schema serializer is the **type-sync source of truth** (Spec §5.2): it reads the engine's *runtime* registries so it can never diverge from what Strapi actually serves.

**Files:**
- Create: `packages/press-cms/server/src/lib/dz-populate.ts`
- Create: `packages/press-cms/server/src/lib/serialize-schema.ts`
- Create: `packages/press-cms/server/src/lib/dz-populate.test.ts`
- Create: `packages/press-cms/server/src/lib/serialize-schema.test.ts`
- Modify: `packages/press-cms/package.json` (add vitest + test script)

- [ ] **Step 1: Add Vitest to the engine package**

In `packages/press-cms/package.json`, add to `scripts`: `"test": "vitest run"`, and to `devDependencies`: `"vitest": "^2.1.0"`. Then run `pnpm install` from the repo root.

Run: `pnpm install`
Expected: completes; `vitest` resolvable via `pnpm --filter @press/cms exec vitest --version`.

- [ ] **Step 2: Write the failing test for `buildBodyPopulate`**

Create `packages/press-cms/server/src/lib/dz-populate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildBodyPopulate } from './dz-populate';

describe('buildBodyPopulate', () => {
  it('builds a per-component `on` map populating one level (media included) for each DZ component', () => {
    expect(buildBodyPopulate(['press.hero', 'custom.callout'])).toEqual({
      body: {
        on: {
          'press.hero': { populate: '*' },
          'custom.callout': { populate: '*' },
        },
      },
    });
  });

  it('produces an empty `on` map when the dynamic zone has no components', () => {
    expect(buildBodyPopulate([])).toEqual({ body: { on: {} } });
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @press/cms exec vitest run server/src/lib/dz-populate.test.ts`
Expected: FAIL — `Failed to resolve import "./dz-populate"`.

- [ ] **Step 4: Implement `buildBodyPopulate`**

Create `packages/press-cms/server/src/lib/dz-populate.ts`:

```ts
/**
 * Builds the document-service `populate` for the page `body` dynamic zone.
 *
 * Strapi 5 populates dynamic zones via a per-component `on` map (see Document
 * Service `populate` docs). `populate: '*'` on each component pulls that
 * component's first-level relations and MEDIA — which is what makes the
 * `press.hero` image cross the REST contract (Spec §5.1 "Media").
 *
 * The component list is passed in (read by the caller from the page content-type
 * at request time) so the engine stays generic: it never hardcodes `custom.*`
 * block names — only what the registry currently admits.
 */
export const buildBodyPopulate = (components: string[]): { body: { on: Record<string, { populate: '*' }> } } => ({
  body: {
    on: Object.fromEntries(components.map((uid) => [uid, { populate: '*' as const }])),
  },
});
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm --filter @press/cms exec vitest run server/src/lib/dz-populate.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write the failing test for the schema serializer**

Create `packages/press-cms/server/src/lib/serialize-schema.test.ts`. It uses a fake `strapi` exposing only what the serializer touches (`contentType`, `get('components')`):

```ts
import { describe, expect, it } from 'vitest';
import { serializeSchema } from './serialize-schema';

const fakeStrapi = () => {
  const components = new Map<string, any>([
    ['press.hero', {
      uid: 'press.hero',
      attributes: {
        heading: { type: 'string', required: true },
        subheading: { type: 'string' },
        ctaLabel: { type: 'string' },
        image: { type: 'media', multiple: false, allowedTypes: ['images'] },
        // noise that must be stripped:
        createdAt: { type: 'datetime', private: true },
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
  return {
    contentType: (_uid: string) => ({
      uid: 'plugin::press-cms.page',
      info: { singularName: 'page', pluralName: 'pages', displayName: 'Page' },
      attributes: {
        title: { type: 'string', required: true },
        slug: { type: 'uid', targetField: 'title' },
        body: { type: 'dynamiczone', components: ['press.hero', 'custom.callout'] },
      },
    }),
    get: (key: string) => (key === 'components' ? components : undefined),
  } as any;
};

describe('serializeSchema', () => {
  it('emits the page content-type and only the DZ-admitted components (runtime view)', () => {
    const out = serializeSchema(fakeStrapi());
    expect(Object.keys(out.contentTypes)).toEqual(['plugin::press-cms.page']);
    // press.unused is registered but NOT in page.body → excluded
    expect(Object.keys(out.components).sort()).toEqual(['custom.callout', 'press.hero']);
  });

  it('keeps only the contract attribute keys and drops private/internal noise', () => {
    const out = serializeSchema(fakeStrapi());
    expect(out.components['press.hero'].attributes).toEqual({
      heading: { type: 'string', required: true },
      subheading: { type: 'string' },
      ctaLabel: { type: 'string' },
      image: { type: 'media', multiple: false, allowedTypes: ['images'] },
    });
    expect(out.components['custom.callout'].attributes.variant).toEqual({
      type: 'enumeration', enum: ['info', 'warning', 'success'], default: 'info',
    });
    expect(out.contentTypes['plugin::press-cms.page'].attributes.body).toEqual({
      type: 'dynamiczone', components: ['press.hero', 'custom.callout'],
    });
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm --filter @press/cms exec vitest run server/src/lib/serialize-schema.test.ts`
Expected: FAIL — cannot resolve `./serialize-schema`.

- [ ] **Step 8: Implement the schema serializer**

Create `packages/press-cms/server/src/lib/serialize-schema.ts`:

```ts
import type { Core } from '@strapi/strapi';

const PAGE_UID = 'plugin::press-cms.page';

// The only attribute keys that are part of the public type-sync contract. Any
// other key Strapi attaches (private flags, column hints, plugin internals) is
// deliberately dropped so the generated types stay stable across Strapi patches.
const KEEP = ['type', 'required', 'enum', 'default', 'components', 'multiple', 'allowedTypes', 'repeatable', 'component'] as const;

type Attr = Record<string, unknown>;

const pickAttributes = (attributes: Record<string, Attr>): Record<string, Attr> => {
  const out: Record<string, Attr> = {};
  for (const [name, attr] of Object.entries(attributes ?? {})) {
    // Skip Strapi-managed timestamp/private fields — never part of the contract.
    if (attr?.private) continue;
    if (['createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy', 'locale'].includes(name)) continue;
    const kept: Attr = {};
    for (const key of KEEP) {
      if (attr[key] !== undefined) kept[key] = attr[key];
    }
    out[name] = kept;
  }
  return out;
};

export interface PressSchema {
  contentTypes: Record<string, { uid: string; info: unknown; attributes: Record<string, Attr> }>;
  components: Record<string, { uid: string; attributes: Record<string, Attr> }>;
}

/**
 * Serializes the engine's RUNTIME view (Spec §5.2 golden rule): the page
 * content-type plus exactly the components currently admitted into its `body`
 * dynamic zone — `press.*` reference blocks AND already-admitted `custom.*`.
 * Reading the live registry (not loose JSON on disk) means the generator can
 * never disagree with what Strapi actually serves.
 */
export const serializeSchema = (strapi: Core.Strapi): PressSchema => {
  const page = strapi.contentType(PAGE_UID as any) as any;
  const registry = strapi.get('components') as Map<string, any>;
  const dzComponents: string[] = page?.attributes?.body?.components ?? [];

  const components: PressSchema['components'] = {};
  for (const uid of dzComponents) {
    const comp = registry.get(uid);
    if (comp) components[uid] = { uid, attributes: pickAttributes(comp.attributes) };
  }

  return {
    contentTypes: {
      [page.uid]: { uid: page.uid, info: page.info, attributes: pickAttributes(page.attributes) },
    },
    components,
  };
};
```

- [ ] **Step 9: Run both lib tests to verify they pass**

Run: `pnpm --filter @press/cms test`
Expected: PASS — 4 tests across `dz-populate.test.ts` + `serialize-schema.test.ts`.

- [ ] **Step 10: Commit**

```bash
git add packages/press-cms/server/src/lib/dz-populate.ts packages/press-cms/server/src/lib/serialize-schema.ts \
        packages/press-cms/server/src/lib/dz-populate.test.ts packages/press-cms/server/src/lib/serialize-schema.test.ts \
        packages/press-cms/package.json
git commit -m "feat(press-cms): add DZ populate builder + runtime schema serializer with unit tests"
```

---

### Task 1.3: Page + schema controllers and the content-api routes

Wire the two pure libs into Strapi: a `page` controller (find/findOne-by-slug, published-only, DZ-populated), a `schema` controller (serializes the runtime view), and the three public routes.

**Files:**
- Create: `packages/press-cms/server/src/controllers/page.ts`
- Create: `packages/press-cms/server/src/controllers/schema.ts`
- Modify: `packages/press-cms/server/src/controllers/index.ts`
- Modify: `packages/press-cms/server/src/routes/content-api/index.ts`

- [ ] **Step 1: Implement the `page` controller**

Create `packages/press-cms/server/src/controllers/page.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { buildBodyPopulate } from '../lib/dz-populate';

const PAGE_UID = 'plugin::press-cms.page';

/**
 * Engine-owned page controller. The adopter never defines this — it ships the
 * wire shape the front-end consumes (Spec §5.1).
 *
 * Published-only + 404 (Spec decision 2026-06-11): every read filters to the
 * published view; a missing/unpublished slug is a 404, surfaced by `getPage` as
 * the App Router's notFound().
 */
const page = ({ strapi }: { strapi: Core.Strapi }) => {
  const populate = () => {
    const ct = strapi.contentType(PAGE_UID as any) as any;
    const components: string[] = ct?.attributes?.body?.components ?? [];
    return buildBodyPopulate(components);
  };

  return {
    async find(ctx: any) {
      const data = await strapi.documents(PAGE_UID as any).findMany({
        status: 'published',
        ...populate(),
      });
      ctx.body = { data };
    },

    async findOne(ctx: any) {
      const { slug } = ctx.params;
      const [doc] = await strapi.documents(PAGE_UID as any).findMany({
        filters: { slug },
        status: 'published',
        limit: 1,
        ...populate(),
      });
      if (!doc) return ctx.notFound();
      ctx.body = { data: doc };
    },
  };
};

export default page;
```

- [ ] **Step 2: Implement the `schema` controller**

Create `packages/press-cms/server/src/controllers/schema.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { serializeSchema } from '../lib/serialize-schema';

/**
 * Public, versioned type-sync source of truth (Spec §5.2). Returns the engine's
 * runtime registry view; `@press/web sync-types` fetches this to generate types.
 */
const schema = ({ strapi }: { strapi: Core.Strapi }) => ({
  get(ctx: any) {
    ctx.body = serializeSchema(strapi);
  },
});

export default schema;
```

- [ ] **Step 3: Register both controllers**

Replace `packages/press-cms/server/src/controllers/index.ts` with:

```ts
import controller from './controller';
import page from './page';
import schema from './schema';

export default { controller, page, schema };
```

- [ ] **Step 4: Define the public content-api routes**

Replace `packages/press-cms/server/src/routes/content-api/index.ts` with:

```ts
/**
 * Engine-owned, versioned public routes (Spec §5).
 *
 * `auth: false` makes each route public WITHOUT seeding the users-permissions
 * plugin's "public" role — so the contract is expressed entirely in engine code
 * the adopter never touches (no admin clicks, no Project-zone state). Access is
 * still scoped: the controllers only ever read PUBLISHED page content.
 *
 * Content-api routes mount under the global `/api` prefix with the path as-is
 * (no plugin-name prefix): `/api/pages`, `/api/pages/:slug`, `/api/press/schema`.
 */
export default () => ({
  type: 'content-api',
  routes: [
    { method: 'GET', path: '/pages', handler: 'page.find', config: { auth: false } },
    { method: 'GET', path: '/pages/:slug', handler: 'page.findOne', config: { auth: false } },
    { method: 'GET', path: '/press/schema', handler: 'schema.get', config: { auth: false } },
  ],
});
```

- [ ] **Step 5: Typecheck the engine server**

Run: `pnpm --filter @press/cms test:ts:back`
Expected: PASS (no type errors). If `strapi.documents(...).findMany` flags an overload, the `as any` on the UID already loosens it; confirm the command exits 0.

- [ ] **Step 6: Re-run engine unit tests (no regression)**

Run: `pnpm --filter @press/cms test`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/press-cms/server/src/controllers/page.ts packages/press-cms/server/src/controllers/schema.ts \
        packages/press-cms/server/src/controllers/index.ts packages/press-cms/server/src/routes/content-api/index.ts
git commit -m "feat(press-cms): public page + /press/schema routes (Spec §5.1, §5.2)"
```

---

### Task 1.4: Publish the engine and verify the live endpoints

The host consumes the engine tarball, so engine changes become visible only after publish + update. Do this once, here, then verify the three endpoints against a booted host.

**Files:** none created; this is a build/publish/boot checkpoint.

- [ ] **Step 1: Start Verdaccio (if not running) and build the engine**

```bash
scripts/registry.sh start
pnpm --filter @press/cms build
```
Expected: `started` (or `already running`); engine `dist/` built.

- [ ] **Step 2: Publish `@press/cms@0.3.0`**

```bash
( cd packages/press-cms && npm publish --registry http://localhost:4873 --userconfig "$PWD/../../.npmrc" )
```
Expected: `+ @press/cms@0.3.0`.

- [ ] **Step 3: Update the host to the new engine**

```bash
pnpm --filter cms update @press/cms@0.3.0
```
Expected: `apps/cms/package.json` now pins `"@press/cms": "0.3.0"`; lockfile updated.

- [ ] **Step 4: Build the host and boot it in the background**

```bash
pnpm --filter cms build
( pnpm --filter cms start > /tmp/press-cms-boot.log 2>&1 & echo $! > /tmp/press-cms.pid )
```
Then wait for health (mirrors `contract-check.mjs`):
```bash
for i in $(seq 1 60); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health || true); [ "$c" = "204" ] && { echo BOOTOK; break; }; sleep 2; done
```
Expected: `BOOTOK`.

- [ ] **Step 5: Verify the schema endpoint serves the runtime contract**

Run: `curl -s http://localhost:1337/api/press/schema | node -e "const s=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('components:', Object.keys(s.components).sort().join(',')); console.log('hero.image.type:', s.components['press.hero'].attributes.image.type); console.log('callout.variant.enum:', s.components['custom.callout'].attributes.variant.enum.join('|'));"`

Expected:
```
components: custom.callout,press.hero
hero.image.type: media
callout.variant.enum: info|warning|success
```
This proves §5.2: the endpoint reflects the *admitted* `custom.callout` and the new `press.hero.image`.

- [ ] **Step 6: Verify published-only + 404 on the page route**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:1337/api/pages/does-not-exist`
Expected: `404` (no seeded page yet → `notFound()`).

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:1337/api/pages`
Expected: `200` (empty `data` array is fine at this point).

- [ ] **Step 7: Stop the host**

```bash
kill "$(cat /tmp/press-cms.pid)" 2>/dev/null; rm -f /tmp/press-cms.pid
```

- [ ] **Step 8: Commit the host update**

```bash
git add apps/cms/package.json pnpm-lock.yaml
git commit -m "chore(cms): consume @press/cms 0.3.0 (page + schema contract surfaces)"
```

---

## Phase 2 — The `@press/web` engine package

### Task 2.1: Scaffold `@press/web`

**Files:**
- Create: `packages/press-web/package.json`
- Create: `packages/press-web/tsconfig.json`
- Create: `packages/press-web/.gitignore`
- Create: `packages/press-web/vitest.config.ts`

- [ ] **Step 1: Create `package.json`**

Create `packages/press-web/package.json`:

```json
{
  "name": "@press/web",
  "version": "0.1.0",
  "description": "press engine — front-end renderer + CMS→TS type-sync",
  "license": "MIT",
  "author": "Odenir Gomes",
  "type": "module",
  "exports": {
    "./package.json": "./package.json",
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
    "./types": { "types": "./src/types/index.ts", "default": "./src/types/index.ts" }
  },
  "bin": { "press-sync-types": "./bin/sync-types.ts" },
  "scripts": {
    "sync-types": "tsx bin/sync-types.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "react": "^19",
    "tsx": "^4.19.0",
    "typescript": "^5",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

Create `packages/press-web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "bin"]
}
```

- [ ] **Step 3: Create `.gitignore` (gitignore generated types — Spec §4.1)**

Create `packages/press-web/.gitignore`:

```
node_modules/
src/types/generated.ts
```

- [ ] **Step 4: Create `vitest.config.ts`**

Create `packages/press-web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Install**

Run: `pnpm install`
Expected: `@press/web` linked into the workspace; `tsx`, `vitest`, `react`, types resolved.

- [ ] **Step 6: Commit**

```bash
git add packages/press-web/package.json packages/press-web/tsconfig.json packages/press-web/.gitignore packages/press-web/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(press-web): scaffold @press/web package"
```

---

### Task 2.2: The type generator (highest-risk surface — thorough unit tests)

Per Spec §10, the riskiest surface is the schema→TS mapping. Build it as a pure function with exhaustive tests before anything consumes it.

**Files:**
- Create: `packages/press-web/src/generator/generate.ts`
- Create: `packages/press-web/src/generator/generate.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/press-web/src/generator/generate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pascalForUid, tsTypeForAttribute, generateTypes } from './generate';

describe('pascalForUid', () => {
  it('PascalCases each dotted segment and concatenates', () => {
    expect(pascalForUid('press.hero')).toBe('PressHero');
    expect(pascalForUid('custom.callout')).toBe('CustomCallout');
    expect(pascalForUid('custom.call-to-action')).toBe('CustomCallToAction');
  });
});

describe('tsTypeForAttribute', () => {
  it('maps scalars', () => {
    expect(tsTypeForAttribute({ type: 'string' })).toBe('string');
    expect(tsTypeForAttribute({ type: 'text' })).toBe('string');
    expect(tsTypeForAttribute({ type: 'uid' })).toBe('string');
    expect(tsTypeForAttribute({ type: 'integer' })).toBe('number');
    expect(tsTypeForAttribute({ type: 'decimal' })).toBe('number');
    expect(tsTypeForAttribute({ type: 'boolean' })).toBe('boolean');
    expect(tsTypeForAttribute({ type: 'datetime' })).toBe('string');
    expect(tsTypeForAttribute({ type: 'json' })).toBe('unknown');
  });

  it('maps enumeration to a string-literal union', () => {
    expect(tsTypeForAttribute({ type: 'enumeration', enum: ['info', 'warning'] }))
      .toBe("'info' | 'warning'");
  });

  it('maps media to PressMedia, honoring `multiple`', () => {
    expect(tsTypeForAttribute({ type: 'media', multiple: false })).toBe('PressMedia');
    expect(tsTypeForAttribute({ type: 'media', multiple: true })).toBe('PressMedia[]');
  });

  it('falls back to unknown for unrecognized types', () => {
    expect(tsTypeForAttribute({ type: 'relation' })).toBe('unknown');
  });
});

describe('generateTypes', () => {
  const schema = {
    contentTypes: {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: { singularName: 'page' },
        attributes: {
          title: { type: 'string', required: true },
          slug: { type: 'uid' },
          body: { type: 'dynamiczone', components: ['press.hero', 'custom.callout'] },
        },
      },
    },
    components: {
      'press.hero': {
        uid: 'press.hero',
        attributes: {
          heading: { type: 'string', required: true },
          subheading: { type: 'string' },
          ctaLabel: { type: 'string' },
          image: { type: 'media', multiple: false, allowedTypes: ['images'] },
        },
      },
      'custom.callout': {
        uid: 'custom.callout',
        attributes: {
          message: { type: 'string', required: true },
          variant: { type: 'enumeration', enum: ['info', 'warning', 'success'], default: 'info' },
        },
      },
    },
  };

  const out = generateTypes(schema);

  it('emits a fixed PressMedia interface', () => {
    expect(out).toContain('export interface PressMedia');
    expect(out).toContain('url: string');
  });

  it('emits a discriminated component interface with __component and required/optional fields', () => {
    expect(out).toContain("__component: 'press.hero'");
    expect(out).toContain('heading: string;');        // required → not optional
    expect(out).toContain('subheading?: string;');    // optional
    expect(out).toContain('image?: PressMedia;');      // media single, optional
  });

  it('maps the custom block enum field', () => {
    expect(out).toContain("__component: 'custom.callout'");
    expect(out).toContain("variant?: 'info' | 'warning' | 'success';");
  });

  it('emits a PageBody union array over the DZ components and a Page interface', () => {
    expect(out).toContain('export type PageBody = (PressHero | CustomCallout)[];');
    expect(out).toContain('export interface Page');
    expect(out).toContain('body: PageBody;');
    expect(out).toContain('title: string;');
    expect(out).toContain('documentId: string;');
  });

  it('starts with the do-not-edit banner', () => {
    expect(out.startsWith('// AUTO-GENERATED')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @press/web exec vitest run src/generator/generate.test.ts`
Expected: FAIL — cannot resolve `./generate`.

- [ ] **Step 3: Implement the generator**

Create `packages/press-web/src/generator/generate.ts`:

```ts
/**
 * Pure schema → TypeScript generator. Input is the JSON served by the engine's
 * `/api/press/schema` (the runtime contract). Output is plain, framework-agnostic
 * TS written to src/types/generated.ts. No Strapi types are referenced — the
 * generator is decoupled from Strapi's internal type format on purpose (Spec
 * §5.2 rejected alternative 3).
 */

export interface Attr {
  type: string;
  required?: boolean;
  enum?: string[];
  multiple?: boolean;
  components?: string[];
  [k: string]: unknown;
}

export interface PressSchema {
  contentTypes: Record<string, { uid: string; info: unknown; attributes: Record<string, Attr> }>;
  components: Record<string, { uid: string; attributes: Record<string, Attr> }>;
}

const pascalSegment = (s: string): string =>
  s
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

/** `press.hero` → `PressHero`, `custom.call-to-action` → `CustomCallToAction`. */
export const pascalForUid = (uid: string): string =>
  uid.split('.').map(pascalSegment).join('');

const SCALARS: Record<string, string> = {
  string: 'string', text: 'string', richtext: 'string', uid: 'string',
  email: 'string', password: 'string', date: 'string', datetime: 'string',
  time: 'string', timestamp: 'string',
  integer: 'number', biginteger: 'number', float: 'number', decimal: 'number',
  boolean: 'boolean', json: 'unknown',
};

/** Maps a single Strapi attribute to its TS type expression. */
export const tsTypeForAttribute = (attr: Attr): string => {
  if (attr.type === 'enumeration' && Array.isArray(attr.enum)) {
    return attr.enum.map((v) => `'${v}'`).join(' | ');
  }
  if (attr.type === 'media') {
    return attr.multiple ? 'PressMedia[]' : 'PressMedia';
  }
  return SCALARS[attr.type] ?? 'unknown';
};

const emitInterfaceBody = (attributes: Record<string, Attr>, indent = '  '): string =>
  Object.entries(attributes)
    .map(([name, attr]) => {
      // DZ inside a component is out of scope for Spec 1; skip if present.
      if (attr.type === 'dynamiczone') return null;
      const optional = attr.required ? '' : '?';
      return `${indent}${name}${optional}: ${tsTypeForAttribute(attr)};`;
    })
    .filter(Boolean)
    .join('\n');

const PRESS_MEDIA = `export interface PressMedia {
  url: string;
  width?: number;
  height?: number;
  alternativeText?: string | null;
  name?: string;
  mime?: string;
}`;

export const generateTypes = (schema: PressSchema): string => {
  const blocks: string[] = [
    '// AUTO-GENERATED by @press/web sync-types — DO NOT EDIT.',
    '// Regenerate with: pnpm --filter @press/web sync-types',
    '',
    PRESS_MEDIA,
    '',
  ];

  const componentTypeNames: Record<string, string> = {};
  for (const [uid, comp] of Object.entries(schema.components)) {
    const name = pascalForUid(uid);
    componentTypeNames[uid] = name;
    blocks.push(
      `export interface ${name} {`,
      `  __component: '${uid}';`,
      `  id: number;`,
      emitInterfaceBody(comp.attributes),
      `}`,
      '',
    );
  }

  // The page content-type (single one in Spec 1).
  const page = Object.values(schema.contentTypes)[0];
  const bodyAttr = page.attributes.body;
  const union = (bodyAttr?.components ?? [])
    .map((uid) => componentTypeNames[uid])
    .filter(Boolean)
    .join(' | ');

  blocks.push(`export type PageBody = (${union || 'never'})[];`, '');

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

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @press/web exec vitest run src/generator/generate.test.ts`
Expected: PASS (all `generateTypes` / `tsTypeForAttribute` / `pascalForUid` tests green).

- [ ] **Step 5: Commit**

```bash
git add packages/press-web/src/generator/generate.ts packages/press-web/src/generator/generate.test.ts
git commit -m "feat(press-web): pure schema→TS generator with exhaustive unit tests"
```

---

### Task 2.3: The `sync-types` binary

**Files:**
- Create: `packages/press-web/bin/sync-types.ts`

- [ ] **Step 1: Implement the bin**

Create `packages/press-web/bin/sync-types.ts`:

```ts
#!/usr/bin/env tsx
/**
 * Fetches the engine's runtime schema and writes src/types/generated.ts.
 * Requires a booted CMS (Spec §10 accepted trade-off — runtime is e2e anyway;
 * the CLI in Spec 3 will wire this into `press dev` so it is invisible later).
 *
 * Output lands in the ENGINE zone (this package), gitignored — never in apps/web
 * (Spec §4.1, AC4).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateTypes, type PressSchema } from '../src/generator/generate';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

async function main() {
  const url = `${CMS_URL}/api/press/schema`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[press/web] schema fetch failed: ${res.status} ${url}`);
  const schema = (await res.json()) as PressSchema;

  const out = generateTypes(schema);
  const dir = path.join(import.meta.dirname, '..', 'src', 'types');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'generated.ts');
  writeFileSync(file, out, 'utf8');
  console.log(`[press/web] wrote ${path.relative(process.cwd(), file)} (${out.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke-check the bin parses/loads (no CMS needed)**

Run: `pnpm --filter @press/web exec tsx -e "import('./bin/sync-types.ts').catch(()=>{}); console.log('loads')"`
Expected: prints `loads` (a fetch failure is fine here — we only verify the module imports without a syntax/type error). If it errors on import resolution, fix before continuing.

> A real run against a booted CMS happens in Task 3.3 (that's where `generated.ts` is first produced).

- [ ] **Step 3: Commit**

```bash
git add packages/press-web/bin/sync-types.ts
git commit -m "feat(press-web): sync-types bin — fetch /press/schema, emit generated.ts"
```

---

### Task 2.4: Renderer, reference block, fetch helper, and barrels

**Files:**
- Create: `packages/press-web/src/types/index.ts`
- Create: `packages/press-web/src/blocks/hero.tsx`
- Create: `packages/press-web/src/reference-blocks.ts`
- Create: `packages/press-web/src/block-renderer.tsx`
- Create: `packages/press-web/src/get-page.ts`
- Create: `packages/press-web/src/index.ts`

> No unit tests here — these are exercised end-to-end in Phase 4 (real render against real Strapi, per Spec §2 "runtime is real, not fixtured"). The generated-types dependency makes isolated `tsc` meaningful only after a sync (Task 3.3 / AC2).

- [ ] **Step 1: Types barrel (`./types` export)**

Create `packages/press-web/src/types/index.ts`:

```ts
// Re-exports the sync-generated types. `generated.ts` is gitignored and produced
// by `pnpm --filter @press/web sync-types`; this file fails to resolve until the
// first sync — which is the intended contract (Spec §6, AC2).
export * from './generated';
```

- [ ] **Step 2: Reference `Hero` block (server component)**

Create `packages/press-web/src/blocks/hero.tsx`:

```tsx
import type { PressHero } from '../types/generated';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/**
 * Reference block `press.hero` (Spec §5.3). A plain server component — HTML is
 * rendered on the server for SEO. Uses a raw <img> (not next/image) so the
 * contract test needs no image-domain config; the src is resolved ABSOLUTE
 * against the CMS base, proving media serialization crosses the contract (AC1).
 */
export function Hero(props: PressHero) {
  const { heading, subheading, ctaLabel, image } = props;
  const src = image?.url ? new URL(image.url, CMS_URL).toString() : undefined;
  return (
    <section data-block="press.hero">
      {src ? <img src={src} alt={image?.alternativeText ?? ''} /> : null}
      <h1>{heading}</h1>
      {subheading ? <p>{subheading}</p> : null}
      {ctaLabel ? <a href="#">{ctaLabel}</a> : null}
    </section>
  );
}
```

- [ ] **Step 3: Engine-owned reference registry**

Create `packages/press-web/src/reference-blocks.ts`:

```ts
import type { ComponentType } from 'react';
import { Hero } from './blocks/hero';

/**
 * Engine-owned reference block registry (Spec §5.3). The engine references
 * `press.*` ONLY. Adopter `custom.*` blocks are never named here — they arrive
 * via the explicit `components` prop on <BlockRenderer/>.
 */
export const referenceBlocks: Record<string, ComponentType<any>> = {
  'press.hero': Hero,
};
```

- [ ] **Step 4: `BlockRenderer`**

Create `packages/press-web/src/block-renderer.tsx`:

```tsx
import type { ComponentType } from 'react';
import { referenceBlocks } from './reference-blocks';

interface Block {
  __component: string;
  id: number;
  [key: string]: unknown;
}

interface BlockRendererProps {
  /** The page's dynamic-zone array (typed as PageBody at the call site). */
  blocks: Block[];
  /** Adopter custom blocks, passed EXPLICITLY (no global mutable registry — Spec §5.3). */
  components?: Record<string, ComponentType<any>>;
}

/**
 * Iterates the dynamic zone, picks a component by `__component`, renders it with
 * the block's typed props. Reference blocks merge first; adopter blocks override
 * by key. Unknown `__component` → tolerant fallback (render nothing + a dev-only
 * warning), never a crash — mirroring the engine's tolerant admission (Spec §5.3).
 */
export function BlockRenderer({ blocks, components = {} }: BlockRendererProps) {
  const registry = { ...referenceBlocks, ...components };
  return (
    <>
      {blocks.map((block, i) => {
        const Component = registry[block.__component];
        if (!Component) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[press/web] no component registered for block "${block.__component}" — skipping`);
          }
          return null;
        }
        return <Component key={block.id ?? i} {...block} />;
      })}
    </>
  );
}
```

- [ ] **Step 5: `getPage` fetch helper**

Create `packages/press-web/src/get-page.ts`:

```ts
import type { Page } from './types/generated';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/**
 * Fetches a PUBLISHED page by slug over REST (Spec §5.1). Runs server-side (RSC),
 * so there is no browser CORS surface for the data fetch. A missing/unpublished
 * slug yields the engine's 404 → returns null, which the route turns into
 * notFound(). `cache: 'no-store'` keeps the contract test deterministic.
 */
export async function getPage(slug: string): Promise<Page | null> {
  const res = await fetch(`${CMS_URL}/api/pages/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getPage("${slug}") failed: ${res.status}`);
  const json = (await res.json()) as { data: Page | null };
  return json.data ?? null;
}
```

- [ ] **Step 6: Public barrel (`.` export)**

Create `packages/press-web/src/index.ts`:

```ts
export { BlockRenderer } from './block-renderer';
export { getPage } from './get-page';
export { referenceBlocks } from './reference-blocks';
export { Hero } from './blocks/hero';
export type { Page, PageBody, PressMedia, PressHero } from './types';
```

> Note: `./index.ts` uses `import type` transitively for generated types, so Vitest/runtime never needs `generated.ts`; only `tsc --noEmit` does (after a sync — AC2).

- [ ] **Step 7: Confirm unit tests still pass (generated.ts not required)**

Run: `pnpm --filter @press/web test`
Expected: PASS (generator tests) — proving the runtime/test path is decoupled from `generated.ts`.

- [ ] **Step 8: Commit**

```bash
git add packages/press-web/src/types/index.ts packages/press-web/src/blocks/hero.tsx \
        packages/press-web/src/reference-blocks.ts packages/press-web/src/block-renderer.tsx \
        packages/press-web/src/get-page.ts packages/press-web/src/index.ts
git commit -m "feat(press-web): BlockRenderer, Hero reference block, getPage, barrels"
```

---

## Phase 3 — The host `apps/web` (Project zone)

### Task 3.1: Scaffold the Next app

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next-env.d.ts`
- Create: `apps/web/.gitignore`
- Create: `apps/web/.env`
- Create: `apps/web/app/layout.tsx`

- [ ] **Step 1: `package.json` (depends on `@press/web` via `workspace:*`)**

Create `apps/web/package.json`:

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "description": "Thin Next host that renders press engine pages",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@press/web": "workspace:*",
    "next": "^15.1.0",
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
```

> `workspace:*` forces a symlink to the local `@press/web` regardless of `.npmrc`'s `link-workspace-packages=false` + `@press:registry` routing — this is Spec §4.1's "versioned = local workspace package"; the publish story is deferred to Spec 4/5.

- [ ] **Step 2: `next.config.ts` (transpile the workspace package)**

Create `apps/web/next.config.ts`:

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // @press/web ships TS/TSX source (consumed via workspace symlink), so Next must
  // transpile it rather than expecting pre-built JS.
  transpilePackages: ['@press/web'],
};

export default config;
```

- [ ] **Step 3: `tsconfig.json`**

Create `apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "noEmit": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: `next-env.d.ts`**

Create `apps/web/next-env.d.ts`:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 5: `.gitignore`**

Create `apps/web/.gitignore`:

```
node_modules/
.next/
next-env.d.ts
```

> `next-env.d.ts` is regenerated by Next on build; gitignore it (matches Next's own scaffold).

- [ ] **Step 6: `.env` (Project zone — CMS base URL)**

Create `apps/web/.env`:

```
CMS_URL=http://localhost:1337
```

- [ ] **Step 7: Root layout**

Create `apps/web/app/layout.tsx`:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Install**

Run: `pnpm install`
Expected: `apps/web` resolves; `@press/web` appears as a symlink (`ls -l apps/web/node_modules/@press/web` → points into `packages/press-web`).

- [ ] **Step 9: Commit**

```bash
git add apps/web/package.json apps/web/next.config.ts apps/web/tsconfig.json apps/web/next-env.d.ts \
        apps/web/.gitignore apps/web/app/layout.tsx pnpm-lock.yaml
git commit -m "chore(web): scaffold thin Next 15 host consuming @press/web (workspace)"
```

> Note `apps/web/.env` is gitignored by the root `.gitignore` (`.env`) — intentional; the README documents it.

---

### Task 3.2: Custom block, explicit block map, and the slug route

**Files:**
- Create: `apps/web/blocks/custom/Callout.tsx`
- Create: `apps/web/press.blocks.ts`
- Create: `apps/web/app/[...slug]/page.tsx`

- [ ] **Step 1: The adopter custom block (`custom.callout`)**

Create `apps/web/blocks/custom/Callout.tsx`:

```tsx
import type { CustomCallout } from '@press/web/types';

const VARIANT_STYLE: Record<string, string> = {
  info: '#2563eb',
  warning: '#d97706',
  success: '#16a34a',
};

/**
 * Adopter-owned custom block (Project zone, Spec §4.2). The engine never names
 * this — it renders solely because press.blocks.ts maps 'custom.callout' to it.
 */
export function Callout(props: CustomCallout) {
  const { message, variant } = props;
  return (
    <aside data-block="custom.callout" style={{ borderLeft: `4px solid ${VARIANT_STYLE[variant ?? 'info']}` }}>
      {message}
    </aside>
  );
}
```

- [ ] **Step 2: The explicit block map (the extension point)**

Create `apps/web/press.blocks.ts`:

```ts
import type { ComponentType } from 'react';
import { Callout } from './blocks/custom/Callout';

/**
 * The single Project-zone extension point on the web side (Spec §5.3): an
 * explicit map of `custom.*` blocks the adopter owns. Passed as a prop to
 * <BlockRenderer/> — not a global mutable registry — so render is deterministic
 * under RSC/SSR.
 */
export const customBlocks: Record<string, ComponentType<any>> = {
  'custom.callout': Callout,
};
```

- [ ] **Step 3: The catch-all slug route (server component)**

Create `apps/web/app/[...slug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { BlockRenderer, getPage } from '@press/web';
import { customBlocks } from '../../press.blocks';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPage((slug ?? []).join('/') || 'home');
  return { title: page?.title ?? 'Not found' };
}

export default async function CatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPage((slug ?? []).join('/') || 'home');
  if (!page) notFound();
  return <BlockRenderer blocks={page.body} components={customBlocks} />;
}
```

> Next 15: `params` is a Promise — awaited above. An empty catch-all (`/`) maps to slug `home`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/blocks/custom/Callout.tsx apps/web/press.blocks.ts apps/web/app/
git commit -m "feat(web): custom Callout block, explicit block map, catch-all slug route"
```

---

### Task 3.3: First type-sync + typecheck both packages (AC 2)

This is the first real `sync-types` run; it produces `generated.ts`, then `tsc` proves the types flow through `@press/web` and `apps/web` — including `custom.callout`'s fields.

**Files:** none created; produces the gitignored `packages/press-web/src/types/generated.ts`.

- [ ] **Step 1: Boot the CMS (built in Task 1.4)**

```bash
( pnpm --filter cms start > /tmp/press-cms-boot.log 2>&1 & echo $! > /tmp/press-cms.pid )
for i in $(seq 1 60); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health || true); [ "$c" = "204" ] && { echo BOOTOK; break; }; sleep 2; done
```
Expected: `BOOTOK`.

- [ ] **Step 2: Run sync-types**

Run: `pnpm --filter @press/web sync-types`
Expected: `[press/web] wrote src/types/generated.ts (<N> bytes)`.

- [ ] **Step 3: Inspect the generated types**

Run: `grep -E "interface (PressHero|CustomCallout|Page)|PageBody|variant\?" packages/press-web/src/types/generated.ts`
Expected (order may vary): lines showing `export interface PressHero`, `export interface CustomCallout`, `export type PageBody = (PressHero | CustomCallout)[];`, `export interface Page`, and `variant?: 'info' | 'warning' | 'success';`.

- [ ] **Step 4: Typecheck `@press/web` (AC 2)**

Run: `pnpm --filter @press/web typecheck`
Expected: PASS (now that `generated.ts` exists, `getPage`/`Hero`/barrels resolve their types).

- [ ] **Step 5: Typecheck `apps/web` (AC 2 — consumer site)**

Run: `pnpm --filter web typecheck`
Expected: PASS — `Callout` consumes `CustomCallout`, the route consumes `Page`/`BlockRenderer` props, all typed from the generated types.

- [ ] **Step 6: Stop the CMS**

```bash
kill "$(cat /tmp/press-cms.pid)" 2>/dev/null; rm -f /tmp/press-cms.pid
```

- [ ] **Step 7: No commit (generated.ts is gitignored; configs already committed)**

Run: `git status --porcelain`
Expected: empty — proving the sync wrote nothing tracked (previews AC 4; the formal check is Task 5.2).

---

## Phase 4 — End-to-end render (AC 1) and the custom-block contract (AC 5)

### Task 4.1: Seed a real page (hero+image + callout)

A reproducible seed via Strapi's programmatic API: boot the host headless, upload a 1×1 PNG through the upload service, create a published page with both blocks, destroy. No admin clicks; no engine contract leak (it's a repo script, not host `src/`).

**Files:**
- Create: `scripts/seed-e2e.mjs`

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-e2e.mjs`:

```js
// scripts/seed-e2e.mjs — reproducible e2e seed (Spec §8 "documented run").
// Boots the host (apps/cms) programmatically, uploads a tiny PNG, creates a
// PUBLISHED page with a press.hero (with image) + a custom.callout, then exits.
// Run from apps/cms: `cd apps/cms && node ../../scripts/seed-e2e.mjs`
import { createStrapi, compileStrapi } from '@strapi/strapi';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PAGE_UID = 'plugin::press-cms.page';
const SLUG = 'home';

// 1×1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function main() {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  try {
    // Idempotency: remove any existing 'home' page (draft + published).
    const existing = await app.documents(PAGE_UID).findMany({ filters: { slug: SLUG }, status: 'draft' });
    for (const doc of existing) {
      await app.documents(PAGE_UID).delete({ documentId: doc.documentId });
    }

    // Upload the image through the upload plugin service.
    const tmpDir = path.join(process.cwd(), '.tmp');
    mkdirSync(tmpDir, { recursive: true });
    const filepath = path.join(tmpDir, 'hero.png');
    writeFileSync(filepath, PNG);

    const uploaded = await app.plugin('upload').service('upload').upload({
      data: {},
      files: {
        filepath,
        originalFilename: 'hero.png',
        mimetype: 'image/png',
        size: PNG.length,
      },
    });
    const fileId = uploaded[0].id;
    console.log(`[seed] uploaded image id=${fileId}`);

    // Create the published page with both blocks.
    const page = await app.documents(PAGE_UID).create({
      data: {
        title: 'E2E Home',
        slug: SLUG,
        body: [
          {
            __component: 'press.hero',
            heading: 'Hello from press',
            subheading: 'server-rendered end-to-end',
            ctaLabel: 'Get started',
            image: fileId,
          },
          {
            __component: 'custom.callout',
            message: 'Adopter callout renders via the Project-zone block map',
            variant: 'success',
          },
        ],
      },
      status: 'published',
    });
    console.log(`[seed] created published page documentId=${page.documentId} slug=${SLUG}`);
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
```

> The upload-service `files` shape (`filepath`/`originalFilename`/`mimetype`/`size`) is the formidable-style descriptor Strapi 5's upload service accepts for server-side uploads. If the booted instance reports a different field name, the error surfaces here at seed time (Step 2) — the one place this is exercised.

- [ ] **Step 2: Run the seed against a stopped server (writes to the shared sqlite)**

Ensure the CMS is **not** running (the programmatic load needs the DB file, and a running `strapi start` holds it). Then:

```bash
( cd apps/cms && node ../../scripts/seed-e2e.mjs )
```
Expected:
```
[seed] uploaded image id=<n>
[seed] created published page documentId=<id> slug=home
```

- [ ] **Step 3: Verify the page serves over REST with the image populated**

```bash
( pnpm --filter cms start > /tmp/press-cms-boot.log 2>&1 & echo $! > /tmp/press-cms.pid )
for i in $(seq 1 60); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health || true); [ "$c" = "204" ] && break; sleep 2; done
curl -s http://localhost:1337/api/pages/home | node -e "const p=JSON.parse(require('fs').readFileSync(0,'utf8')).data; const hero=p.body.find(b=>b.__component==='press.hero'); const cal=p.body.find(b=>b.__component==='custom.callout'); console.log('hero.heading:', hero.heading); console.log('hero.image.url:', hero.image?.url); console.log('callout.message:', cal.message);"
```
Expected:
```
hero.heading: Hello from press
hero.image.url: /uploads/hero_<hash>.png
callout.message: Adopter callout renders via the Project-zone block map
```
The relative `/uploads/...` URL is what the Hero resolves absolute against `CMS_URL` (AC 1). Leave the CMS running for Task 4.2.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-e2e.mjs
git commit -m "test(e2e): reproducible seed — page with hero+image and custom callout"
```

---

### Task 4.2: e2e render check (AC 1)

Build + start `apps/web`, fetch the rendered HTML, assert both blocks' content and the absolute image src.

**Files:**
- Create: `scripts/e2e-check.mjs`

- [ ] **Step 1: Write the e2e check**

Create `scripts/e2e-check.mjs`:

```js
// scripts/e2e-check.mjs — Spec §7 AC1: end-to-end render check.
// Assumes the CMS is running on :1337 and seeded (scripts/seed-e2e.mjs).
// Builds + starts apps/web, fetches the rendered HTML for /home, asserts both
// blocks render server-side and the hero image src is absolute against CMS_URL.
import { execSync, spawn } from 'node:child_process';

const WEB_URL = 'http://localhost:3000/home';
const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

const sh = (cmd) => execSync(cmd, { stdio: 'inherit' });

const fail = (msg) => { console.error('E2E FAIL:', msg); process.exit(1); };

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

async function main() {
  console.log('> build web');
  sh('pnpm --filter web build');

  console.log('> start web');
  const web = spawn('pnpm', ['--filter', 'web', 'start'], { stdio: 'inherit' });

  try {
    const html = await waitFor(WEB_URL);
    if (html === null) fail('web did not serve /home');

    // Both blocks present as server-rendered HTML.
    if (!html.includes('Hello from press')) fail('hero heading missing from HTML');
    if (!html.includes('Adopter callout renders via the Project-zone block map')) fail('callout message missing from HTML');

    // Hero image src resolved ABSOLUTE against the CMS base (media crosses contract).
    const m = html.match(/<img[^>]*src="([^"]+)"/);
    if (!m) fail('hero <img> not rendered');
    if (!m[1].startsWith(`${CMS_URL}/uploads/`)) fail(`image src not absolute against CMS base: ${m[1]}`);

    console.log('E2E PASS: hero + callout server-rendered; image src =', m[1]);
  } finally {
    web.kill();
  }
}

main().catch((e) => fail(e.message ?? String(e)));
```

- [ ] **Step 2: Run the e2e check (CMS still running from Task 4.1)**

Run: `node scripts/e2e-check.mjs`
Expected (final line):
```
E2E PASS: hero + callout server-rendered; image src = http://localhost:1337/uploads/hero_<hash>.png
```
This is **AC 1**.

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e-check.mjs
git commit -m "test(e2e): AC1 end-to-end render check (hero+image + callout, absolute media src)"
```

---

### Task 4.3: Custom-block contract — removing the map entry isolates the callout (AC 5)

Prove the engine never names the adopter's block: drop `custom.callout` from `press.blocks.ts` and confirm only the callout disappears (hero + engine unaffected), then restore.

**Files:** temporary edit to `apps/web/press.blocks.ts` (reverted in this task).

- [ ] **Step 1: Temporarily empty the custom map**

Edit `apps/web/press.blocks.ts` so `customBlocks` is `{}`:

```ts
import type { ComponentType } from 'react';
// import { Callout } from './blocks/custom/Callout';

export const customBlocks: Record<string, ComponentType<any>> = {};
```

- [ ] **Step 2: Rebuild + re-fetch, asserting only the callout fell back**

With the CMS running (restart it if needed, per Task 4.1 Step 3):

```bash
pnpm --filter web build
( pnpm --filter web start > /tmp/press-web.log 2>&1 & echo $! > /tmp/press-web.pid )
for i in $(seq 1 60); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/home || true); [ "$c" = "200" ] && break; sleep 2; done
curl -s http://localhost:3000/home | node -e "const h=require('fs').readFileSync(0,'utf8'); const hero=h.includes('Hello from press'); const callout=h.includes('Adopter callout renders'); console.log('hero present:', hero); console.log('callout present:', callout); process.exit(hero && !callout ? 0 : 1);"
kill "$(cat /tmp/press-web.pid)" 2>/dev/null; rm -f /tmp/press-web.pid
```
Expected:
```
hero present: true
callout present: false
```
(exit 0). The engine's `press.hero` still renders; only the unmapped `custom.callout` falls back to nothing — **AC 5**.

- [ ] **Step 3: Restore `press.blocks.ts`**

Revert `apps/web/press.blocks.ts` to the Task 3.2 version (re-import `Callout`, map `'custom.callout': Callout`).

Run: `git diff --stat apps/web/press.blocks.ts`
Expected: empty (file restored to committed state).

- [ ] **Step 4: Stop the CMS**

```bash
kill "$(cat /tmp/press-cms.pid)" 2>/dev/null; rm -f /tmp/press-cms.pid
```

> No commit — this task is a verification; the file is restored to its committed state.

---

## Phase 5 — Remaining acceptance criteria, docs, and results

### Task 5.1: Schema-change propagation — additive + destructive (AC 3)

Two required cases. **(a) additive:** add an optional field → re-sync → `tsc` still passes. **(b) destructive:** remove a field a consumer uses → re-sync → `tsc` fails at the consumer site. Both are reverted after.

**Files:** temporary edits to engine + host, all reverted in this task.

- [ ] **Step 1: (a) Additive — add an optional `eyebrow` to the hero schema**

Edit `packages/press-cms/server/src/components/hero.json`, adding to `attributes` (after `ctaLabel`):

```json
    "eyebrow": { "type": "string" },
```

- [ ] **Step 2: Rebuild + republish + update the engine, then re-sync**

```bash
# bump to a throwaway prerelease so the host can update to it
node -e "const f='packages/press-cms/package.json';const p=require('./'+f);p.version='0.3.1';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
pnpm --filter @press/cms build
( cd packages/press-cms && npm publish --registry http://localhost:4873 --userconfig "$PWD/../../.npmrc" )
pnpm --filter cms update @press/cms@0.3.1
pnpm --filter cms build
( pnpm --filter cms start > /tmp/press-cms-boot.log 2>&1 & echo $! > /tmp/press-cms.pid )
for i in $(seq 1 60); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health || true); [ "$c" = "204" ] && break; sleep 2; done
pnpm --filter @press/web sync-types
```

- [ ] **Step 3: Assert the additive field propagated and tsc still passes**

```bash
grep "eyebrow" packages/press-web/src/types/generated.ts
pnpm --filter @press/web typecheck && pnpm --filter web typecheck
```
Expected: grep shows `eyebrow?: string;`; both typechecks PASS. This is **AC 3(a)**.

- [ ] **Step 4: (b) Destructive — remove `variant` from the custom callout schema**

Edit `apps/cms/src/components/custom/callout.json`, deleting the `variant` line so `attributes` is only `message`. (This is a Project-zone CMS edit; the consumer `apps/web/blocks/custom/Callout.tsx` uses `variant`.)

- [ ] **Step 5: Rebuild host, re-sync, and assert tsc FAILS at the consumer**

```bash
kill "$(cat /tmp/press-cms.pid)" 2>/dev/null
pnpm --filter cms build
( pnpm --filter cms start > /tmp/press-cms-boot.log 2>&1 & echo $! > /tmp/press-cms.pid )
for i in $(seq 1 60); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health || true); [ "$c" = "204" ] && break; sleep 2; done
pnpm --filter @press/web sync-types
pnpm --filter web typecheck; echo "exit=$?"
```
Expected: `tsc` **fails** with an error at `apps/web/blocks/custom/Callout.tsx` (property `variant` does not exist on `CustomCallout`), `exit=2`. The **loud failure is the pass condition** — **AC 3(b)**.

- [ ] **Step 6: Revert everything from this task**

```bash
kill "$(cat /tmp/press-cms.pid)" 2>/dev/null; rm -f /tmp/press-cms.pid
git checkout -- packages/press-cms/server/src/components/hero.json packages/press-cms/package.json apps/cms/src/components/custom/callout.json
```
Then restore the engine the host actually consumes (rebuild/republish `0.3.0` is unnecessary since `0.3.0` is still in Verdaccio; just pin the host back):

```bash
pnpm --filter cms update @press/cms@0.3.0
git checkout -- apps/cms/package.json pnpm-lock.yaml   # if the pin/lock changed
```
Run: `git status --porcelain`
Expected: empty (all AC3 experiment edits reverted).

> No commit — AC 3 is a verification of behavior, not a code change.

---

### Task 5.2: Project-zone cleanliness (AC 4)

Type-sync must write **nothing** into `apps/web`; generated types live only in the engine zone.

**Files:** none.

- [ ] **Step 1: Clean tree, boot CMS, sync, check git status**

```bash
git status --porcelain   # must be empty before we start
( pnpm --filter cms start > /tmp/press-cms-boot.log 2>&1 & echo $! > /tmp/press-cms.pid )
for i in $(seq 1 60); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health || true); [ "$c" = "204" ] && break; sleep 2; done
pnpm --filter @press/web sync-types
git status --porcelain
kill "$(cat /tmp/press-cms.pid)" 2>/dev/null; rm -f /tmp/press-cms.pid
```
Expected: the **second** `git status --porcelain` is **empty** — `generated.ts` is gitignored in the engine zone and nothing landed under `apps/web/`. This is **AC 4**.

> No commit — verification only.

---

### Task 5.3: README run section, spec Results, and final commit

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-06-11-press-web-type-sync-design.md` (§11 Results)

- [ ] **Step 1: Add a Spec 1 run section to `README.md`**

Append to `README.md`:

```markdown
## Run the web engine + type-sync (Spec 1)

Prereqs: engine published (`@press/cms@0.3.0`) and the host built (see "Run the
spike"). `apps/web/.env` holds `CMS_URL=http://localhost:1337` (gitignored).

```bash
# 1. Seed a page (hero+image + custom callout) — CMS must be STOPPED for this:
( cd apps/cms && node ../../scripts/seed-e2e.mjs )

# 2. Start the CMS:
pnpm --filter cms start            # http://localhost:1337

# 3. Sync CMS schema → @press/web types (engine zone, gitignored):
pnpm --filter @press/web sync-types

# 4. Typecheck the contract (AC2):
pnpm --filter @press/web typecheck && pnpm --filter web typecheck

# 5. End-to-end render (AC1) — builds + starts apps/web on :3000, asserts both
#    blocks render server-side and the hero image src is absolute against CMS_URL:
node scripts/e2e-check.mjs
#    → "E2E PASS: hero + callout server-rendered; image src = http://localhost:1337/uploads/..."
```

Contract surfaces (all engine-owned): `GET /api/pages`, `GET /api/pages/:slug`
(published-only, DZ-populated), `GET /api/press/schema` (type-sync source of truth).
```

- [ ] **Step 2: Fill in §11 Results in the spec**

Replace the §11 placeholder in `docs/superpowers/specs/2026-06-11-press-web-type-sync-design.md` with a concise results record:

```markdown
## 11. Results

**Outcome: PASS.** All §7 acceptance criteria met.

- **AC1 (e2e render):** `scripts/e2e-check.mjs` → both `press.hero` (with image)
  and `custom.callout` render as server-rendered HTML; hero image `src` resolved
  absolute against `CMS_URL` (`/uploads/...` → `http://localhost:1337/uploads/...`).
- **AC2 (type-sync fidelity):** `sync-types` then `tsc --noEmit` on `@press/web`
  and `apps/web` passes; `getPage`/`BlockRenderer` props typed, incl. `custom.callout`.
- **AC3 (propagation):** additive `eyebrow` re-syncs, tsc passes; destructive
  removal of `custom.callout.variant` makes tsc fail at `apps/web/blocks/custom/Callout.tsx`.
- **AC4 (Project-zone cleanliness):** `git status` empty after sync — `generated.ts`
  is gitignored in the engine zone; nothing written under `apps/web/`.
- **AC5 (custom-block contract):** emptying `press.blocks.ts` drops only the
  callout; `press.hero` and the engine are unaffected — the engine never names
  the adopter's block.

**Contract surfaces shipped (engine-owned):** REST `page` route (`/api/pages[/:slug]`,
published-only, DZ-populated, `auth:false`), `/api/press/schema` (runtime registry
view), and the existing `custom.*` admission. `@press/web` (`BlockRenderer`, `Hero`,
`getPage`, `sync-types`) consumed by `apps/web` via `workspace:*`.

**Key mechanics learned:** `config.auth:false` makes the routes public with zero
users-permissions seeding; DZ media populates via the per-component `on` map with
`populate:'*'`; `getPage` runs in an RSC so the data fetch has no browser-CORS
surface; the `workspace:` protocol symlinks `@press/web` despite `.npmrc`'s
registry routing. Published-`@press/web` type delivery remains deferred to Spec 4/5.
```

- [ ] **Step 3: Confirm the full unit-test suite is green**

```bash
pnpm --filter @press/cms test && pnpm --filter @press/web test
```
Expected: all PASS.

- [ ] **Step 4: Final commit**

```bash
git add README.md docs/superpowers/specs/2026-06-11-press-web-type-sync-design.md
git commit -m "docs(spec): Spec 1 run guide + Results — @press/web + type-sync PASS"
```

---

## Self-review notes (coverage map)

- **Spec §5.1 (REST page route + DZ populate, published-only + 404, media):** Tasks 1.2 (`buildBodyPopulate`), 1.3 (`page` controller + routes), 1.4 (curl 404/200), 4.1 (image populated).
- **Spec §5.2 (`/press/schema` runtime view):** Tasks 1.2 (`serializeSchema`), 1.3 (`schema` controller/route), 1.4 (curl verify).
- **Spec §5.3 (BlockRenderer + explicit map, tolerant fallback, SSR):** Tasks 2.4 (`BlockRenderer`/`Hero`/`referenceBlocks`), 3.2 (`customBlocks`, route), 4.3 (fallback isolation).
- **Spec §6 (type-sync flow, gitignored engine-zone output):** Tasks 2.2–2.3 (generator + bin), 3.3 (first sync + tsc), 2.1 (`.gitignore`).
- **Spec §7 AC1–AC5:** AC1 → 4.2; AC2 → 3.3; AC3 → 5.1; AC4 → 5.2; AC5 → 4.3.
- **Spec §8 (DoD: committed packages, surfaces exist, documented run):** Tasks across phases + 5.3 (README/Results).
- **Spec §10 risks:** generator-vs-wire-shape mismatch mitigated by real-runtime e2e (4.1–4.2) + thorough generator unit tests (2.2); `auth:false` avoids the admin-surface leak; client-component support is structural (BlockRenderer accepts any `ComponentType`).
- **Out of scope (Spec §9) — intentionally absent:** web-side `pnpm update` proof (Spec 4), whitelabel config (Spec 2), CLI orchestration (Spec 3), real deploy (Spec 5).
```