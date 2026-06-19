# press

A CLI for building content-driven sites on a **Strapi 5 CMS + Next.js** stack,
where the whole stack ships as a versioned, updatable dependency. You own a
thin config layer (`press.config.ts` + your custom blocks); `press` materializes
and runs everything else.

```bash
pnpm create @ogs-tech/press my-site
cd my-site
pnpm dev          # cms on :1337/admin, web on :3000
```

One project, four commands: **create → dev → build → upgrade**.

## Requirements

- **Node 20.x** (`engines` pins `>=20 <21`)
- **pnpm 10.x**

## Install

> **Published on npm** under the [`@ogs-tech`](https://www.npmjs.com/org/ogs-tech) org.
> Scaffold a project anywhere with `pnpm create @ogs-tech/press my-site`; the
> generated project pins `@ogs-tech/press-{web,cms}` at the versions that
> produced it. Inside this monorepo the same packages are consumed via `workspace:*`
> for a fast dev loop (see [Repository internals](#repository-internals)).

## Quickstart

```bash
# 1. Scaffold a new project (writes only your thin Project zone, then installs).
pnpm create @ogs-tech/press my-site
cd my-site

# 2. Develop — boots the full stack as one process group
pnpm dev
#   → cms (Strapi)  http://localhost:1337/admin
#   → web (Next.js) http://localhost:3000
# Ctrl-C stops both.

# 3. Build deployable artifacts for both halves
pnpm build
```

`pnpm dev` / `build` / `upgrade` are thin aliases the scaffold writes for
`press dev` / `press build` / `press upgrade`.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm create @ogs-tech/press <name>` | Scaffold a new project into `<name>/` and `pnpm install` it. Run once — `@ogs-tech/create-press` is the scaffolder and is not added as a project dependency. |
| `pnpm dev` | Materialize the web host, seed sample content, boot cms (`:1337`), sync CMS schema → web types, then boot web (`:3000`). Maps to `press dev`. |
| `pnpm build` | Materialize the web host, `strapi build` the cms, and `next build` the web. No live CMS is needed to build. Maps to `press build`. |
| `pnpm upgrade [version]` | Bump `@ogs-tech/press-*` to the target in lockstep, reinstall, and re-materialize the host. Default = latest; pass an explicit version (e.g. `pnpm upgrade 0.4.0`) to pin a specific release. Maps to `press upgrade`. |

Run `press --help` or `press <command> --help` for the full flag list on the runtime bin.

## What `pnpm create @ogs-tech/press` writes

The scaffold is **ultra-thin** — only the layer you own. There is no `app/` or
`next.config`; the Next host is engine-owned and regenerated under a gitignored
`.press/web/` on every `dev`/`build`.

```
my-site/
├─ packages/
│  ├─ web/                 # your zone: config.ts (brand + SEO) + blocks/custom/ (React blocks + index.ts)
│  ├─ cms/                 # the one visible host — a minimal Strapi app
│  │  └─ scripts/seed.mjs  # sample home page so the first `press dev` renders something
│  └─ shared/              # the content-type contract (<name>-shared/types)
├─ package.json            # scripts: dev / build / upgrade → press
├─ pnpm-workspace.yaml     # packages/* are workspace members (web has no package.json, so pnpm skips it)
└─ .npmrc / .gitignore / .nvmrc
```

`.press/` is engine territory — regenerated every run, **never edit it**.

## Customizing your site

**Brand & SEO** — edit `press.config.ts`. It is typed by `@ogs-tech/press-web`, so an
engine update that changes the config shape fails loudly at *your* file rather
than drifting silently:

```ts
import { defineConfig } from '@ogs-tech/press-web';

export default defineConfig({
  brand: { name: 'Acme', logo: '/logo.svg', favicon: '/favicon.ico' },
  site: { url: 'https://acme.test', locale: 'en' },
  seo: {
    titleTemplate: '%s | Acme',
    defaultTitle: 'Acme',
    defaultDescription: 'An Acme content site.',
    defaultOgImage: '/og.png',
  },
});
```

**Custom blocks** — add a Strapi component under `packages/cms/src/components/custom/`,
a matching React component under `packages/web/blocks/custom/`, and wire it in
`packages/web/blocks/custom/index.ts`:

```ts
export const customBlocks: Record<string, ComponentType<any>> = {
  'custom.callout': Callout,
};
```

The materialized host passes this map to its block renderer, so your blocks
render server-side alongside the engine's built-in blocks.

## Updating the engine

`press upgrade` (via `pnpm upgrade`) is the coordinated lockstep update path —
it resolves the target version, rewrites exact pins for `@ogs-tech/press-web` and
`@ogs-tech/press-cms` in lockstep, reinstalls, and re-materializes the host.
Because pins are EXACT, `pnpm update` is a no-op — `pnpm upgrade` is the real path.

```bash
pnpm upgrade            # latest engine
pnpm upgrade 0.4.0      # a specific version
```

Engine updates never touch your Project zone (your config, blocks, and content
stay byte-for-byte intact).

---

## Repository internals

This monorepo develops `press` and proves the core thesis — that a Strapi 5 CMS
can ship as a versioned, updatable dependency without leaking into the adopter's
code.

- `packages/cli` — `@ogs-tech/create-press`: the run-once scaffolder invoked via `pnpm create @ogs-tech/press`; not added as a project dependency.
- `packages/cms` — the **engine** Strapi plugin (`@ogs-tech/press-cms`): ships a
  `page` content-type and injects reference Dynamic-Zone blocks.
- `packages/web` — the **engine** web layer (`@ogs-tech/press-web`): the Next host
  template, block renderer, config helpers, and CMS→types sync.
- `packages/shared` — `@ogs-tech/press-shared`: framework-agnostic contract types
  (the `PressSchema` wire format) and constants shared by `cms` and `web`.
- `apps/playground/` — the in-repo dogfood: the real `press create` output,
  committed and consumed via `workspace:*` for a fast dev loop. Boot it with
  `pnpm play`; recreate it from the live scaffold with `pnpm play:create`, or
  refresh just the engine-owned host with `pnpm play:upgrade`.

### Working in the repo

```bash
pnpm install              # from the repo root (Node 20.x, pnpm 10.x)
pnpm --filter @ogs-tech/create-press test      # CLI unit contracts
pnpm play                             # boot the playground (press dev: cms :1337 + web :3000)
```

End-to-end tests (a Playwright suite) are planned.

### Design docs

- Specs & results: [`docs/superpowers/specs/`](docs/superpowers/specs/)
- Roadmap & PRD: [`docs/beta/`](docs/beta/)
- The original Strapi-as-dependency spike (PASS on Path A):
  [`docs/superpowers/specs/2026-06-10-strapi-as-dependency-spike-design.md`](docs/superpowers/specs/2026-06-10-strapi-as-dependency-spike-design.md) (§13 Results)
