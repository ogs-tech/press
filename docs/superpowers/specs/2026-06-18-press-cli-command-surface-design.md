---
title: "Spec — press command-surface revision: scaffolder/runtime split + `upgrade`"
internal_name: press-cli
relates_to: docs/beta/prd.md
roadmap: docs/beta/roadmap.md
supersedes_surface_of: docs/superpowers/specs/2026-06-11-press-cli-design.md
status: Design approved
created_at: 2026-06-18
updated_at: 2026-06-18
---

# Spec — press command-surface revision: scaffolder/runtime split + `upgrade`

> [!NOTE]
> A pre-publish revision of the CLI command surface (Spec 3 shipped
> `create / dev / build / deploy`). Triggered by the published package
> description still advertising `deploy` — a command **removed 2026-06-14**
> (see [roadmap.md](../../beta/roadmap.md) Spec 5) — which exposed that the
> surface no longer matches the product. This spec re-derives the surface from
> first principles and a market survey, then splits the CLI's two tangled roles.

**TL;DR** — The `press` package today mixes two roles: a **run-once scaffolder**
(`create`) and a **project-local runtime** (`dev`/`build`). We split them. The
scaffolder is renamed `@ogs-tech/press-cli` → **`@ogs-tech/create-press`** and is
invoked once via `pnpm create @ogs-tech/press`; it stops being a dependency of the
generated project (like `create-next-app` is never in a Next app's `package.json`). The runtime — `materialize` + `dev` + `build` + a new
**`upgrade`** — moves into `@ogs-tech/press-web` (which already ships the host
template and a runtime bin). The adopter's day-to-day is plain root `package.json`
scripts (`pnpm dev` / `pnpm build` / `pnpm upgrade`) that call the engine's bin.
`upgrade` is the command that was actually missing: with **exact** version pins
(`compute-versions.ts`), `pnpm update` is a no-op, so coordinated lockstep bumps
have no path today.

## 1. The question (single anchor)

> Can the press surface collapse to a **scaffolder** (`create`) plus a
> **project-local runtime** (`dev` / `build` / `upgrade`) — so the adopter's
> day-to-day is plain `pnpm` scripts, the CLI stops being a project dependency,
> and the engine stays updatable — **without ejecting orchestration into the
> adopter's zone**?

This is the same Q1/Q2 surface viewed once more: the flow question (can they
create → run → update unaided?) and the contract question (does any of this
freeze engine-owned logic in the adopter's repo?). The answer must keep the
ultra-thin Project zone intact while making the update path first-class.

## 2. Market survey (why this surface)

Surveyed comparable JS/TS framework + stack-as-dependency CLIs (Next, Astro,
Nuxt, Angular, Expo, RedwoodJS, Sanity, SvelteKit, Remix, Gatsby, Payload,
Keystone). Cross-cutting patterns:

- **(A) `create` is almost universally a separate run-once package** (`create-*`
  / `npm create`), never a long-lived project command. → press already does this
  conceptually; the split makes it literal (CLI leaves the project's deps).
- **(B) `dev`/`build` live in the framework's own CLI when it orchestrates its
  own machinery** (Nuxt, Angular, Redwood, Sanity, Keystone, Gatsby); only "thin"
  tools that delegate to a ready orchestrator (vite — SvelteKit, Remix) omit
  them. press *is* the orchestrator of two runtimes (Strapi + Next) + a
  materialized host → it keeps `dev`/`build`.
- **(C) A dedicated `upgrade` correlates with "coupled, versioned machinery"**:
  Angular (`ng update`), Nuxt (`nuxi upgrade`), Redwood (`rw upgrade`), Sanity
  (`sanity upgrade`), Expo (`expo install --fix`) all ship one; thin tools don't.
  press is squarely in the first category — a versioned engine is its thesis.
- **(D) For press specifically** (value = scaffold a thin zone + keep the
  engine/host materialized & migrated across versions), the minimal sensible
  surface is **`create` + `upgrade`** as the lifecycle spine, with `dev`/`build`
  retained as the orchestration the engine owns.

## 3. Scope decisions (2026-06-18)

1. **Scaffolder / runtime split + rename.** The run-once scaffolder is renamed
   `@ogs-tech/press-cli` → **`@ogs-tech/create-press`** and invoked via
   `pnpm create @ogs-tech/press <name>` (npm expands `npm create @scope/foo` →
   `@scope/create-foo`). The scaffold is the package's default action — no
   `create` subcommand. It is **removed from the generated project's
   dependencies** — a scaffolder has no business being a permanent dep. The
   rename lands **now** because it is free before the first real publish;
   renaming a published package would mean deprecating it in the registry. The
   runtime (`materialize`, `dev`, `build`,
   `upgrade`) moves into **`@ogs-tech/press-web`**, which already (a) ships the
   Next host template (`host-template/`) and (b) exposes a runtime bin
   (`bin/sync-types.ts`). *(Rejected: `@ogs-tech/press-shared` — it is
   `private`, contract-pure, build-less, and would have to grow a bin + runtime
   deps, contaminating the lightweight contract role, and its name collides with
   the project's local `<name>-shared`. Rejected: a new `@ogs-tech/press-runtime`
   — cleanest, but +1 package to publish in lockstep for no Phase-0 need.)*

2. **Interface = root `package.json` scripts → engine bin.** The adopter runs
   `pnpm dev` / `pnpm build` / `pnpm upgrade`. The scaffold writes these as thin
   one-line scripts (`"dev": "press dev"`, …) resolving to the `press` bin that
   `@ogs-tech/press-web` exposes. The orchestration **logic stays versioned in
   the engine** (updatable by bump), never ejected as frozen `scripts/*.mjs`.

3. **`upgrade` = re-materialize + coordinated lockstep bump.** Not codemods. It
   rewrites the engine's exact pins to the target, reinstalls, re-materializes to
   fail early, and reports `from → to`. The adopter's zone (config, blocks,
   content) stays byte-identical — the same non-breakage contract Spec 4 proved.

4. **`dev`/`build` retained.** They are real cross-runtime orchestration
   (materialize → seed → boot cms healthy → sync types → boot web → watch
   schema), not a wrapper over `next dev`. Removing them would push that work
   into the adopter's zone or lose hot type-sync — complexity displaced, not
   removed.

## 4. Architecture: before → after

| Package | Role | Commands | Dep of generated project? |
| --- | --- | --- | --- |
| `@ogs-tech/create-press` | **scaffolder (run-once)** | `pnpm create @ogs-tech/press` | **No** (never a project dep) |
| `@ogs-tech/press-web` | **engine runtime** | bin `press` → `dev` / `build` / `upgrade` | Yes (already) |
| `@ogs-tech/press-cms` | engine plugin | — | Yes (already) |
| `@ogs-tech/press-shared` | contract types (unchanged) | — | transitive |

Command-surface delta:

| Command | Before | After |
| --- | --- | --- |
| scaffold | `press create <name>` (`@ogs-tech/press-cli` subcommand, via `npx`) | `pnpm create @ogs-tech/press <name>` (package `@ogs-tech/create-press`) |
| `press dev` | CLI subcommand | moves to `@ogs-tech/press-web` bin; adopter runs `pnpm dev` |
| `press build` | CLI subcommand | moves to `@ogs-tech/press-web` bin; adopter runs `pnpm build` |
| `press upgrade` | — | **new** in `@ogs-tech/press-web` bin; adopter runs `pnpm upgrade` |
| `press deploy` | advertised in pkg description (already removed as a command) | **purged** from description + docs |

Bonus from picking `press-web`: `materialize` today lives in the CLI and resolves
the host template **cross-package** (`dev.ts:21-24` does
`require.resolve('@ogs-tech/press-web/package.json')`). Moving `materialize` into
`press-web` turns that into a **local** read — the split removes existing
coupling, it does not add it.

## 5. `press upgrade [target]` — behaviour

1. **Resolve target.** Explicit (`pnpm upgrade 0.4.0`) or, default, the latest
   published version of the engine trio (resolved via the registry, e.g.
   `npm view @ogs-tech/press-web version`). The trio (`cli`/`web`/`cms`) releases
   in **lockstep**.
2. **Rewrite the engine's exact pins** in the project:
   - root `package.json` → `@ogs-tech/press-web`
   - `packages/cms/package.json` → `@ogs-tech/press-cms`
   - *(the project no longer pins `@ogs-tech/press-cli` — the scaffolder is not a
     runtime dep, so `upgrade` does not touch it.)*
3. **`pnpm install`** — reinstall the coordinated pair.
4. **Re-materialize** the host (now a local call) — validates the new version
   materializes and re-syncs types; fails **loud** if it breaks.
5. **Print `from → to`** per package. Because the host is gitignored/ephemeral,
   the reviewable diff is `package.json` + lockfile only; the adopter's zone is
   untouched.

**Why not `pnpm update`.** The pins are **exact** by policy
(`compute-versions.ts`: "a caret on 0.x would silently admit a breaking minor").
With exact pins, `pnpm update` changes nothing — the README's current
`pnpm update @ogs-tech/press-*` is effectively a no-op. `upgrade` is the only path
that rewrites exact pins coordinately; it solves a real problem, not sugar.

## 6. Implementation changes (file-level)

**`@ogs-tech/create-press` (scaffolder — renamed + slim down):**
- `package.json` — `name` → `@ogs-tech/create-press`; `bin` → `{ "create-press":
  "bin/create-press.js" }`; `description` → `"create a press project"`; drop
  runtime deps now unused here (keep `commander`, the scaffold deps).
- `src/cli.ts` — drop the `dev`/`build` subcommands **and** the `create`
  subcommand wrapper: the package *is* the create action, so parse `<name>`
  (plus flags) directly and call `createCommand`.
- `src/commands/dev.ts`, `src/commands/build.ts`, `src/materialize.ts`, and the
  shared utils they own (`util/run.ts`, `util/wait-for-ready-or-exit.ts`,
  `util/watch-schema.ts`) — **move to `@ogs-tech/press-web`**.
- `src/create/scaffold.ts`:
  - line 26: `scripts` → `{ dev: 'press dev', build: 'press build', upgrade: 'press upgrade' }`.
  - line 28: **remove** `'@ogs-tech/press-cli': VERSIONS.pressCli` from the root
    deps (scaffolder is not a project dep).
- `src/create/compute-versions.ts` — `pressCli` pin no longer emitted into the
  scaffold; keep or drop from `VERSIONS` per usage (drift test follows).

**`@ogs-tech/press-web` (runtime — grow):**
- new bin `press` (`bin/press.{ts,js}`) with subcommands `dev` / `build` /
  `upgrade`; `package.json#bin` adds `"press"`.
- receive `materialize` + `dev` + `build` logic (cross-package resolve → local).
- new `src/commands/upgrade.ts` per §5 (target resolution, exact-pin rewrite,
  install, re-materialize, report).
- add the minimal arg-parsing dep (`commander`) here; ensure `press-web` build
  emits the bin.

**Docs / metadata:**
- `README.md` — commands table (`create` via npx; `dev`/`build`/`upgrade` as
  `pnpm` scripts); rewrite "Updating the engine" to `pnpm upgrade`; purge
  `deploy`.
- `docs/beta/roadmap.md` — note the post-Spec-3 surface revision.

## 7. Testing

- `@ogs-tech/press-web` — new `upgrade.test.ts` (exact-pin rewrite for
  web+cms; target resolution: explicit vs default-latest; zone untouched);
  migrate `dev`/`build`/`materialize` tests from the CLI package.
- `@ogs-tech/create-press` — `cli.test.ts` shrinks to the bare `create` surface
  (positional `<name>`, no subcommands); scaffold tests assert the new `upgrade`
  script and the **absence** of any `@ogs-tech/press-cli`/`@ogs-tech/create-press`
  entry in generated root deps.
- Keep the `compute-versions` drift test guarding scaffold pins.

## 8. Out of scope (YAGNI / deferred)

- **Migrations/codemods in `upgrade`** (à la `ng update`) — `upgrade` is
  re-materialize + lockstep bump only.
- **A dedicated `@ogs-tech/press-runtime` package** — revisit only if the runtime
  outgrows `press-web`.

## 9. Risks / open details

- **`press` bin ambiguity — resolved by the rename.** The scaffolder
  (`@ogs-tech/create-press`, bin `create-press`) and the runtime
  (`@ogs-tech/press-web`, bin `press`) no longer share a bin name, so there is no
  collision in any install path — project-local, `npx`, or global.
- **`upgrade` default-latest needs published packages.** Until the real npm
  publish lands, `pnpm upgrade <version>` works; default-latest needs the
  registry. Aligns with the publish milestone that motivated this revision.
- **`@ogs-tech/press-shared` stays private + contract-pure** — explicitly not the
  runtime home (§3).
