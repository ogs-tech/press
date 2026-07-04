# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`press` is a CLI/engine for content-driven sites on **Strapi 5 + Next.js**, where the
whole stack ships as a versioned, updatable npm dependency. The core thesis: the
adopter owns a thin **Project zone** (`press.config.ts` + custom blocks); the engine
*materializes and runs* everything else. This monorepo develops the engine and
dogfoods it through `apps/playground`.

## Layout — four engine packages + the dogfood

- `packages/shared` — `@ogs-tech/press-shared`: the `PressSchema` wire contract. Ships
  TS source (no build); imported **type-only** by cms + web so it never enters a
  runtime artifact.
- `packages/cms` — `@ogs-tech/press-cms`: a Strapi 5 **plugin**. Owns the `page` and
  `site-setting` content-types, injects the `press.*` reference blocks, and serves
  `GET /api/press/schema`. Compiled with `strapi-plugin build`.
- `packages/web` — `@ogs-tech/press-web`: the Next.js host template, block renderer,
  runtime CLI (`press dev/build/upgrade`), config helpers, and CMS→TS type-sync. Ships
  TS source (no build).
- `packages/cli` — `@ogs-tech/create-press`: the run-once scaffolder behind
  `pnpm create @ogs-tech/press`. Pins engine versions via a generated versions file.
- `apps/playground` — committed real scaffold output, consumed via `workspace:*` for a
  fast dev loop. It is its own nested workspace (its `packages/cms` + `packages/shared`
  are members).

## Commands

Root requires **Node 20.x** and **pnpm 10.x**.

| Command | What it does |
| --- | --- |
| `pnpm install` | Install from the repo root. |
| `pnpm build` | `turbo run build` — only `cms` actually compiles (`strapi-plugin build`); `web`/`shared` ship source. |
| `pnpm -r test` | Run the vitest suites across `cli`, `web`, `cms`. |
| `pnpm -r --if-present typecheck` | `tsc --noEmit` per package. **There is no eslint** — typecheck + tests are the quality gate. |
| `pnpm dev` | Boot the dogfood playground (`press dev`: cms `:1337/admin` + web `:3000`); recreates `apps/playground` from the live scaffold when absent. Force-recreate: `pnpm exec tsx scripts/create-playground.ts`. |
| `pnpm pack:check` | `pnpm build` + dry-run publish of the engine packages. |

Focused / single test:

- `pnpm --filter @ogs-tech/press-web test src/generator/generate.test.ts` — one vitest file
- `pnpm --filter @ogs-tech/press-web test -t "renders heading"` — by test name
- `pnpm --filter @ogs-tech/create-press test` — CLI unit contracts
- `pnpm --filter @ogs-tech/press-cms test:ts:back` — Strapi backend `tsc` typecheck (cms has no vitest config; its `test` runs vitest with defaults)

Release (changesets): add a changeset under `.changeset/` for any engine change, then
`pnpm version-packages` (bumps + regenerates the CLI's pinned versions) and
`pnpm release` (build + `changeset publish`).

## Architecture — the moving parts

### Materialization (`.press/web`)

The Next host is **not** scaffolded. `packages/web/templates/host/` is copied to
`<project>/.press/web/` on every `press dev`/`build` (`web/src/materialize.ts`). It
lives *inside* the project tree so Node resolution reaches the root `node_modules`
(`press-web`, `next`, `react`) and the adopter's `blocks/custom/`. `.press/` is
engine-owned, gitignored, regenerated every run — **never hand-edit it** (same for the
materialized `press-config.ts` / `press.blocks.ts` inside it).

### The contract + type-sync loop

1. cms serializes its **runtime view** — the `page` and `site-setting` content-types
   plus exactly the components admitted into the three engine Dynamic Zones (page
   `body`, site-setting `header`/`footer`), following nested component references —
   to `GET /api/press/schema` (`cms/.../lib/serialize-schema.ts`). Reading the live
   registry means the schema can never disagree with what Strapi actually serves.
2. web's generator (`web/src/generator/generate.ts`) turns that JSON into
   framework-agnostic TS, written to the adopter's `shared/types/generated.ts`.
3. The shape — `PressSchema` — is single-sourced in `@ogs-tech/press-shared` and imported
   **type-only** by both sides. The generator references **no Strapi types** on
   purpose. `press dev` re-syncs whenever the schema changes (`util/watch-schema.ts`).
   The ~2s poll is deliberately absent from the cms http log: the plugin drops that
   one line in development (`lib/quiet-schema-log.ts`) — don't "fix" the silence.

### Reference blocks + the custom-block extension point

- The engine ships a Gutenberg-style `press.*` core palette (paragraph, heading, list,
  quote, image, button, separator, spacer). Strapi only scans the *host app's*
  `src/components`, so the plugin **injects** these into the components registry during
  `register()` (`cms/.../lib/inject-components.ts`).
- **Extension point:** any component the adopter drops under the cms host's
  `src/components/custom/` is auto-admitted into every engine Dynamic Zone — the page
  `body` and the site-setting `header`/`footer` (`admitCustomBlocks`). The engine
  never names individual adopter blocks — only the `custom` category is the stable
  contract.
- **Engine sections (`section.*`):** a second engine-owned palette of *composite*
  sections (`section.hero`, `section.cta`) — flat (scalar/media/enum) blocks
  injected under the `section` category and admitted into the page `body` Dynamic
  Zone **statically** (listed in `content-types/page/schema.json`), not via the
  dynamic `custom.*` push. They keep the `press.*` atoms intact and flow through the
  unchanged type-sync pipeline. `press.hero` stays removed — sections are never `press.*`.
- **Engine chrome (`chrome.*`):** a third engine-owned palette for the site chrome
  (`chrome.navbar`, `chrome.footer`) — injected like `press.*` but admitted **only**
  into the `site-setting` `header`/`footer` Dynamic Zones (statically listed in its
  schema), never the page `body`. `chrome.navbar` nests `press.nav-item[]` + an
  optional `press.button` cta; brand (logo + name) is never stored on the block —
  `mapSiteSettings` hydrates it from Site Settings identity, plus the resolved nav
  links, before rendering. The serializer follows these nested component refs and
  the generator emits nested-only components without `__component` and adds
  `HeaderBlocks`/`FooterBlocks` unions. `bootstrap()` seeds `header: [navbar]`,
  `footer: [footer]` exactly once (plugin-store flag) — an editor-emptied zone is
  respected.
- On the web side, `BlockRenderer` merges four maps by `__component`:
  `{ ...referenceBlocks, ...sectionBlocks, ...chromeBlocks, ...components }` —
  engine `press.*` atoms, engine `section.*` sections (`src/section-blocks.ts`),
  engine `chrome.*` chrome (`src/chrome-blocks.ts`), then the adopter's
  **explicit** `customBlocks` map (no global registry). Adopter blocks win last, so
  any `section.*`/`chrome.*` is overridable via
  `components={{ 'section.hero': MyHero, 'chrome.navbar': MyNavbar }}`. An
  unknown component is skipped with a dev-only warning, never a crash.

### Build-time anchors vs. runtime Site Settings

This split is recent and easy to get wrong:

- `press.config.ts` (Project zone, repo root) carries **build-time anchors only**:
  `routes.home`, `theme.name` (the `<html data-theme>` selector + `ThemeName` guard),
  and `theme.fonts` (which `next/font` must know at build time). The engine **reads**
  this file but **never rewrites** it. A destructive `ThemeName` change fails `tsc`
  right at the `defineConfig` call site.
- **Identity, SEO, theme color/radius VALUES, and the block-composed `header`/`footer`
  chrome** live in the CMS **"Site Settings"** single type — edited in the admin,
  fetched at runtime by `getSiteConfig` (ISR ~60s), no redeploy. Any failure (CMS down,
  malformed body) maps as if the record were *empty* → the site renders
  unbranded/default-themed rather than crashing. There is **no `press.config` fallback
  for identity** by design.
- Routing reads only the build-time anchor, so the `/home → /` redirect stays
  deterministic and CMS-independent.

### Canonical identity (URNs)

- Web-only identity primitives in `packages/web/src/urn.ts`: the closed union
  `Entity` (`'page' | 'site-setting'`), the template-literal `Urn<E>` =
  `urn:{entity}:{id}`, the `Canonical<E extends Entity>` interface
  (`{ urn: Urn<E> }`), and the pure `buildUrn(entity, id)` factory — interface +
  factory, no classes, so a urn stays a plain string across the RSC boundary.
  The wire/CMS contract is untouched: a urn is never sent or stored by press-cms.
- `Page extends Canonical<'page'>`: `urn:page:{documentId}` is attached by the
  pure `mapPage` (`map-page.ts`, mirroring the `mapSiteSettings` pure-mapper +
  thin-fetcher split); `getPage` stays a thin fetcher.
- `ResolvedPressConfig extends Canonical<'site-setting'>`: `mapSiteSettings`
  attaches the SYNTHETIC constant `urn:site-setting:default` — a single type has
  no id in this wire contract, so identity is never CMS-sourced and survives an
  unreachable CMS.
- `blockKey` formats its React key through the same primitive with
  `__component` as the entity segment (`urn:press.image:5`) — a COMPUTED
  identity, never stored: DZ block ids are ephemeral (unique only per component
  table, no document identity), so blocks deliberately stay OUT of the closed
  `Entity` union. Extending `Entity` is additive; widening a call site to plain
  `string` is not allowed.

### Versioning + upgrade

- Engine packages are versioned **independently** via changesets — `press-web` and
  `press-cms` can sit at different patch levels.
- A generated project pins `@ogs-tech/press-{web,cms}` at **exact** versions, so
  `pnpm update` is a no-op. `press upgrade` (`web/src/commands/upgrade.ts`) is the only
  coordinated path: rewrite both pins (latest per package, or an explicit target),
  reinstall, re-materialize to fail early. It never touches the adopter zone.
- The CLI bakes current engine versions into the scaffold via `gen:versions`
  (`versions.generated.ts`); CI runs `gen:versions --check` to keep it fresh.

## Conventions & gotchas

- Code comments cite **"Spec §…"** sections — historical design-spec references.
  The specs themselves were removed from the repo on purpose; **this file is now the
  living architectural reference**. Treat a `Spec §…` citation as a marker that the
  behavior was a deliberate design decision, and preserve that intent when changing it.
- Engine packages ship **TS source** (`web`/`shared` have echo-only `build`); only
  `cms` compiles. Don't introduce bundling without a reason.
- The package behind `pnpm create @ogs-tech/press` is `@ogs-tech/create-press` (the
  scaffolder) — it is run once and never added as a project dependency.
- Process orchestration is **crash-aware**: `press dev`/`build` use
  `waitForReadyOrExit` and propagate truthful exit codes — they never report a false
  success.
