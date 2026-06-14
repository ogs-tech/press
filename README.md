# press

A CLI for building content-driven sites on a **Strapi 5 CMS + Next.js** stack,
where the whole stack ships as a versioned, updatable dependency. You own a
thin config layer (`press.config.ts` + your custom blocks); `press` materializes
and runs everything else.

```bash
press create my-site --registry http://localhost:4873
cd my-site
pnpm dev          # cms on :1337/admin, web on :3000
```

One project, four commands: **create → dev → build → deploy**.

## Requirements

- **Node 20.x** (`engines` pins `>=20 <21`)
- **pnpm 10.x**
- **Docker** (only for the self-hosted deploy path)

## Install

> **Not published to npm yet.** `@press/*` is served from a local Verdaccio
> registry (`http://localhost:4873`). Start it, then point `press` at it with
> `--registry`. See [repository internals](#repository-internals) to publish the
> packages first.

```bash
scripts/registry.sh start                 # local registry on :4873
pnpm add -g @press/cli --registry http://localhost:4873
```

## Quickstart

```bash
# 1. Scaffold a new project (writes only your thin Project zone, then installs).
#    --registry makes the project consume @press/* from the local registry.
press create my-site --registry http://localhost:4873
cd my-site

# 2. Develop — boots the full stack as one process group
pnpm dev
#   → cms (Strapi)  http://localhost:1337/admin
#   → web (Next.js) http://localhost:3000
# Ctrl-C stops both.

# 3. Build deployable artifacts for both halves
pnpm build

# 4. Deploy — validates prereqs and prints the copy-pasteable deploy path
pnpm deploy
```

`pnpm dev` / `build` / `deploy` are thin aliases the scaffold writes for
`press dev` / `press build` / `press deploy`.

## Commands

| Command | What it does |
| --- | --- |
| `press create <name>` | Scaffold a new project into `<name>/` and `pnpm install` it. `--registry <url>` points at the registry serving `@press/*` (default: npmjs; use `http://localhost:4873` until published). |
| `press dev` | Materialize the web host, seed sample content, boot cms (`:1337`), sync CMS schema → web types, then boot web (`:3000`). |
| `press build` | Materialize the web host, `strapi build` the cms, and `next build` the web. No live CMS is needed to build. |
| `press deploy` | Check prereqs (a web build exists, `cms/.env` is set, the deploy kit is present) and emit the documented self-hosted + managed deploy paths. |

Run `press --help` or `press <command> --help` for the full flag list.

## What `press create` writes

The scaffold is **ultra-thin** — only the layer you own. There is no `app/` or
`next.config`; the Next host is engine-owned and regenerated under a gitignored
`.press/web/` on every `dev`/`build`.

```
my-site/
├─ press.config.ts          # brand identity + SEO — the single whitelabel source of truth
├─ blocks/custom/           # your React blocks + the block map (index.ts)
├─ content/seed.mjs         # sample home page so the first `press dev` renders something
├─ cms/                     # the one visible host — a minimal Strapi app
├─ deploy/                  # self-hosted Docker Compose kit (Postgres + cms + web + Caddy)
├─ package.json             # scripts: dev / build / deploy → press
├─ pnpm-workspace.yaml      # cms is a workspace member
└─ .npmrc / .gitignore / .nvmrc / .dockerignore
```

`.press/` is engine territory — regenerated every run, **never edit it**.

## Customizing your site

**Brand & SEO** — edit `press.config.ts`. It is typed by `@press/web`, so an
engine update that changes the config shape fails loudly at *your* file rather
than drifting silently:

```ts
import { defineConfig } from '@press/web';

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

**Custom blocks** — add a Strapi component under `cms/src/components/custom/`,
a matching React component under `blocks/custom/`, and wire it in
`blocks/custom/index.ts`:

```ts
export const customBlocks: Record<string, ComponentType<any>> = {
  'custom.callout': Callout,
};
```

The materialized host passes this map to its block renderer, so your blocks
render server-side alongside the engine's built-in blocks.

## Deploy

`press deploy` validates and prints two documented paths (full guide:
[`docs/beta/deploy.md`](docs/beta/deploy.md)):

**Self-hosted (recommended)** — one Docker Compose stack (Postgres + cms + web +
a Caddy single-origin proxy):

```bash
pnpm build
cp deploy/.env.deploy.example deploy/.env.deploy   # fill secrets + CMS_URL
docker compose -f deploy/docker-compose.yml --env-file deploy/.env.deploy up -d --build
# → http://localhost:8080  (point the publish port / CMS_URL at your domain for prod)
```

**Managed** — Strapi Cloud (cms) + Vercel (web). Deploy order is always **cms
first** (it owns the public origin + DB), then web wired to the live `CMS_URL`.

> **Build where you run.** The images copy the host-built `node_modules` +
> artifacts, so build on the same OS/arch you deploy to (a Linux VPS or CI). See
> the guide for the cross-platform (registry-install) alternative.

## Updating the engine

There is no special update command. Bump the dependencies and rebuild:

```bash
pnpm update @press/cms @press/web
pnpm --filter cms build && pnpm --filter cms start
```

Engine updates never touch your Project zone (your config, blocks, and content
stay byte-for-byte intact). That non-breakage promise is enforced in CI by a
standing contract guard — see [repository internals](#repository-internals).

---

## Repository internals

This monorepo develops `press` and proves the core thesis — that a Strapi 5 CMS
can ship as a versioned, updatable dependency without leaking into the adopter's
code.

- `packages/press-cli` — the `@press/cli` CLI (this package).
- `packages/press-cms` — the **engine** Strapi plugin (`@press/cms`): ships a
  `page` content-type and injects reference Dynamic-Zone blocks.
- `packages/press-web` — the **engine** web layer (`@press/web`): the Next host
  template, block renderer, config helpers, and CMS→types sync.
- `apps/playground/` — the in-repo dogfood: the real `press create` output,
  committed and consumed via `workspace:*` for a fast dev loop. Boot it with
  `pnpm play`.
- `scripts/` — `cli-e2e.mjs` (the create→dev→build→deploy acceptance gate),
  `deploy-smoke.mjs`, `registry.sh` (local Verdaccio helper).

### Working in the repo

```bash
pnpm install              # from the repo root (Node 20.x, pnpm 10.x)
pnpm --filter @press/cli test         # CLI unit contracts
pnpm play                             # boot the playground (press dev: cms :1337 + web :3000)
node scripts/cli-e2e.mjs              # full create→dev→build→deploy acceptance gate
pnpm deploy:smoke                     # self-hosted deploy proven end-to-end (Linux)
```

`cli-e2e.mjs` runs the full `press create → dev → build → deploy` cycle against an
ephemeral registry and asserts the Project zone stays pure (no engine or host file
is ever committed into the generated project — AC4).

### Design docs

- Specs & results: [`docs/superpowers/specs/`](docs/superpowers/specs/)
- Roadmap & PRD: [`docs/beta/`](docs/beta/)
- The original Strapi-as-dependency spike (PASS on Path A):
  [`docs/superpowers/specs/2026-06-10-strapi-as-dependency-spike-design.md`](docs/superpowers/specs/2026-06-10-strapi-as-dependency-spike-design.md) (§13 Results)
