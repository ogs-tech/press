# Whitelabel `press.config.ts` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize whitelabel identity + SEO in a single root `press.config.ts`, consumed by `@press/web` through an engine-owned typed interface (`defineConfig` / `resolveConfig` / `buildMetadata`), so the contract boundary holds: the engine reads the file but never rewrites it, and a destructive change to the engine's config type fails loud at the adopter's config.

**Architecture:** `@press/web` (engine zone) gains a hand-authored static type `PressConfig`, its resolved form `ResolvedPressConfig`, and three pure helpers. The adopter authors one `press.config.ts` at the monorepo root (Project zone) via `defineConfig`. The Next host (`apps/web`) imports that file, computes `const config = resolveConfig(userConfig)` once as an immutable module constant, and passes it to `buildMetadata` in `layout.tsx` (base/no-page) and the catch-all route's `generateMetadata` (per-page). The engine never reads the file by path — the boundary is the typed function signature.

**Tech Stack:** TypeScript 5, Next 15 App Router / RSC, Node 20 LTS, pnpm 10 workspaces (hoisted linker) + Turborepo, Vitest 2.

**Spec:** `docs/superpowers/specs/2026-06-11-press-config-whitelabel-design.md`

---

## File Structure

**Engine zone — `@press/web` (`packages/press-web/`):**

- Create `src/config/types.ts` — `PressConfig` (adopter input; only `brand.name` required) and `ResolvedPressConfig` (defaults applied). The static contract surface.
- Create `src/config/define-config.ts` — `defineConfig`: runtime identity, compile-time validation + autocomplete at the adopter call site.
- Create `src/config/resolve-config.ts` — `resolveConfig`: pure function filling engine defaults.
- Create `src/config/build-metadata.ts` — `buildMetadata`: pure function producing a Next `Metadata` object.
- Create tests `src/config/define-config.test.ts`, `src/config/resolve-config.test.ts`, `src/config/build-metadata.test.ts`.
- Modify `src/index.ts` — barrel: export the three helpers + the two types.
- Modify `package.json` — add `next` as a `peerDependency` (the `Metadata` type contract).

**Project zone — root + host:**

- Create `press.config.ts` (repo root) — the single whitelabel source of truth, authored via `defineConfig`.
- Delete `apps/cms/press.config.ts` — the Spec 0 placeholder, migrated to root.
- Modify root `package.json` — add `@press/web` as a `workspace:*` devDependency so the root file resolves the engine import.
- Modify `apps/web/tsconfig.json` — add the `press.config` path alias.
- Create `apps/web/press-config.ts` — the single resolution site: `export const config = resolveConfig(userConfig)`.
- Modify `apps/web/app/layout.tsx` — `<html lang>` from `site.locale`; export base `metadata = buildMetadata(config, null)` (carries the favicon).
- Modify `apps/web/app/[...slug]/page.tsx` — `generateMetadata` returns `buildMetadata(config, page ? { title: page.title } : null)`.

**Verification:**

- Modify `scripts/e2e-check.mjs` — extend the existing `/home` render check with the SEO (AC1) + brand-identity (AC2/AC3-set) assertions.
- Modify `README.md` — add a "Run the whitelabel config (Spec 2)" section documenting the SEO-from-config render, the type guard (AC4), and the git-clean check (AC5).

---

## Task 1: Engine — config types + `defineConfig`

**Files:**
- Create: `packages/press-web/src/config/types.ts`
- Create: `packages/press-web/src/config/define-config.ts`
- Test: `packages/press-web/src/config/define-config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/press-web/src/config/define-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defineConfig } from './define-config';

describe('defineConfig', () => {
  it('returns the same config object (identity at runtime)', () => {
    const cfg = { brand: { name: 'Acme' } };
    expect(defineConfig(cfg)).toBe(cfg);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @press/web exec vitest run src/config/define-config.test.ts`
Expected: FAIL — `Cannot find module './define-config'`.

- [ ] **Step 3: Write the types**

Create `packages/press-web/src/config/types.ts`:

```ts
/**
 * Adopter-facing whitelabel input (Spec §6). Only `brand.name` is required;
 * every other field has an engine default applied by `resolveConfig`. This is a
 * STATIC engine type — hand-authored and versioned with @press/web — distinct
 * from the CMS-schema-derived generated types of Spec 1 (Spec §4.3).
 */
export interface PressConfig {
  brand: {
    name: string;
    logo?: string;
    favicon?: string;
  };
  site?: {
    url?: string;
    locale?: string;
  };
  seo?: {
    titleTemplate?: string;
    defaultTitle?: string;
    defaultDescription?: string;
    defaultOgImage?: string;
  };
}

/** Fully-resolved config: every default applied, ready for the engine helpers. */
export interface ResolvedPressConfig {
  brand: {
    name: string;
    logo?: string;
    favicon: string;
  };
  site: {
    url: string;
    locale: string;
  };
  seo: {
    titleTemplate: string;
    defaultTitle: string;
    defaultDescription: string;
    defaultOgImage?: string;
  };
}
```

- [ ] **Step 4: Write `defineConfig`**

Create `packages/press-web/src/config/define-config.ts`:

```ts
import type { PressConfig } from './types';

/**
 * Identity helper. Returns its argument unchanged at runtime; its value is at
 * compile time — it gives the adopter autocomplete and type-checking at the
 * `press.config.ts` call site, which is where a destructive change to the
 * engine's `PressConfig` type fails loud (Spec §4.2, AC4).
 */
export function defineConfig(config: PressConfig): PressConfig {
  return config;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @press/web exec vitest run src/config/define-config.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add packages/press-web/src/config/types.ts packages/press-web/src/config/define-config.ts packages/press-web/src/config/define-config.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add PressConfig types + defineConfig (Spec 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Engine — `resolveConfig`

**Files:**
- Create: `packages/press-web/src/config/resolve-config.ts`
- Test: `packages/press-web/src/config/resolve-config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/press-web/src/config/resolve-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveConfig } from './resolve-config';

describe('resolveConfig', () => {
  it('applies defaults when only brand.name is given', () => {
    const r = resolveConfig({ brand: { name: 'Acme' } });
    expect(r.seo.titleTemplate).toBe('%s'); // AC3: omitted → '%s'
    expect(r.site.locale).toBe('en');
    expect(r.brand.favicon).toBe('/favicon.ico');
    expect(r.seo.defaultTitle).toBe('Acme'); // falls back to brand.name
    expect(r.seo.defaultDescription).toBe('');
    expect(r.site.url).toBe('');
  });

  it('lets the adopter value win over the default (AC3 override)', () => {
    const r = resolveConfig({
      brand: { name: 'Acme' },
      seo: { titleTemplate: '%s | Acme' },
    });
    expect(r.seo.titleTemplate).toBe('%s | Acme');
  });

  it('resolves defaultOgImage absolute against site.url', () => {
    const r = resolveConfig({
      brand: { name: 'Acme' },
      site: { url: 'https://acme.test' },
      seo: { defaultOgImage: '/og.png' },
    });
    expect(r.seo.defaultOgImage).toBe('https://acme.test/og.png');
  });

  it('leaves defaultOgImage as-is when site.url is absent', () => {
    const r = resolveConfig({
      brand: { name: 'Acme' },
      seo: { defaultOgImage: '/og.png' },
    });
    expect(r.seo.defaultOgImage).toBe('/og.png');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @press/web exec vitest run src/config/resolve-config.test.ts`
Expected: FAIL — `Cannot find module './resolve-config'`.

- [ ] **Step 3: Write `resolveConfig`**

Create `packages/press-web/src/config/resolve-config.ts`:

```ts
import type { PressConfig, ResolvedPressConfig } from './types';

/**
 * Fills engine defaults over the adopter's PressConfig (Spec §4.2). Pure: same
 * input → same output, no I/O, no mutation — so the resolved value is safe to
 * hold as an immutable module constant under RSC/SSR (Spec §11, the Spec 1
 * lesson). Defaults: titleTemplate → '%s', locale → 'en', defaultTitle →
 * brand.name, favicon → '/favicon.ico'; defaultOgImage is resolved ABSOLUTE
 * against site.url when both are present.
 */
export function resolveConfig(config: PressConfig): ResolvedPressConfig {
  const siteUrl = config.site?.url ?? '';
  const ogImage = config.seo?.defaultOgImage;
  return {
    brand: {
      name: config.brand.name,
      logo: config.brand.logo,
      favicon: config.brand.favicon ?? '/favicon.ico',
    },
    site: {
      url: siteUrl,
      locale: config.site?.locale ?? 'en',
    },
    seo: {
      titleTemplate: config.seo?.titleTemplate ?? '%s',
      defaultTitle: config.seo?.defaultTitle ?? config.brand.name,
      defaultDescription: config.seo?.defaultDescription ?? '',
      defaultOgImage:
        ogImage && siteUrl ? new URL(ogImage, siteUrl).toString() : ogImage,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @press/web exec vitest run src/config/resolve-config.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/press-web/src/config/resolve-config.ts packages/press-web/src/config/resolve-config.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add resolveConfig with engine defaults (Spec 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Engine — `buildMetadata`

**Files:**
- Create: `packages/press-web/src/config/build-metadata.ts`
- Test: `packages/press-web/src/config/build-metadata.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/press-web/src/config/build-metadata.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveConfig } from './resolve-config';
import { buildMetadata } from './build-metadata';

const resolved = resolveConfig({
  brand: { name: 'Acme', favicon: '/favicon.ico' },
  site: { url: 'https://acme.test', locale: 'en' },
  seo: {
    titleTemplate: '%s | Acme',
    defaultTitle: 'Acme',
    defaultDescription: 'An Acme content site.',
    defaultOgImage: '/og.png',
  },
});

describe('buildMetadata', () => {
  it('applies the title template to a page title (AC1)', () => {
    const m = buildMetadata(resolved, { title: 'E2E Home' });
    expect(m.title).toBe('E2E Home | Acme');
    expect(m.openGraph?.title).toBe('E2E Home | Acme');
  });

  it('uses defaultTitle when there is no page (layout base)', () => {
    const m = buildMetadata(resolved, null);
    expect(m.title).toBe('Acme');
  });

  it('falls back to defaultDescription when the page has none', () => {
    const m = buildMetadata(resolved, { title: 'E2E Home' });
    expect(m.description).toBe('An Acme content site.');
  });

  it('emits an absolute canonical and OG image', () => {
    const m = buildMetadata(resolved, { title: 'E2E Home' });
    expect(m.alternates?.canonical).toBe('https://acme.test');
    expect(m.openGraph?.images).toEqual([{ url: 'https://acme.test/og.png' }]);
  });

  it('derives the favicon icon from brand.favicon (AC2)', () => {
    const m = buildMetadata(resolved, null);
    expect(m.icons).toEqual({ icon: '/favicon.ico' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @press/web exec vitest run src/config/build-metadata.test.ts`
Expected: FAIL — `Cannot find module './build-metadata'`.

- [ ] **Step 3: Write `buildMetadata`**

Create `packages/press-web/src/config/build-metadata.ts`:

```ts
import type { Metadata } from 'next';
import type { ResolvedPressConfig } from './types';

type PageMeta = { title?: string; description?: string } | null;

/**
 * Produces a Next `Metadata` object from the resolved config (Spec §4.2). With
 * a `page`, the title is `seo.titleTemplate` with `%s` replaced by the page
 * title; with no page (the layout base) it is `seo.defaultTitle`. The title is
 * a plain string (not Next's template object) so the rendered `<title>` is
 * deterministic and directly assertable (AC1/AC3). The OG image is already
 * absolute (resolved against `site.url` in `resolveConfig`). Pure — no I/O.
 */
export function buildMetadata(resolved: ResolvedPressConfig, page?: PageMeta): Metadata {
  const { brand, site, seo } = resolved;
  const title = page?.title
    ? seo.titleTemplate.replace('%s', page.title)
    : seo.defaultTitle;
  const description = page?.description ?? seo.defaultDescription;
  const images = seo.defaultOgImage ? [{ url: seo.defaultOgImage }] : undefined;

  return {
    title,
    description,
    ...(site.url ? { alternates: { canonical: site.url } } : {}),
    openGraph: {
      title,
      description,
      siteName: brand.name,
      ...(site.url ? { url: site.url } : {}),
      ...(images ? { images } : {}),
    },
    ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @press/web exec vitest run src/config/build-metadata.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/press-web/src/config/build-metadata.ts packages/press-web/src/config/build-metadata.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add buildMetadata producing Next Metadata (Spec 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Engine — barrel exports + `next` peer

**Files:**
- Modify: `packages/press-web/src/index.ts`
- Modify: `packages/press-web/package.json`

- [ ] **Step 1: Add the config exports to the barrel**

Replace the contents of `packages/press-web/src/index.ts` with:

```ts
export { BlockRenderer } from './block-renderer';
export { getPage } from './get-page';
export { referenceBlocks } from './reference-blocks';
export { Hero } from './blocks/hero';
export { defineConfig } from './config/define-config';
export { resolveConfig } from './config/resolve-config';
export { buildMetadata } from './config/build-metadata';
export type { Page, PageBody, PressMedia, PressHero } from './types';
export type { PressConfig, ResolvedPressConfig } from './config/types';
```

- [ ] **Step 2: Declare `next` as a peer dependency**

In `packages/press-web/package.json`, extend the existing `peerDependencies` block so it reads:

```json
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18",
    "next": ">=15"
  },
```

Rationale: `buildMetadata` returns Next's `Metadata` type, so a consumer of that helper needs a Next host. The type-only import already resolves via the hoisted root `next` (verified), so no devDependency churn is required. Trade-off: this relies on the host providing `next`; if a future isolated install ever breaks `@press/web`'s own `tsc`, add `next` to `devDependencies` too.

- [ ] **Step 3: Typecheck + full test run**

Run: `pnpm --filter @press/web typecheck && pnpm --filter @press/web test`
Expected: typecheck prints no errors; Vitest reports all suites passing (the three new config suites plus the existing generator suite).

- [ ] **Step 4: Commit**

```bash
git add packages/press-web/src/index.ts packages/press-web/package.json
git commit -m "$(cat <<'EOF'
feat(web): export config API + declare next peer (Spec 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Root `press.config.ts` + migrate the cms placeholder

**Files:**
- Create: `press.config.ts` (repo root)
- Delete: `apps/cms/press.config.ts`
- Modify: `package.json` (root) — add `@press/web` devDependency

- [ ] **Step 1: Add `@press/web` to the root devDependencies**

In the root `package.json`, add a `devDependencies` entry for the engine alongside `turbo` so the root-level `press.config.ts` can resolve the `@press/web` import:

```json
  "devDependencies": {
    "@press/web": "workspace:*",
    "turbo": "2.9.18"
  },
```

The `workspace:*` protocol links from the workspace even with `link-workspace-packages=false` (the same mechanism `apps/web` already uses), so this resolves the engine source — not the Verdaccio tarball.

- [ ] **Step 2: Install so the root symlink is created**

Run: `pnpm install`
Then verify the symlink exists:
Run: `ls -la node_modules/@press/web`
Expected: a symlink `node_modules/@press/web -> ../../packages/press-web` (path may render relative to the pnpm store, but the entry must exist).

- [ ] **Step 3: Author the root config**

Create `press.config.ts` at the repo root:

```ts
// press.config.ts — Project zone (repo root). The single whitelabel source of
// truth: identity + SEO, consumed by @press/web through defineConfig /
// resolveConfig / buildMetadata. The engine READS this file (the host imports
// it) but NEVER rewrites it — an engine update leaves it untouched (Spec §8 AC5).
import { defineConfig } from '@press/web';

export default defineConfig({
  brand: {
    name: 'Acme',
    logo: '/logo.svg',
    favicon: '/favicon.ico',
  },
  site: {
    url: 'https://acme.test',
    locale: 'en',
  },
  seo: {
    titleTemplate: '%s | Acme',
    defaultTitle: 'Acme',
    defaultDescription: 'An Acme content site.',
    defaultOgImage: '/og.png',
  },
});
```

- [ ] **Step 4: Delete the migrated cms placeholder**

Run: `git rm apps/cms/press.config.ts`
Expected: the Spec 0 placeholder is removed (no code imports it — verified by `grep -rn "press.config" --include=*.ts apps`).

- [ ] **Step 5: Verify the engine import resolves from the root**

Run: `node -e "require.resolve('@press/web/package.json'); console.log('resolved @press/web from root')"`
Expected: prints `resolved @press/web from root` (the package is reachable by node resolution from the repo root, which is what the root `press.config.ts` needs).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml press.config.ts
git rm --cached apps/cms/press.config.ts 2>/dev/null || true
git commit -m "$(cat <<'EOF'
feat: add root press.config.ts; migrate cms placeholder (Spec 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Host wiring — `apps/web` consumes the config

**Files:**
- Modify: `apps/web/tsconfig.json`
- Create: `apps/web/press-config.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/[...slug]/page.tsx`

- [ ] **Step 1: Add the `press.config` path alias**

In `apps/web/tsconfig.json`, add one entry to the existing `compilerOptions.paths` object (leave the `react`/`react-dom` pins exactly as they are):

```json
      "press.config": [
        "../../press.config.ts"
      ],
```

So the `paths` block becomes (showing the addition in context):

```json
    "paths": {
      "react": ["./node_modules/@types/react"],
      "react/*": ["./node_modules/@types/react/*"],
      "react-dom": ["./node_modules/@types/react-dom"],
      "react-dom/*": ["./node_modules/@types/react-dom/*"],
      "press.config": ["../../press.config.ts"]
    },
```

- [ ] **Step 2: Create the single resolution site**

Create `apps/web/press-config.ts`:

```ts
// apps/web/press-config.ts — Project zone. Resolves the root whitelabel config
// ONCE into an immutable module constant. Module-eval scope keeps it
// deterministic under RSC/SSR — no per-request mutation (Spec §7, §11).
import userConfig from 'press.config';
import { resolveConfig } from '@press/web';

export const config = resolveConfig(userConfig);
```

- [ ] **Step 3: Wire the layout (lang + base metadata/favicon)**

Replace the contents of `apps/web/app/layout.tsx` with:

```tsx
import { buildMetadata } from '@press/web';
import { config } from '../press-config';

// Brand defaults, no page: title = seo.defaultTitle, plus the favicon icon.
export const metadata = buildMetadata(config, null);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={config.site.locale}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Wire per-page metadata**

Replace the contents of `apps/web/app/[...slug]/page.tsx` with:

```tsx
import { notFound } from 'next/navigation';
import { BlockRenderer, buildMetadata, getPage } from '@press/web';
import { customBlocks } from '../../press.blocks';
import { config } from '../../press-config';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPage((slug ?? []).join('/') || 'home');
  return buildMetadata(config, page ? { title: page.title } : null);
}

export default async function CatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPage((slug ?? []).join('/') || 'home');
  if (!page) notFound();
  return <BlockRenderer blocks={page.body} components={customBlocks} />;
}
```

- [ ] **Step 5: Typecheck the host (this is the AC4 surface)**

Run: `pnpm --filter web typecheck`
Expected: no errors. This compiles the imported root `press.config.ts` through the alias; a green run confirms the adopter config satisfies `PressConfig`.

> **Live-gate contingency (Spec §11, risk row 1).** If `pnpm --filter web typecheck` or `next build` (Task 7) cannot resolve the `press.config` alias, add a re-export shim and import it relatively instead of via the alias: create `apps/web/press.config.ts` with `export { default } from '../../press.config';`, then change `apps/web/press-config.ts` to `import userConfig from './press.config';`. The root `press.config.ts` stays the source of truth; the shim only bridges resolution.

- [ ] **Step 6: Commit**

```bash
git add apps/web/tsconfig.json apps/web/press-config.ts apps/web/app/layout.tsx "apps/web/app/[...slug]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(web-host): consume press.config in layout + page metadata (Spec 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Extend the e2e render check (AC1 + AC2 + AC3-set)

**Files:**
- Modify: `scripts/e2e-check.mjs`

Context: the existing script builds + starts `apps/web`, fetches `/home` (seeded page title `E2E Home`), and asserts the two blocks + the absolute hero image. The root config sets `titleTemplate: '%s | Acme'`, `site.url: 'https://acme.test'`, `locale: 'en'`, `favicon: '/favicon.ico'`, `defaultDescription: 'An Acme content site.'`, `defaultOgImage: '/og.png'`. We assert those surface in the rendered `<head>`.

- [ ] **Step 1: Add the SEO + identity assertions**

In `scripts/e2e-check.mjs`, locate the block that asserts the hero image (the lines ending with `console.log('E2E PASS: hero + callout server-rendered; image src =', m[1]);`). Insert the following assertions immediately BEFORE that `console.log`, after the image `if` check:

```js
    // --- Spec 2: whitelabel config surfaces in <head> ---

    // AC1: <title> = seo.titleTemplate applied to the page title ('%s | Acme').
    // Also proves the AC3 OVERRIDE case (custom template visible in the markup).
    if (!html.includes('<title>E2E Home | Acme</title>')) {
      fail('title not templated from config (expected "<title>E2E Home | Acme</title>")');
    }

    // AC1: meta description falls back to seo.defaultDescription (page has none).
    if (!/<meta name="description" content="An Acme content site\."/.test(html)) {
      fail('meta description not from config');
    }

    // AC1: OpenGraph title mirrors the templated title.
    if (!/<meta property="og:title" content="E2E Home \| Acme"/.test(html)) {
      fail('og:title not templated from config');
    }

    // AC1: og:image ABSOLUTE, resolved against site.url.
    if (!/<meta property="og:image"[^>]*content="https:\/\/acme\.test\/og\.png"/.test(html)) {
      fail('og:image not absolute against site.url');
    }

    // AC1: canonical derived from site.url.
    if (!/<link rel="canonical" href="https:\/\/acme\.test"/.test(html)) {
      fail('canonical not from site.url');
    }

    // AC2: <html lang> equals site.locale.
    if (!/<html lang="en"/.test(html)) {
      fail('<html lang> not from site.locale');
    }

    // AC2: favicon link derives from brand.favicon.
    if (!/<link rel="icon" href="\/favicon\.ico"/.test(html)) {
      fail('favicon link not from brand.favicon');
    }

    console.log('E2E PASS (Spec 2): title/description/og/canonical/lang/favicon from config');
```

- [ ] **Step 2: Run the e2e check (live gate)**

Prereqs (per README): CMS seeded + running on `:1337`, `@press/web` types synced. Then:
Run: `node scripts/e2e-check.mjs`
Expected: the original `E2E PASS: hero + callout ...` line AND `E2E PASS (Spec 2): title/description/og/canonical/lang/favicon from config`. If a specific tag fails, inspect the served markup with `curl -s http://localhost:3000/home | grep -Ei '<title>|og:|canonical|rel="icon"|<html'` and reconcile the assertion against Next's exact emitted attribute order (the regexes match attribute prefixes, not full tags).

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e-check.mjs
git commit -m "$(cat <<'EOF'
test(e2e): assert whitelabel SEO + identity in <head> (Spec 2 AC1/AC2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Document the run — type guard (AC4), default-case (AC3), git-clean (AC5)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the Spec 2 run section**

Append the following section to the end of `README.md`:

````markdown
## Run the whitelabel config (Spec 2)

Identity + SEO live in one root `press.config.ts` (Project zone), consumed by
`@press/web` through `defineConfig` / `resolveConfig` / `buildMetadata`. Prereqs:
the CMS seeded + running on `:1337` and types synced (see "Run the web engine").

```bash
# 1. Unit contract for the engine helpers (defaults, template, absolute OG):
pnpm --filter @press/web test

# 2. Type the host — compiles the root press.config.ts through the alias (AC4 base):
pnpm --filter web typecheck

# 3. SEO-from-config render (AC1) + brand identity (AC2) on the real markup:
node scripts/e2e-check.mjs
#    → "E2E PASS (Spec 2): title/description/og/canonical/lang/favicon from config"

# 4. Default vs. override (AC3). The OVERRIDE is proven above (the rendered
#    <title> shows the custom 'E2E Home | Acme' template). The DEFAULT case is
#    proven by the unit test that omits seo.titleTemplate and asserts '%s':
pnpm --filter @press/web exec vitest run src/config/resolve-config.test.ts
```

### Type guard — loud fail (AC4)

A destructive change to the engine's config type must break at the adopter's
`press.config.ts`, not silently drift:

```bash
# Temporarily rename the engine field, e.g. in
# packages/press-web/src/config/types.ts rename PressConfig `seo.titleTemplate`
# to `seo.titleTpl`, then:
pnpm --filter web typecheck
#    → tsc FAILS pointing at press.config.ts:
#      "Object literal may only specify known properties, and 'titleTemplate'
#       does not exist in type ..." — the loud failure IS the pass condition.
# Revert the rename to restore green.
```

### Project-zone cleanliness (AC5)

The engine never writes `press.config.ts`. After a build/sync/render the root
file is untouched:

```bash
node scripts/e2e-check.mjs   # build + start + assert
git status --porcelain       # → empty: press.config.ts (and the host) unchanged
```
````

- [ ] **Step 2: Execute the documented AC4 guard once to confirm it fails loud**

Apply the rename described in the README (rename `seo.titleTemplate` → `seo.titleTpl` in `packages/press-web/src/config/types.ts`), then:
Run: `pnpm --filter web typecheck`
Expected: FAIL, with the error located in `press.config.ts` (the `titleTemplate` property). Then REVERT the rename:
Run: `pnpm --filter web typecheck`
Expected: PASS (green restored).

- [ ] **Step 3: Confirm AC5 cleanliness**

Run: `git status --porcelain`
Expected: empty output (the rename was reverted; the engine wrote nothing to `press.config.ts`).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(spec): Spec 2 run guide — SEO render, type guard, git-clean (Spec 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Acceptance-criteria → task map

| AC | Where it is proven |
| -- | ------------------ |
| **AC1** SEO from config (e2e) | Task 7 (e2e `<title>`, description, og:title, og:image absolute, canonical) + Task 3 unit |
| **AC2** Brand identity in layout | Task 6 (`<html lang>`, favicon via metadata) + Task 7 e2e asserts |
| **AC3** Default vs. override | Task 2 unit (omitted → `%s`) + Task 7 e2e (set → custom `<title>`) |
| **AC4** Type-level contract guard (loud fail) | Task 6 host typecheck surface + Task 8 documented + executed rename guard |
| **AC5** Project-zone cleanliness | Task 8 `git status --porcelain` clean after render |
| **DoD** placeholder reconciled | Task 5 (`apps/cms/press.config.ts` migrated to root) |
