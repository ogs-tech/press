# BASE/CLI — tracked follow-ups (2026-07-11)

Surfaced by the BASE/CLI closing review. These are **not** blockers for closing
the CRM task — the DONE criteria are met (see the review summary). They are the
robustness/cleanup gaps we consciously deferred. Each is independently shippable
as its own PR (do not bundle — separate concerns).

The task-closing PR fixed only the two "truthful failure" defects:
- CI `gen:versions --check` gate made real (wrong `--filter` name + step ordered
  after `pnpm build`, which regenerated the file before the check could see drift).
- `press build` now surfaces the subprocess's real exit code (`SubprocessError`
  in `util/run.ts` + `bin/press.ts`), matching `dev.ts`.

---

## 1. End-to-end + orchestration tests

**Gap.** The two most important commands — `devCommand` (`packages/web/src/commands/dev.ts`)
and `buildCommand` (`build.ts`) — have **no direct tests**. Their primitives
(`waitForReadyOrExit`, `watchSchema`, `materialize`, `run`) are well covered, but
the orchestration itself (6-step boot sequence, `killAll`, SIGINT/SIGTERM
handlers, the `cms.exit`/`web.exit` race, the `shuttingDown` flag) is validated
only by manual `pnpm dev` dogfooding. Likewise, `@ogs-tech/create-press` has no
test that runs the **published binary** (`bin/create-press.js` → `dist/cli.js` →
real `pnpm install`); `scaffold()` is tested in isolation and only exercised from
TS source via `scripts/create-playground.ts`.

**Do.**
- Unit-level orchestration tests for `dev.ts`/`build.ts` by injecting a spawn/`run`
  seam (mock children like `wait-for-ready-or-exit.test.ts`'s `FakeChild`): assert
  the boot order, that a cms crash aborts before booting web, that SIGINT exits 0,
  and that an unexpected child exit re-exits with its real code.
- A Playwright/e2e smoke (already named as planned in the root README): scaffold a
  temp project via the built binary, `press dev`, assert `:1337` + `:3000` serve
  and `shared/types/generated.ts` is written.

**Acceptance.** `dev.ts`/`build.ts` have coverage; a CI smoke boots a scaffolded
project end-to-end.

## 2. Documentation drift + dead code

**Gap.**
- **`press.config.ts` naming.** CLAUDE.md and the README describe build-time
  anchors as living in `press.config.ts` at the repo root, but the scaffold emits
  `packages/web/config.ts` (its header comment even says `// press.config.ts`).
  No generated file is literally named/located `press.config.ts`. There is also a
  stray `press.config.ts` at this monorepo's root with no functional link to the
  CLI. Harmless, but it misleads anyone auditing literally.
- **`VERSIONS.pressCli` dead field.** Computed and tested in `compute-versions.ts`
  but never consumed by `scaffold.ts` (a scaffolded project never depends on
  `@ogs-tech/create-press`, by design).
- **Stale `packages/cli/dist/`.** Contains artifacts from a prior architecture
  (`dist/commands/{dev,build,deploy}.js`, `dist/materialize.js`, …) with no `src/`
  counterpart. `dist/` is gitignored so publish is unaffected, but it confuses a
  manual `node bin/create-press.js` without a fresh rebuild.

**Do.** Reconcile the docs to the real path (or rename the emitted file — decide
which is canonical); drop `pressCli` from `ScaffoldVersions` (or wire it if a use
appears); note that `dist/` must be rebuilt before manual bin inspection.

**Acceptance.** Docs match the scaffold output; no computed-but-unused version field.

## 3. Derive `NEXT_PIN` instead of hardcoding

**Gap.** `compute-versions.ts:41` hardcodes `NEXT_PIN = '^15.1.0'` — the only
scaffold pin not derived from a real manifest (react/strapi come from engine
`devDependencies`; the follow-up is already noted in-code). `@ogs-tech/press-web`
declares only an open `next: '>=15'` peer range, useless as a pin.

**Do.** Add `next` to `@ogs-tech/press-web` `devDependencies` (the version the
engine is actually tested against) and derive the pin via `requireDevDep`, exactly
like react/strapi. Removes the last manual knob and closes the drift loop for Next.

**Acceptance.** `computeVersions` derives `next` from a manifest; no `NEXT_PIN`
constant.
