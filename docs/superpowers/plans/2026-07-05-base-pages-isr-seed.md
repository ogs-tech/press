# BASE/PAGES — ISR intact + generic seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore ISR on the catch-all page route, ship a generic idempotent `seedPage()` API, remove the bespoke privacy-policy seed, and reduce `<head>` metadata to `<title>` + favicon (everything else deferred to a future Plugin/SEO).

**Architecture:** Two independent engine patches that ship together. `press-web` — swap `getPage`'s `cache:'no-store'` for `next:{revalidate:60}` (a single no-store fetch forces the whole route dynamic; the cached fetch makes it ISR-eligible), align route/build comments, and strip `buildMetadata` down to title + favicon. `press-cms` — extract the idempotent seed pattern into a generic `seedPage({slug,title,body,flagKey})`, delete `seedPrivacyPolicyPage` + its bootstrap call, and drop the still-pending privacy changeset.

**Tech Stack:** TypeScript, Next.js 15 App Router (RSC + ISR), Strapi 5 plugin (Document Service + plugin-store), vitest, changesets, pnpm workspaces.

## Global Constraints

- **Node 20.x, pnpm 10.x** — run everything from the repo root.
- **Quality gate is typecheck + tests** (there is no eslint): `pnpm -r --if-present typecheck` and `pnpm -r test`.
- **ISR revalidate window = `60`** everywhere (mirrors `getSiteConfig`). Never a different number, never `no-store` on a render-path fetch.
- **Metadata depth in this item = `<title>` + favicon only.** No `description`, `openGraph`, `alternates`/canonical, OG image, Twitter, robots, JSON-LD, `metadataBase`. All deferred to Plugin/SEO.
- **Do NOT add per-page SEO/social fields** to the `page` schema, and do **not** touch `preset-config.seo` or `mapSiteSettings` — `ResolvedPressConfig.seo.defaultDescription`/`defaultOgImage` simply go unconsumed.
- **`seedPage()` has no base consumer yet** — it is exported-but-unused API until Plugin/Legal / archetypes consume it. Do not invent a caller.
- **Never hand-edit `apps/playground/.press/web/**`** — it is engine-owned and regenerated. Edit only `packages/web/templates/host/**` source.
- **All code, comments, identifiers in English.**
- **Changesets required** for every engine change (`.changeset/`).
- **Do not `git push`, publish, or run `changeset publish`** — this plan ends at a committed, green working tree plus a drafted roadmap card the user pastes into Zoho manually.

---

## File Structure

**`packages/web` (press-web) — ISR + metadata:**
- Modify: `src/get-page.ts` — the one-line ISR fix + `RevalidateInit` type + rewritten header comment.
- Create: `src/get-page.test.ts` — new unit test asserting the ISR revalidate option + 404→null.
- Modify: `templates/host/app/[[...slug]]/page.tsx` — add `export const revalidate = 60` segment default (source template only).
- Modify: `src/commands/build.ts` — replace the stale `cache:'no-store' (dynamic RSC, never stale)` comment with the ISR statement.
- Modify: `src/config/build-metadata.ts` — reduce to title + favicon.
- Modify: `src/config/build-metadata.test.ts` — rewrite to the title-only shape.

**`packages/cms` (press-cms) — generic seed:**
- Create: `server/src/lib/seed-page.ts` — generic `seedPage()` + relocated `PAGE_UID`.
- Create: `server/src/lib/seed-page.test.ts` — generic idempotency tests.
- Delete: `server/src/lib/seed-page-privacy-policy.ts` and `server/src/lib/seed-page-privacy-policy.test.ts`.
- Modify: `server/src/bootstrap.ts` — drop the privacy import + call.

**Repo root — release:**
- Delete: `.changeset/privacy-policy-page-seed.md` (unshipped feature being retracted pre-release).
- Create: `.changeset/base-pages-isr-seed.md` (new).

**Reconnaissance already confirmed (do not re-litigate):**
- No production code imports `PAGE_UID` from the seed file. `generate.ts`, `serialize-schema.ts`, `controllers/page.ts`, and `inject-components.test.ts` each declare their **own** local `const PAGE_UID` copy. The only importer of the seed file's `PAGE_UID` is its own (deleted) test. → **No repointing of other files is required.**
- The cookie-consent `privacyPolicyHref` tests (`map-cookie-consent.test.ts`, `cookie-consent-banner.test.tsx`) pass `privacyPage:{slug:'privacy-policy'}` as their **own fixture input** and depend on the Site Settings `privacyPage` relation, **not** on the seed. → Removing the seed does not touch them.
- `getPage` has **no** existing test today; Task 1 adds the first one.
- `buildMetadata` has exactly two callers, both in `templates/host/**`: `[[...slug]]/page.tsx` (passes `{ title: page.title }`) and `layout.tsx` (passes `null`). Both stay compatible with the reduced signature — no route/layout code change needed for the metadata reduction.

---

### Task 1: ISR intact — `getPage` cached fetch + route/build alignment (`press-web`)

**Files:**
- Modify: `packages/web/src/get-page.ts:9-14`
- Create: `packages/web/src/get-page.test.ts`
- Modify: `packages/web/templates/host/app/[[...slug]]/page.tsx:1-18` (add a segment export)
- Modify: `packages/web/src/commands/build.ts:10-18`

**Interfaces:**
- Consumes: `mapPage(raw: RawPage): Page` and `type RawPage` from `./map-page` (unchanged); the `RevalidateInit` pattern proven in `get-site-config.ts`.
- Produces: `getPage(slug: string): Promise<Page | null>` — **same signature**, now fetching with `{ next: { revalidate: 60 } }`. The route gains `export const revalidate = 60`.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/get-page.test.ts`. Model it on `get-site-config.test.ts` (global-fetch stub). Assert the ISR option is passed and 404→null / 200→mapped:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPage } from './get-page';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: (...args: any[]) => Promise<any>) {
  const mock = vi.fn(impl);
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('getPage', () => {
  it('fetches the page with the ISR revalidate option — never no-store (ISR intact)', async () => {
    const mock = stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: null }),
    }));
    await getPage('home');
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/api/pages/home'),
      { next: { revalidate: 60 } },
    );
  });

  it('returns null for a 404 (missing/unpublished slug → notFound in the route)', async () => {
    stubFetch(async () => ({ ok: false, status: 404, json: async () => ({ data: null }) }));
    expect(await getPage('nope')).toBeNull();
  });

  it('maps a 200 body through mapPage, attaching the canonical urn', async () => {
    const raw = {
      id: 1,
      documentId: 'doc-abc',
      title: 'Home',
      slug: 'home',
      body: [{ __component: 'preset-atom.paragraph', id: 3 }],
    };
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ data: raw }) }));
    const page = await getPage('home');
    expect(page).toEqual({ ...raw, urn: 'urn:page:doc-abc' });
  });

  it('throws on a non-404 error status', async () => {
    stubFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    await expect(getPage('boom')).rejects.toThrow('getPage("boom") failed: 500');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/get-page.test.ts`
Expected: FAIL — the first test fails because `getPage` currently calls `fetch(..., { cache: 'no-store' })`, not `{ next: { revalidate: 60 } }`.

- [ ] **Step 3: Apply the ISR fix in `get-page.ts`**

Replace the header comment (lines 6-12) and the fetch call (line 14). New `packages/web/src/get-page.ts`:

```ts
import type { Page } from './types/base';
import { mapPage, type RawPage } from './map-page';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

// Next.js augments RequestInit with `next.revalidate` at the host; the engine
// package typechecks with only @types/node, so name the option locally.
type RevalidateInit = RequestInit & { next?: { revalidate?: number } };

/**
 * Fetches a PUBLISHED page by slug over REST (Spec §5.1). Runs server-side (RSC),
 * so there is no browser CORS surface for the data fetch. A missing/unpublished
 * slug yields the engine's 404 → returns null, which the route turns into
 * notFound(). ISR-cached (`revalidate: 60`, mirroring getSiteConfig): a cached
 * fetch keeps the route eligible for static generation + ISR instead of forcing
 * it dynamic per request. The route declares no generateStaticParams, so the
 * build never touches a live CMS — pages render on-demand and cache.
 * Thin fetcher: identity attachment lives in mapPage (canonical-urn Spec §2).
 */
export async function getPage(slug: string): Promise<Page | null> {
  const init: RevalidateInit = { next: { revalidate: 60 } };
  const res = await fetch(`${CMS_URL}/api/pages/${encodeURIComponent(slug)}`, init);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getPage("${slug}") failed: ${res.status}`);
  const json = (await res.json()) as { data: RawPage | null };
  return json.data ? mapPage(json.data) : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/get-page.test.ts`
Expected: PASS — all four tests green.

- [ ] **Step 5: Add the segment revalidate default to the route template**

In `packages/web/templates/host/app/[[...slug]]/page.tsx`, add an explicit segment default right after the imports (after line 4, before `interface PageProps`). This documents the ISR intent at the route boundary and is a belt-and-suspenders default alongside the fetch-level `revalidate`:

```tsx
// ISR: the route is statically generated on first hit and revalidated every 60s
// (mirrors getPage/getSiteConfig). No generateStaticParams → the build never
// calls a live CMS; dynamicParams stays at its default (true) so any slug renders
// on-demand. /home → / and notFound() run inside the render, unchanged under ISR.
export const revalidate = 60;
```

- [ ] **Step 6: Fix the stale ISR comment in `build.ts`**

In `packages/web/src/commands/build.ts`, replace the last two sentences of the doc-comment (lines 15-17, `At runtime the route fetches with cache:'no-store' (dynamic RSC, never stale).`) so it reads:

```ts
 * required to build. At runtime the route fetches ISR-cached (revalidate: 60):
 * pages render on-demand on first hit and revalidate every 60s (not forced
 * dynamic, not stale beyond the window).
```

- [ ] **Step 7: Typecheck web + run the full web suite**

Run: `pnpm --filter @ogs-tech/press-web --if-present typecheck && pnpm --filter @ogs-tech/press-web test`
Expected: typecheck clean; all web tests PASS (the new `get-page.test.ts` included).

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/get-page.ts packages/web/src/get-page.test.ts \
  packages/web/templates/host/app/'[[...slug]]'/page.tsx packages/web/src/commands/build.ts
git commit -m "fix(web): restore ISR on the page route (getPage revalidate:60, not no-store)"
```

---

### Task 2: Metadata reduced to `<title>` + favicon (`press-web`)

**Files:**
- Modify: `packages/web/src/config/build-metadata.test.ts` (rewrite)
- Modify: `packages/web/src/config/build-metadata.ts:4-35`

**Interfaces:**
- Consumes: `ResolvedPressConfig` (`brand.name`, `brand.favicon`, `seo.titleTemplate`, `seo.defaultTitle`) from `./types` — unchanged shape; `seo.defaultDescription`/`defaultOgImage` intentionally go unconsumed.
- Produces: `buildMetadata(resolved: ResolvedPressConfig, page: PageMeta): Metadata` where `type PageMeta = { title?: string } | null`. The returned `Metadata` has **only** `title` and (when `brand.favicon` is set) `icons`. No `description`, `openGraph`, `alternates`.

- [ ] **Step 1: Rewrite the test to the title-only shape (failing)**

Replace the body of `packages/web/src/config/build-metadata.test.ts` — keep the imports and `resolved` fixture (lines 1-29) exactly as they are, and replace the `describe(...)` block (lines 31-71) with:

```ts
describe('buildMetadata', () => {
  it('applies the title template to a page title (AC1)', () => {
    const m = buildMetadata(resolved, { title: 'E2E Home' });
    expect(m.title).toBe('E2E Home | Acme');
  });

  it('uses defaultTitle when there is no page (layout base)', () => {
    const m = buildMetadata(resolved, null);
    expect(m.title).toBe('Acme');
  });

  it('derives the favicon icon from brand.favicon (AC2)', () => {
    const m = buildMetadata(resolved, null);
    expect(m.icons).toEqual({ icon: '/favicon.ico' });
  });

  it('omits the favicon when brand.favicon is empty', () => {
    const noFavicon: ResolvedPressConfig = { ...resolved, brand: { ...resolved.brand, favicon: '' } };
    const m = buildMetadata(noFavicon, null);
    expect(m.icons).toBeUndefined();
  });

  it('emits no SEO/social metadata — deferred to Plugin/SEO', () => {
    const m = buildMetadata(resolved, { title: 'E2E Home' });
    expect(m.description).toBeUndefined();
    expect(m.openGraph).toBeUndefined();
    expect(m.alternates).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/config/build-metadata.test.ts`
Expected: FAIL — `emits no SEO/social metadata` fails because the current `buildMetadata` still returns `description`, `openGraph`, and `alternates`.

- [ ] **Step 3: Reduce `build-metadata.ts`**

Replace the whole of `packages/web/src/config/build-metadata.ts` with:

```ts
import type { Metadata } from 'next';
import type { ResolvedPressConfig } from './types';

type PageMeta = { title?: string } | null;

/**
 * Produces a minimal Next `Metadata` object: `<title>` + favicon only. With a
 * `page`, the title is `seo.titleTemplate` with `%s` replaced by the page title;
 * with no page (the layout base) it is `seo.defaultTitle`. The title is a plain
 * string (not Next's template object) so the rendered `<title>` is deterministic
 * and directly assertable. The favicon is identity, not SEO, so it stays.
 *
 * Everything else — description, canonical, Open Graph, Twitter, robots, JSON-LD —
 * is deferred to Plugin/SEO (see the BASE/PAGES design). `ResolvedPressConfig.seo`
 * keeps `defaultDescription`/`defaultOgImage`; they simply go unconsumed here
 * until that plugin ships. Pure — no I/O.
 */
export function buildMetadata(resolved: ResolvedPressConfig, page: PageMeta): Metadata {
  const { brand, seo } = resolved;
  const title = page?.title ? seo.titleTemplate.replace('%s', page.title) : seo.defaultTitle;
  return {
    title,
    ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/config/build-metadata.test.ts`
Expected: PASS — all five tests green.

- [ ] **Step 5: Typecheck web (callers still compile)**

Run: `pnpm --filter @ogs-tech/press-web --if-present typecheck`
Expected: clean. `page.tsx` passes `{ title: page.title }` (assignable to `{ title?: string }`) and `layout.tsx` passes `null` — both compile against the narrowed `PageMeta`.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/config/build-metadata.ts packages/web/src/config/build-metadata.test.ts
git commit -m "feat(web)!: reduce page metadata to <title> + favicon (SEO/social → Plugin/SEO)"
```

---

### Task 3: Generic `seedPage()` + relocated `PAGE_UID` (`press-cms`)

**Files:**
- Create: `packages/cms/server/src/lib/seed-page.ts`
- Create: `packages/cms/server/src/lib/seed-page.test.ts`

**Interfaces:**
- Consumes: `pluginStore(strapi)` from `./plugin-store` (returns `{ get({key}), set({key,value}) }`); `strapi.documents(uid)` Document Service (`findFirst`, `create`).
- Produces:
  - `export const PAGE_UID = 'plugin::press-cms.page'`
  - `export async function seedPage(strapi: Core.Strapi, opts: { slug: string; title: string; body: unknown[]; flagKey: string }): Promise<void>`
  Behavior: flag-first (set → no-op), slug-collision → adopter wins (no write, flag still set), otherwise create a DRAFT (`documents.create` without publish) then set the flag.

- [ ] **Step 1: Write the failing test**

Create `packages/cms/server/src/lib/seed-page.test.ts`. Adapt the fake-Strapi harness from the (about-to-be-deleted) privacy test, but generic — the fixture drives `slug`/`flagKey`:

```ts
import { describe, expect, it } from 'vitest';
import { PAGE_UID, seedPage } from './seed-page';

const OPTS = {
  slug: 'demo',
  title: 'Demo',
  flagKey: 'demoPageSeeded',
  body: [{ __component: 'preset-atom.paragraph', content: [] }],
};

/**
 * Minimal Document-Service + plugin-store fake: a mutable page list keyed by
 * slug, recording creates, and a Map-backed store for the run-once flag.
 */
function fakeStrapi(pages: any[] = [], flags: Record<string, unknown> = {}) {
  const creates: Array<{ data: any }> = [];
  const store = new Map<string, unknown>(Object.entries(flags));
  const strapi = {
    documents: (uid: string) => {
      expect(uid).toBe(PAGE_UID); // helper must target the page collection UID
      return {
        findFirst: async (params: any) => {
          // The seed must look up by the requested slug — never a broad match.
          expect(params?.filters).toMatchObject({ slug: OPTS.slug });
          return pages.find((page) => page.slug === OPTS.slug) ?? null;
        },
        create: async (params: { data: any }) => {
          creates.push(params);
          pages.push({ documentId: `doc-${pages.length + 1}`, ...params.data });
          return pages[pages.length - 1];
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
  return { strapi, creates, store };
}

describe('seedPage — generic idempotent page seed', () => {
  it('creates the page as a DRAFT on a fresh DB and marks the flag done', async () => {
    const { strapi, creates, store } = fakeStrapi();
    await seedPage(strapi, OPTS);
    expect(creates).toEqual([{ data: { title: OPTS.title, slug: OPTS.slug, body: OPTS.body } }]);
    // DRAFT: create carries no publish signal for an editor to review first.
    expect(creates[0].data).not.toHaveProperty('publishedAt');
    expect(creates[0].data).not.toHaveProperty('status');
    expect(store.get('demoPageSeeded')).toBe(true);
  });

  it('respects an adopter page already on the slug — no create, flag still set', async () => {
    const { strapi, creates, store } = fakeStrapi([{ documentId: 'doc-9', slug: 'demo' }]);
    await seedPage(strapi, OPTS);
    expect(creates).toEqual([]);
    expect(store.get('demoPageSeeded')).toBe(true);
  });

  it('is a no-op once the flag is set — editor-deleted page respected forever', async () => {
    const { strapi, creates } = fakeStrapi([], { demoPageSeeded: true });
    await seedPage(strapi, OPTS);
    expect(creates).toEqual([]);
  });

  it('is idempotent across repeated runs — one create, no later writes', async () => {
    const { strapi, creates } = fakeStrapi();
    await seedPage(strapi, OPTS);
    await seedPage(strapi, OPTS);
    await seedPage(strapi, OPTS);
    expect(creates).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-cms exec vitest run server/src/lib/seed-page.test.ts`
Expected: FAIL — `Cannot find module './seed-page'` (the module does not exist yet).

> Note: cms has no vitest config; its `test` script runs vitest with defaults. Invoke a single file via `exec vitest run <path>` as above. If that errors on config, fall back to `pnpm --filter @ogs-tech/press-cms test` (runs the whole cms suite).

- [ ] **Step 3: Create `seed-page.ts`**

Create `packages/cms/server/src/lib/seed-page.ts`:

```ts
import type { Core } from '@strapi/strapi';
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
  opts: { slug: string; title: string; body: unknown[]; flagKey: string },
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-cms exec vitest run server/src/lib/seed-page.test.ts`
Expected: PASS — all four tests green.

- [ ] **Step 5: Typecheck the cms backend**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: clean (this runs Strapi backend `tsc`; the new file must compile).

- [ ] **Step 6: Commit**

```bash
git add packages/cms/server/src/lib/seed-page.ts packages/cms/server/src/lib/seed-page.test.ts
git commit -m "feat(cms): add generic idempotent seedPage() (slug/title/body/flagKey)"
```

---

### Task 4: Remove privacy-policy seeding from base (`press-cms`)

**Files:**
- Delete: `packages/cms/server/src/lib/seed-page-privacy-policy.ts`
- Delete: `packages/cms/server/src/lib/seed-page-privacy-policy.test.ts`
- Modify: `packages/cms/server/src/bootstrap.ts:1-14`
- Delete: `.changeset/privacy-policy-page-seed.md`

**Interfaces:**
- Consumes: nothing new. After this task `bootstrap` seeds only site-setting + cookie-consent.
- Produces: `bootstrap` no longer references `seedPrivacyPolicyPage`/`seed-page-privacy-policy`; no code path seeds a privacy page.

- [ ] **Step 1: Delete the privacy seed module and its test**

```bash
git rm packages/cms/server/src/lib/seed-page-privacy-policy.ts \
       packages/cms/server/src/lib/seed-page-privacy-policy.test.ts
```

- [ ] **Step 2: Remove the import + call from `bootstrap.ts`**

Rewrite `packages/cms/server/src/bootstrap.ts` to:

```ts
import type { Core } from '@strapi/strapi';
import { seedSiteSetting } from './lib/seed-site-setting';
import { seedCookieConsent } from './lib/seed-cookie-consent';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  await seedSiteSetting(strapi);
  // Order matters: seedCookieConsent updates the record seedSiteSetting creates
  // (and self-heals — without marking its flag — if the record is absent).
  await seedCookieConsent(strapi);
};

export default bootstrap;
```

- [ ] **Step 3: Delete the stale pending changeset**

The privacy seed was never published (cms is at 0.3.2; this changeset only ever bumped it). Retract it pre-release rather than shipping add-then-revert:

```bash
git rm .changeset/privacy-policy-page-seed.md
```

- [ ] **Step 4: Verify nothing still references the deleted symbols**

Run: `grep -rn "seedPrivacyPolicyPage\|seed-page-privacy-policy\|PRIVACY_PAGE\|privacyPageSeeded" packages --include="*.ts"`
Expected: **no matches.** (The `privacyPage` *relation* references in `map-cookie-consent*`, `site-setting.ts`, `types.ts` are a different concept — the Site Settings relation — and must remain. If any of the four deleted-symbol names still appear, fix that file before proceeding.)

- [ ] **Step 5: Typecheck + run the full cms suite**

Run: `pnpm --filter @ogs-tech/press-cms test:ts:back && pnpm --filter @ogs-tech/press-cms test`
Expected: typecheck clean; cms tests PASS with no reference to the removed seed. The generic `seed-page.test.ts` from Task 3 is the only page-seed test now.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(cms)!: remove privacy-policy seed from base (belongs to future Plugin/Legal)"
```

---

### Task 5: Changeset, full-gate verification, and Plugin/SEO roadmap card

**Files:**
- Create: `.changeset/base-pages-isr-seed.md`

**Interfaces:** none (release + verification wrap).

- [ ] **Step 1: Add the changeset**

Create `.changeset/base-pages-isr-seed.md`:

```markdown
---
'@ogs-tech/press-web': minor
'@ogs-tech/press-cms': minor
---

feat: BASE/PAGES foundation — ISR intact, generic page seed, metadata reduced to <title>

**press-web — ISR restored.** `getPage` now fetches ISR-cached
(`next: { revalidate: 60 }`, mirroring `getSiteConfig`) instead of
`cache: 'no-store'`. A single no-store fetch had opted the whole catch-all route
into per-request dynamic rendering; the cached fetch makes it statically
generated on first hit and revalidated every 60s. The route declares
`export const revalidate = 60` and still has no `generateStaticParams`, so the
build never calls a live CMS. `/home → /` and `notFound()` are unchanged.

**press-web — metadata reduced (behavior change).** `buildMetadata` now emits
only `<title>` (+ favicon). `description`, `openGraph`, and `alternates`
(canonical) are removed — the old canonical was always the site root, i.e. wrong
for every non-home page, so dropping it is a net improvement. All SEO/social
metadata is deferred to a future Plugin/SEO. `ResolvedPressConfig.seo` is
unchanged (`defaultDescription`/`defaultOgImage` go unconsumed for now).

**press-cms — generic seed, privacy removed.** New generic idempotent
`seedPage({ slug, title, body, flagKey })` (flag-first, slug-collision → adopter
wins, created as DRAFT) replaces the bespoke `seedPrivacyPolicyPage`. Base does
not seed a privacy-policy page anymore — that belongs to a future Plugin/Legal.
`seedPage` is exported-but-unused public API until the first consumer lands.
```

- [ ] **Step 2: Run the full repo quality gate**

Run: `pnpm -r --if-present typecheck && pnpm -r test`
Expected: every package's typecheck clean; all vitest suites (`cli`, `web`, `cms`) PASS. If any privacy-seed assertion survives elsewhere, it fails here — fix and re-run.

- [ ] **Step 3: Verify ISR end-to-end (the DONE gate)**

Drive the real app to confirm the route renders as ISR, not forced-dynamic:

```bash
pnpm dev   # boots cms :1337/admin + web :3000 (recreates apps/playground if absent)
```

Then verify manually (use `/run` or the browser):
- **Full HTML in view-source** of a CMS-created page (SSR output, not an empty shell).
- **`/home` 308-redirects to `/`** (the `permanentRedirect` still fires under ISR).
- **The page route is served ISR/static, not dynamic.** Confirm via one of: `pnpm build` output for `.press/web` marking `/[[...slug]]` as ISR (○/●, a `Revalidate` window) rather than `ƒ (Dynamic)`; or absence of a per-request `no-store`. No route-level cache-busting.

Record the observed evidence (view-source snippet, redirect status, build-output line) in the task notes. Do not claim ISR without the build-output/served-mode evidence — see superpowers:verification-before-completion.

- [ ] **Step 4: Commit the changeset**

```bash
git add .changeset/base-pages-isr-seed.md
git commit -m "chore: changeset for BASE/PAGES (ISR + generic seed + metadata reduction)"
```

- [ ] **Step 5: Hand the Plugin/SEO roadmap card to the user**

This item pulls SEO/social metadata OUT into a sibling roadmap item. There is **no MCP access to Zoho** — surface the card verbatim so the user pastes it into the CRM manually. Print exactly:

```
[OGS] [PRESS] PLUGIN / SEO

TIPO: engine plugin (família PressPlugin) — metadata de <head> para ranking + share.
DEPENDE DE: BASE/PAGES (content-type + render ISR), Base/Canonical.
HABILITA: Site OGS, i18n (hreflang per-locale).

OBJETIVO: entregar toda a metadata de <head> como plugin opt-in, em dois grupos:
- SEO (ranking/indexação): metadataBase, canonical correto por página, robots
  (noindex por página), JSON-LD (WebPage/Organization), hreflang (single-locale
  stub; full quando i18n chegar).
- Social/share (unfurl): Open Graph (og:title/description/image/url/type/site_name)
  + Twitter card — default no Site Settings, override por página.

ESCOPO:
- Campos de override SEO/social por página no page schema (componente preset-config
  dedicado ou estendendo o preset-config.seo; decidir no brainstorming do item).
- Defaults no Site Settings (reusa o preset-config.seo já existente).
- Seam de integração: mapper puro buildSeoMetadata(resolved, page) alimentando o
  generateMetadata do host — NÃO é mount de componente como o cookie-consent
  (metadata é export de route/layout no Next, não componente montado no layout.tsx).
- Fail-to-empty consistente com identity/SEO (CMS fora → metadata default, nunca crash).

DONE: página compartilhada mostra card OG/Twitter com título+imagem corretos;
canonical aponta pra própria URL da página; robots/JSON-LD presentes no view-source;
ISR permanece intacto (metadata não força a rota dynamic).
```

---

## Verification against DONE (amended)

| DONE (amended) | Task / How |
| --- | --- |
| Página renderiza SSR — HTML completo no view-source | Task 5 Step 3 (view-source on a CMS page) |
| **Rota não-dynamic / ISR intacto** | Task 1 (`getPage` `revalidate:60` + route segment) + Task 5 Step 3 (build-output served-mode) |
| `/home → /` | Task 5 Step 3 (existing `permanentRedirect`, verified under ISR) |
| `seedPage()` genérico idempotente disponível | Task 3 (unit test + exported API) |
| Privacy-policy removida do base | Task 4 (`bootstrap.ts` no longer calls it; files deleted; changeset dropped) |
| Metadata = `<title>` (resto → Plugin/SEO) | Task 2 (`buildMetadata` reduced) + Task 5 Step 5 (card D) |

## Rollout notes

- Both packages bump `minor` (pre-release 0.x): press-web (ISR + metadata reduction) and press-cms (generic seed + privacy removal). One changeset covers both (Task 5).
- Removing OG/canonical is a visible behavior change pre-Plugin/SEO — acceptable pre-release; the removed logic is captured in the Plugin/SEO card so nothing is lost.
- The two patches are independent but ship together to keep the item coherent.
- This plan stops at a committed, green working tree. It does **not** push, publish, or run `pnpm version-packages`/`changeset publish`.
