---
title: "Spec — Whitelabel `press.config.ts` (Spec 2)"
internal_name: press-cli
relates_to: docs/beta/prd.md
roadmap: docs/beta/roadmap.md
status: Design approved
created_at: 2026-06-11
updated_at: 2026-06-11
---

# Spec — Whitelabel `press.config.ts` (Spec 2)

> [!NOTE]
> Spec 2 of the press beta. Depends on Spec 0 (Strapi-as-dependency, done) and
> Spec 1 (`@press/web` + type-sync, done). It lands the **third Project-zone
> extension point** — `press.config.ts` — alongside `content/` and
> `blocks/custom/`. The PRD names this file in §4 as an artifact the engine
> *reads* and an update *never rewrites*; this spec defines the typed,
> engine-owned interface the adopter fills and proves that boundary holds. See
> [roadmap.md](../../beta/roadmap.md) Spec 2.

**TL;DR** — Centralize whitelabel **identity + SEO** in a single Project-zone
`press.config.ts` consumed by `@press/web` through an engine-owned typed
interface (`defineConfig` / `resolveConfig` / `buildMetadata`). The adopter
authors brand + SEO once; the engine resolves defaults and produces the page's
`<head>` metadata and layout identity. The contract boundary is exercised for
real: the engine reads the file but never writes it, and a destructive change to
the engine's config type fails **loud** at the adopter's `press.config.ts`
(compile-time), never silent drift.

## 1. The question (single anchor)

> Can the adopter centralize identity + SEO in a Project-zone `press.config.ts`
> that `@press/web` consumes — through an engine-owned typed interface — so the
> boundary holds: an engine update never rewrites the file, and a destructive
> change to the engine's config type breaks **loud** at the adopter's config?

This answers the **PRD §4 contract boundary** for the whitelabel surface. Spec 0
proved the CMS side of the block contract; Spec 1 proved the front-end side;
Spec 2 proves the **config** Project-zone artifact named in PRD §6 ("Whitelabel
config centralized in `press.config.ts`, consumed by the engine").

## 2. Scope decisions (2026-06-11)

Two product/scope decisions, taken before design:

1. **Whitelabel surface = Identity + SEO.** `brand` (name, logo, favicon),
   `site` (url, locale), `seo` (title template, default title/description, default
   OG image). Theme tokens (colors/fonts wired to Tailwind) are **out** — they
   couple the contract to Tailwind and inflate the non-breakage obligation, which
   PRD §8 explicitly warns against ("keep the public contract deliberately
   small"). Strapi admin branding (consumption by `@press/cms`) is **out** — it
   pulls in admin-panel customization mechanics; deferred.
2. **Draft preview = deferred.** Spec 1 parked the draft-preview decision here
   (§5.1: "revisit with whitelabel/config in Spec 2"). Decision: **defer it.**
   Preview is a runtime concern, not brand identity; it would pull in Strapi
   preview tokens + Next `draftMode()` + an alternate `getPage` path (today
   deliberately published-only), enlarging the contract for no gain against this
   spec's anchor. It gets its own treatment later (Spec 3/CLI or a dedicated spec).

## 3. Stack & runtime

Carried over from Spec 1; nothing here justifies diverging. Next 15 App Router /
RSC (server-rendered `<head>` for SEO), TypeScript, Node 20 LTS, pnpm workspaces +
Turborepo. The whitelabel config is **pure data** (no React import), consumed at
module-eval time in the Next server build.

## 4. Architecture — the config as a typed boundary

The Engine/Project boundary from [PRD §4](../../beta/prd.md), now extended to the
whitelabel surface.

|         | Engine zone (versioned, `@press/*`)                                                                 | Project zone (adopter-owned)                          |
| ------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Web** | `@press/web`: `PressConfig`/`ResolvedPressConfig` types, `defineConfig`, `resolveConfig`, `buildMetadata` | `press.config.ts` (root) + thin host consumption in `apps/web` |

`@press/core` is still **not** introduced (YAGNI, per Spec 1). The config types
and resolver live in `@press/web`.

### 4.1 Where the config lives — single root artifact (decided)

**One `press.config.ts` at the monorepo root** (Project zone). Rationale:

- Honors the PRD's singular framing ("a `press.config.ts`") — one whitelabel
  source of truth, not one per host.
- Future-proofs `@press/cms` admin-branding consumption (deferred) without
  coupling the cms host to the web host's directory: a Strapi `config/*.ts` file
  can `require` a root module trivially; `apps/web` importing `../web/...` would
  be the ugly alternative.
- The existing `apps/cms/press.config.ts` placeholder (shipped in Spec 0 solely
  so the contract snapshot included it) is **migrated to the root** and expanded
  to the Identity + SEO shape.

**Next import mechanism.** `apps/web` imports the root file via a tsconfig path
(e.g. `"press.config": ["../../press.config.ts"]`) and Turbopack transpiles it
into the server graph. The file is pure data (no `react` import), so it does
**not** reactivate the React 18/19 type skew that Spec 1 pinned in `apps/web`'s
tsconfig. Any cross-boundary integration friction is a live-gate detail resolved
in the implementation plan.

### 4.2 Engine API — `defineConfig` / `resolveConfig` / `buildMetadata`

`@press/web` exports:

- `type PressConfig` — the adopter-facing input. `brand.name` required; SEO/site
  fields optional (engine supplies defaults).
- `type ResolvedPressConfig` — every field present after defaults applied.
- `defineConfig(config: PressConfig): PressConfig` — identity helper. Gives the
  adopter autocomplete + compile-time validation; the call site is where a
  destructive engine-type change surfaces loud (AC4).
- `resolveConfig(config: PressConfig): ResolvedPressConfig` — fills defaults
  (`titleTemplate` → `'%s'`, `locale` → `'en'`, resolves `defaultOgImage`
  against `site.url`, etc.). Pure function.
- `buildMetadata(resolved: ResolvedPressConfig, page?: { title?: string;
  description?: string } | null): Metadata` — produces a Next `Metadata` object
  for `generateMetadata`: title via `seo.titleTemplate` applied to the page
  title (falling back to `seo.defaultTitle` when no page), description (page or
  `seo.defaultDescription`), canonical from `site.url`, OpenGraph (title,
  description, absolute OG image).

This mirrors Spec 1's already-shipped pattern: an **explicit value passed at the
boundary**, not a global mutable singleton. The host computes
`const config = resolveConfig(userConfig)` once as an **immutable module
constant** (distinct from the mutable runtime registry Spec 1 rejected — that
concern was about mutation under RSC, not about immutable constants) and passes
it to the engine helpers.

### 4.3 Two kinds of engine-owned types

Spec 2 introduces a **static** engine type (`PressConfig`, hand-authored,
versioned with `@press/web`) alongside Spec 1's **generated** types (derived from
the CMS schema). Both are contract surfaces; they fail loud differently — the
generated type on a schema change after re-sync (Spec 1 AC3), the static config
type on a package bump that changes `PressConfig` (this spec, AC4).

## 5. The env × config boundary (explicit principle)

A stated rule, because it answers "why isn't `CMS_URL` in the config?":

- **`.env` = per-environment infrastructure / secrets.** Changes between
  localhost and production. `CMS_URL` stays here (it already is, read in
  `get-page.ts` and `hero.tsx`).
- **`press.config.ts` = stable whitelabel identity.** The same across every
  environment. `site.url` (canonical/OG base) lives here — it is brand identity,
  not infrastructure.

Two URLs, two homes, by design: `CMS_URL` is where the content *comes from*
(infra); `site.url` is who the site *is* (identity).

## 6. Config shape (beta — Identity + SEO)

```ts
// press.config.ts (repo root, Project zone)
import { defineConfig } from '@press/web'

export default defineConfig({
  brand: {
    name: 'Acme',
    logo: '/logo.svg',
    favicon: '/favicon.ico',
  },
  site: {
    url: 'https://acme.com',
    locale: 'en',
  },
  seo: {
    titleTemplate: '%s | Acme',
    defaultTitle: 'Acme',
    defaultDescription: 'An Acme content site.',
    defaultOgImage: '/og.png',
  },
})
```

Only `brand.name` is required; every other field has an engine default applied by
`resolveConfig`.

## 7. Host consumption (`apps/web` — thin, stable, Project zone)

- `app/layout.tsx` — `<html lang>` ← `site.locale`; favicon ← `brand.favicon`;
  base `metadata` (brand defaults, no page) via `buildMetadata(config, null)`.
- `app/[...slug]/page.tsx` — `generateMetadata` calls `buildMetadata(config,
  page)`: title through the template, description, canonical + absolute OG.
- Resolution: `const config = resolveConfig(userConfig)` at module scope — an
  immutable constant, deterministic under RSC/SSR.

The engine never reads `press.config.ts` by path; the host imports it and hands
the resolved value to the engine. The boundary is the typed function signature.

## 8. Acceptance criteria — testable

1. **SEO from config (e2e).** A rendered page's `<head>` reflects the config:
   `<title>` via `seo.titleTemplate` applied to the page title, meta description,
   `og:title`, `og:image` (absolute, resolved against `site.url`), and canonical.
   Verified by an HTTP check on the rendered markup (extends
   `scripts/e2e-check.mjs`).
2. **Brand identity in layout.** `<html lang>` equals `site.locale`; a favicon
   link derives from `brand.favicon`. Observable in the rendered markup.
3. **Default vs. override.** With a field omitted from `press.config.ts`, the
   engine default applies; with it set, the config value wins — proving
   `resolveConfig`. Demonstrated for at least `seo.titleTemplate` (omitted → `%s`;
   set → custom template visible in the rendered `<title>`).
4. **Type-level contract guard (loud-fail).** `tsc --noEmit` types
   `press.config.ts` from `@press/web`; `defineConfig` provides autocomplete and
   compile-time validation. A destructive change to the engine's `PressConfig`
   type (e.g. renaming `seo.titleTemplate`) makes `tsc` **fail at
   `press.config.ts`** — the loud-failure behavior is the pass condition.
5. **Project-zone cleanliness.** The engine never writes `press.config.ts`;
   `git status` is clean after a build/sync. (Verified the same way as Spec 1
   AC4.)

## 9. Definition of done

Root `press.config.ts` authored via `defineConfig`; `@press/web` exports the
config types + `resolveConfig` + `buildMetadata`; the host consumes the config in
`layout.tsx` and page `generateMetadata`; all §8 acceptance criteria pass; a
documented run (README section or script) reproduces the SEO-from-config render
and the type guard from a clean state. The `apps/cms/press.config.ts` placeholder
is reconciled (migrated to root).

## 10. Out of scope (deferred to later specs)

- **Theme tokens** (colors/fonts wired to Tailwind) — would couple the contract
  to Tailwind; revisit only if a real adopter need surfaces.
- **Draft preview** — runtime concern, not identity (§2.2); Spec 3 (CLI) or a
  dedicated spec.
- **Strapi admin branding** (`@press/cms` consumption of the config) — admin
  customization mechanics; later.
- **`pnpm update @press/web` non-breakage proof** for the config — Spec 2
  *establishes* the config contract; **Spec 4** (update path + CI guard) *proves
  it survives an update*, consistent with the roadmap and Spec 1's split.
- **CLI wiring** of config into `press dev / build` — Spec 3.

## 11. Risks & stop signals

| Risk | Signal | Response |
| ---- | ------ | -------- |
| Next can't cleanly import a root-level TS file across the package boundary | `apps/web` build/tsc fails to resolve `press.config.ts` | Resolve via tsconfig path + Turbopack transpile; if friction persists at the live gate, fall back to a tiny re-export shim inside `apps/web`. Pure-data file avoids the React-type-skew class. |
| The config surface creeps past Identity + SEO during implementation | New fields appear that aren't in §6 | Hold the line — each field is a non-breakage obligation (PRD §8). Extra fields need their own scope decision. |
| `buildMetadata` output doesn't match Next 15's `Metadata` contract for OG/canonical | Rendered `<head>` missing/incorrect OG or canonical tags | Verify against the real rendered markup (AC1 is an HTTP check on real output, not a fixture). |
| Module-scope resolved config behaves non-deterministically under RSC | Metadata differs between requests | Keep `resolveConfig` pure and the resolved value an immutable constant — no per-request mutation (the Spec 1 lesson). |
