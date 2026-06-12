---
title: "Spec — CLI surface `press create / dev / build / deploy` (Spec 3)"
internal_name: press-cli
relates_to: docs/beta/prd.md
roadmap: docs/beta/roadmap.md
status: Design approved
created_at: 2026-06-11
updated_at: 2026-06-11
---

# Spec — CLI surface `press create / dev / build / deploy` (Spec 3)

> [!NOTE]
> Spec 3 of the press beta. Depends on Spec 0 (Strapi-as-dependency, done),
> Spec 1 (`@press/web` + type-sync, done) and Spec 2 (`press.config.ts`, done).
> It lands the **first end-user surface**: the `press` CLI that wraps the
> now-proven engine (`@press/cms` + `@press/web` + `press.config.ts`) into the
> **create → dev → build → deploy** flow. This is the spec that answers PRD
> **Q1** (a dev reaches first deploy unaided). See
> [roadmap.md](../../beta/roadmap.md) Spec 3.

**TL;DR** — A `press` CLI turns the engine into a product. `press create` writes
an **ultra-thin Project zone** (config + custom blocks + content seed + a minimal
Strapi host) and nothing else; `press dev` and `press build` **materialize the
Next host from the engine** into a gitignored `.press/` artifact and boot/build
the whole stack as one command; `press deploy` is a thin command surface that
delegates to the Spec 5 guide. The design rule throughout: **every byte the CLI
writes into the adopter's repo is a byte the engine can no longer update** — so
the CLI writes as little as the stack allows, and everything engine-owned stays
out of the Project zone.

## 1. The question (single anchor)

> Can a dev run `press create` → `press dev` → `press build` and reach a
> deployable stack **unaided**, while the CLI writes only the adopter's Project
> zone — so the create-time footprint adds **zero** new contract-leak surface for
> the Q2 non-breakage promise?

This answers **PRD Q1** (Flow). Spec 0/1/2 proved the engine halves (CMS, web,
config) hold individually; Spec 3 proves they **compose into a single
create→build flow** behind a CLI, without that flow scaffolding engine code into
the adopter's hands. Q1 and Q2 meet here: the friction question (can they reach
deploy?) and the contract question (does `create` freeze anything the engine
owns?) are the same surface viewed twice.

## 2. Scope decisions (2026-06-11)

Three product/scope decisions, taken before design:

1. **Project zone = ultra-thin, asymmetric.** `press create` writes ONLY the
   adopter-owned layer: `press.config.ts`, `blocks/custom/`, a content seed,
   `.env`, and a `package.json` depending on `@press/*`. The **Next host is
   engine-owned** — `@press/web` ships it and the CLI materializes it on
   dev/build (§4). The **CMS host stays a minimal Strapi app visible in the repo**
   — Strapi cannot be a pure library (the Spec 0 lesson), so `cms/` is the one
   real host the adopter sees. Asymmetry by necessity: the adopter has a `cms/`
   folder and no `web/` folder, hidden behind a single `press dev`. *(Rejected:
   a thin two-app monorepo that commits the web host — it would freeze
   `layout.tsx`/`page.tsx` on create, a Q2 leak; and an ejectable hybrid —
   doubles the paths the beta must test for no Phase-0 need.)*
2. **Command depth = `create`/`dev`/`build` real; `deploy` thin.** The risk in
   Q1 lives in `create → dev` (a two-app stack booting from versioned deps on a
   clean machine) and `build` (the production half). Those are fully
   implemented. `press deploy` **exists** as a command — validates prereqs and
   emits the documented path — but provider orchestration and the managed +
   self-hosted **guide are Spec 5's job** (the roadmap makes Spec 5 depend on
   Spec 3). Keeping `deploy` thin avoids duplicating the Spec 5 boundary.
3. **Draft preview = deferred (again).** Spec 1 parked it into Spec 2; Spec 2
   parked it here. Decision: **still defer.** Preview is content-authoring
   comfort, off the create→deploy critical path of Q1; wiring it pulls in Strapi
   preview tokens + Next `draftMode()` + an alternate `getPage` path for no gain
   against this spec's anchor. The other item Spec 2 parked here — **config
   wiring into `press dev` / `press build`** — stays **in** (§5).

## 3. Stack & runtime

Carried over; nothing here justifies diverging. The CLI is a TypeScript program
on **Node 20 LTS**, run with the package manager's create/exec form, orchestrating
**pnpm** + the existing **Strapi 5** / **Next 15** halves. Argument parsing and
command dispatch use a single small, established CLI library (recommend
`commander`) rather than a hand-rolled parser — a 4-command surface with
`--help`/usage is exactly its sweet spot; flagged here per the "no silent new
dependency" rule, with hand-rolling as the zero-dep fallback if even that is
unwanted. No new runtime stack is introduced; the CLI is glue over proven parts.

## 4. Architecture — the CLI as engine-owned glue, the host as a build artifact

The Engine/Project boundary from [PRD §4](../../beta/prd.md), now extended to the
*tooling* and the *runnable host*.

|          | Engine zone (versioned, `@press/*`)                                               | Project zone (adopter-owned)                                  |
| -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **CLI**  | `@press/cli`: the `press` binary + the host template it materializes              | the generated `package.json` scripts that call `press`        |
| **Web**  | `@press/web`: renderer, config helpers (Spec 2), **+ a packaged Next host template** | *(nothing committed — the host is materialized to `.press/`)* |
| **CMS**  | `@press/cms`: the Strapi plugin (Spec 0)                                           | `cms/` — a minimal Strapi host (`config/plugins.ts`, `src/components/custom/`) |
| **Data** | —                                                                                 | `press.config.ts`, `blocks/custom/`, content seed, `.env`     |

`@press/core` is still **not** introduced (YAGNI, per Spec 1/2). The CLI lives in
its own package, `@press/cli`.

### 4.1 The `.press/` materialized host — a build artifact, not Project zone

The crux of the ultra-thin model. The Next host the adopter never sees is
**materialized by the engine** into `<project>/.press/web/` on every `dev`/`build`:

- `@press/web` ships a **host template** (the `app/` tree, `next.config`,
  `tsconfig`) — the engine-ish boilerplate Spec 2 had sitting in `apps/web`,
  relocated to where the engine can version it.
- `press dev` / `press build` regenerate `.press/web/` from that template,
  wiring it to the adopter's layer: a generated `press.blocks.ts` re-exporting
  `../../blocks/custom`, and the config imported from `../../press.config`.
- `.press/` is **gitignored**, like `.next/`. It is regenerated every run and
  **never hand-edited**.

Why this beats running the engine app in place from `node_modules` (the rejected
Option A): `.press/web/` sits **inside the project tree**, so Node resolution
reaches the root `node_modules` (where `@press/web`, `next`, `react` resolve) and
the adopter's `blocks/custom/` — Next's file-based routing and module resolution
work normally, instead of fighting an app whose project root is outside its own
directory.

> **The Q2 invariant, stated once:** the contract-leak test is not "does a file
> exist on disk?" but "**who owns it and who regenerates it?**". `.press/web/` is
> the engine's, regenerated on every run — an engine update may rewrite it
> freely without touching the Project zone, exactly as `.next/` is rewritten by a
> build. A host committed under `apps/web/` would be the adopter's, and any
> engine rewrite of it would be the defect class the beta hunts. This is the
> structural reason the ultra-thin model is the strongest Q2 posture available.

### 4.2 Preserving the Spec 2 typed boundary

The materialized host consumes the config exactly as Spec 2 specified: it imports
the root `press.config.ts`, computes `const config = resolveConfig(userConfig)`
once as an immutable module constant, and passes it to `buildMetadata`. The
engine still **reads** the config (now through the host it owns) and **never
writes** it. Spec 2's AC4 (a destructive `PressConfig` change fails loud at the
adopter's config) and AC5 (engine never rewrites the file) carry forward
unchanged — the CLI is a new consumer of the same boundary, not a new boundary.

## 5. The commands

### `press create <name>`

Writes the ultra-thin Project zone into `<name>/` and installs it (PRD §6:
"installed, bootable project"). The written manifest (§6) and **only** that. Then
runs `pnpm install` against the configured registry. On a clean machine the CLI
itself is obtained from the same private registry as `@press/*` (invite-based in
the beta, §10); in this repo the proof runs against the existing local Verdaccio
(the Spec 0/1 mechanism — real tarballs, real semver).

### `press dev`

One command boots the whole stack:

1. Materialize `.press/web/` from the engine host template (§4.1).
2. Boot the CMS host (Strapi) on `:1337`; wait until healthy.
3. **Sync types** (CMS schema → `@press/web` types — the Spec 1 contract) so the
   host compiles against live content shapes.
4. Boot the Next host (`.press/web`) on `:3000`, **wired to `press.config.ts`**
   (the config-wiring item Spec 2 parked here).

The ordering (CMS healthy → sync → web) reuses the seed/e2e sequencing lessons
from Spec 1. The adopter sees one process group; the asymmetry is invisible.

### `press build`

Materializes `.press/web/`, then builds both halves — the Strapi host and the
Next host — producing deployable artifacts. The built web output reflects
`press.config.ts` (the Spec 2 SEO/identity surfaces in the built render, not just
in dev). This is the production half of Q1.

### `press deploy` (thin)

Exists so the create→deploy vocabulary is complete. Validates prereqs (a build is
present, required `.env` is set), then **emits the documented Spec 5 path**
(managed + self-hosted) and exits cleanly. No provider orchestration in this
spec — that, and the guide itself, are Spec 5.

## 6. Generated Project-zone manifest (`press create` output)

```
my-site/
├─ press.config.ts          # Spec 2 — whitelabel identity + SEO (defineConfig)
├─ blocks/
│  └─ custom/
│     └─ callout.tsx         # one example custom block (the Spec 1 contract surface)
├─ content/
│  └─ seed.mjs              # a sample home page so first `press dev` renders something
├─ cms/                      # the one visible host — a MINIMAL Strapi app
│  ├─ config/plugins.ts     # enables @press/cms ({ "press-cms": { enabled: true } })
│  ├─ src/components/custom/ # adopter custom Strapi components (e.g. callout.json)
│  ├─ package.json          # depends on @press/cms, @strapi/strapi
│  └─ .env                  # CMS_URL, DB (sqlite for dev), secrets — per-env infra
├─ package.json             # deps: @press/cli, @press/web, next, react, react-dom
│                           #   (next/react satisfy @press/web peers + run .press/web);
│                           #   scripts call `press` (dev/build/deploy)
├─ .gitignore               # ignores .press/, .next/, cms/.tmp, node_modules, .env
└─ .nvmrc                    # Node 20
```

**Not written:** any Next host file (`app/`, `next.config`, `layout.tsx`,
`page.tsx`) — those live in `@press/web` and are materialized to `.press/web/`
(§4.1). That absence *is* the ultra-thin guarantee made concrete.

## 7. The env × config boundary (carried from Spec 2 §5)

Unchanged and reaffirmed by the CLI: `.env` = per-environment infra/secrets
(`CMS_URL`, DB, lives in `cms/.env`); `press.config.ts` = stable whitelabel
identity (`site.url`, brand). `press create` seeds `.env` from a template;
`press dev`/`build` read it for infra and `press.config.ts` for identity. Two
URLs, two homes, by design.

## 8. Acceptance criteria — testable

Proven by generating a fresh project into a scratch dir and exercising it against
the local Verdaccio registry (no clean external machine required to validate).

1. **create → installed, bootable project.** `press create my-site` produces
   exactly the §6 manifest — config + `blocks/custom/` + content seed + a thin
   `cms/` host, and **no committed web host** — and `pnpm install` completes.
   Verified by a script asserting the file manifest (presence AND absence of the
   web host) and a green install.
2. **dev boots the whole stack from versioned deps.** `press dev` materializes
   `.press/web/`, boots `cms` (`:1337`) and web (`:3000`), and the seeded sample
   page **server-renders** — reusing the Spec 1 e2e assertion (hero + custom
   callout render from live CMS output). Proves the engine-owned host renders the
   adopter's config + blocks.
3. **build produces deployable artifacts that consume the config.** `press build`
   builds both halves; the built+started web output reflects `press.config.ts`
   (the Spec 2 `<head>` surfaces: templated `<title>`, canonical, OG). Reuses the
   Spec 2 e2e assertions against the built host, not just dev.
4. **Project-zone purity (the Q2 surface of this spec).** After
   `create` + `dev` + `build`, `git status` in the generated project shows **only
   adopter-owned files**; `.press/`, `.next/`, `cms/.tmp` are gitignored; **no
   engine or Next-host file is committed**. The set of files a future engine
   update could touch contains **zero** Project-zone entries. This is the AC that
   ties Spec 3 back to the non-breakage promise.
5. **deploy surface is complete (thin).** `press deploy` runs, validates prereqs,
   and emits the Spec 5 path without error — the create→deploy vocabulary is whole
   for Q1 even though the guide ships in Spec 5.

## 9. Definition of done

`@press/cli` exists with `create`/`dev`/`build`/`deploy`; `@press/web` ships the
host template the CLI materializes to `.press/web/`; `press create` writes the §6
ultra-thin manifest and installs it; `press dev`/`build` boot/build the whole
stack consuming `press.config.ts`; all §8 acceptance criteria pass; a documented
run (README section) reproduces create→dev→build from a clean state against the
local registry. The Spec 2 typed boundary (AC4/AC5) is preserved through the new
CLI consumer.

## 10. Out of scope (deferred to later specs)

- **Deploy guide + provider orchestration** (managed + self-hosted) — **Spec 5**;
  `press deploy` here is a thin, delegating command surface only (§5).
- **Draft preview** — content-authoring concern off the Q1 path (§2.3); a later
  spec.
- **`press upgrade` (assisted migration)** — the PRD §9 open question; the update
  *path* and its CI contract guard are **Spec 4**.
- **Non-breakage proof across an update** — Spec 3 *establishes* the create-time
  footprint (AC4 proves it adds no Project-zone surface); **Spec 4** *proves an
  update survives*, consistent with the Spec 1/2 split.
- **Public distribution** of the CLI and `@press/*` — post-beta (PRD §10); the
  beta installs both from a private registry (invite), exercised here via local
  Verdaccio.
- **Theme tokens, Strapi admin branding** — as deferred in Spec 2.

## 11. Risks & stop signals

| Risk | Signal | Response |
| ---- | ------ | -------- |
| The materialized `.press/web/` host can't resolve `@press/web` / `next` / the adopter's `blocks/custom/` | `next dev`/`build` in `.press/web/` fails module resolution or routing | The host lives **inside** the project tree so resolution reaches root `node_modules` (§4.1); generate the host `tsconfig` paths to `../../press.config` + `../../blocks/custom`; live-gate fallback is a generated re-export shim, as in Spec 2. |
| The scaffolded `cms/` Strapi host won't boot cleanly from versioned deps | `press dev` can't bring `:1337` healthy from the generated host | Reuse the **Spec 0-proven thin host** verbatim as the `create` template (`apps/cms` is the reference); the boot path is already validated. |
| `.press/` gets hand-edited and silently freezes despite being engine-owned | An adopter edits `.press/web/` and an update overwrites their change | Gitignore it, regenerate on **every** run, and document it as engine territory; surface a one-line note in `press dev` output. Treat any need to edit `.press/` as an engine-template bug, not an adopter task. |
| `press create` chicken-and-egg / private-registry friction defeats "unaided" (Q1) | A dev can't obtain `press` or install `@press/*` without a maintainer | Document the invite/registry step as the single prerequisite; keep everything after `press create` zero-config. In-repo, prove against Verdaccio (real semver). If this step is the friction that stalls Q1, that is itself a Phase-0 finding. |
| `press dev` concurrency races (CMS readiness vs. type-sync vs. web start) | Web boots before the CMS is healthy or before types are synced; flaky first render | Sequence explicitly: CMS healthy → sync types → start web (§5); reuse the Spec 1 seed/e2e ordering. |
| The CLI accretes scope (more commands, flags, provider logic) past the §5 surface | Commands beyond create/dev/build/deploy, or deploy starts orchestrating a provider | Hold the line — `deploy` is thin by decision (§2.2); provider work is Spec 5. Extra surface needs its own scope decision. |
