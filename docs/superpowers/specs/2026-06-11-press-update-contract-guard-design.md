---
title: "Spec — Update path + CI contract guard (Spec 4)"
internal_name: press-cli
relates_to: docs/beta/prd.md
roadmap: docs/beta/roadmap.md
status: Design approved
created_at: 2026-06-11
updated_at: 2026-06-11
---

# Spec — Update path + CI contract guard (Spec 4)

> [!NOTE]
> Spec 4 of the press beta. Depends on Spec 0 (Strapi-as-dependency, done) and
> Spec 1 (`@press/web` + type-sync, done). It is the spec that **answers Q2** —
> the differentiating promise. Specs 0–2 *established* the contract (CMS blocks,
> front-end render, config boundary); Spec 4 proves that contract **survives a
> real update cycle**, and wires that proof into CI so a leak is a red build, not
> a discovery in production. See [roadmap.md](../../beta/roadmap.md) Spec 4.

**TL;DR** — Turn the one-off local `contract-check` into a **standing CI contract
guard** that runs a *real* engine update cycle (vN → vN+1, both `@press/cms` and
`@press/web`, published to an ephemeral Verdaccio) and fails on any of the three
**leak classes**: a Project-zone file changed on disk, the host stops booting, or
the adopter's blocks/config stop rendering. The **update path** the adopter runs
is the minimal form the PRD mandates — `pnpm update @press/*` + boot — no new
command. The guard fires automatically on every PR that touches `packages/**`.

## 1. The question (single anchor)

> Does the non-breakage contract **survive a real update cycle**, automatically
> and on every engine change — i.e. a project on `@press/*` vN that builds, boots
> and renders keeps doing so after `pnpm update @press/* → vN+1`, with the
> Project zone untouched, and would CI catch it the moment it didn't?

This is **PRD §3 Q2** verbatim ("Does the non-breakage contract survive a real
update cycle?") — the one the PRD says "makes press different from a scaffold; if
it fails, the product concept fails, not just the release." Spec 0 exercised the
cycle once, by hand, for `@press/cms` only. Spec 4 makes it **continuous**,
**both-package**, and **render-deep**.

## 2. Scope decisions (2026-06-11)

Four product/scope decisions, taken before design:

1. **Update path = the minimal form (`bump + boot`), no command.** The adopter
   runs `pnpm update @press/*` and boots. PRD §6 calls this "the minimal form
   [that] must work"; PRD §9 left `press upgrade` open. Decision: **no upgrade
   command in the beta.** The CLI surface belongs to Spec 3 (`create / dev /
   build / deploy`) and deliberately omits `upgrade`. Spec 4 is therefore **pure
   verification + CI**, not a feature surface. A future `press upgrade` is
   post-beta (§9 out-of-scope).
2. **Guard breadth = disk + boot + render.** After the simulated update the guard
   re-runs the **full end-to-end render** (custom block still renders, whitelabel
   `<head>` still correct), not just the disk-delta + boot of today's
   `contract-check`. This is the only way to catch the **behavioral leak**
   (§5) — the Q2 failure mode the file/boot checks are blind to.
3. **Both engine packages.** The cycle publishes and updates **both**
   `@press/cms` (consumed by `apps/cms`) and `@press/web` (consumed by
   `apps/web`). The front-end is where Spec 1 said the contract most likely
   leaks (blocks/types); a guard that only bumps the CMS leaves half the contract
   unprotected.
4. **Trigger = `packages/**` PRs + manual dispatch, on GitHub Actions.** The
   contract can only leak when the **engine** changes; PRs touching only `docs/`
   or `apps/**` (the adopter layer) cannot break the promise and don't pay the
   guard's cost. Manual `workflow_dispatch` is available for on-demand runs.

## 3. Stack & runtime

Carried over; nothing here justifies diverging. Node 20 LTS, pnpm 10 workspaces +
Turborepo, Strapi 5 (`apps/cms`), Next 15 (`apps/web`). New infrastructure: a
**GitHub Actions** workflow (`.github/workflows/` — does not exist yet) and an
**ephemeral Verdaccio** (`verdaccio@6.7.2`, already pinned, config at
`verdaccio/config.yaml`, helper at `scripts/registry.sh`) spun up **inside the CI
job** — never an external registry. PRD §9's open "how is the engine delivered"
is **not** answered here; the guard proves non-breakage against a registry, and
which registry hosts the private beta packages is a separate, later decision.

## 4. Architecture — the guard as a composable contract harness

The guard is **not** a new monolith. It is a thin orchestrator that composes the
single-purpose checks already in `scripts/`, mirroring the engine's own "thin
orchestrator + `lib/`" restructure. Today's pieces:

| Existing script | Single purpose | Reused as |
| --- | --- | --- |
| `contract-check.mjs` | clean tree → update → allowed-delta → build → boot | **File-leak + boot-leak** check (generalized to both packages) |
| `assert-no-engine-in-host.mjs` | host `src/` holds only extension points | **Engine-in-host** check (unchanged) |
| `e2e-check.mjs` | seeded page renders blocks + whitelabel `<head>` | **Behavioral-leak** check (run *after* the update) |
| `seed-e2e.mjs` | seed a `Page` with `press.hero` + `custom.callout` | Precondition for the render check |
| `registry.sh` | start/stop local Verdaccio | Ephemeral registry in CI |

Spec 4 adds one orchestrator (`scripts/contract-guard.mjs`) that sequences these
into one real update cycle, and one workflow that runs it in CI.

### 4.1 What "an update cycle" means in CI — two versions, by construction

Q2 demands a **real** update: you cannot test "update" with a single version. The
guard always materializes two:

- **Baseline `vN`** — the last released engine, built **from its git tag** (the
  working tree's HEAD code is not vN once HEAD has moved on).
- **Candidate `vN+1`** — the engine at **HEAD**, the code under review.

Both are built and `npm publish`ed to the ephemeral Verdaccio. A throwaway
adopter checkout pinned at `vN` then runs `pnpm update @press/* → vN+1` — exactly
the command the real adopter runs — and the guard asserts the contract held.

**Version selection (decided).** The candidate is published at HEAD's
`package.json` version. If that equals the baseline (a `packages/**` PR that
didn't bump the version — common mid-development), the guard republishes the HEAD
code under a synthetic strictly-greater prerelease,
`X.Y.Z-contract.<shortsha>`, so the update is *always* `baseline-code →
HEAD-code` with a resolvable higher version. **The code delta is always real even
when the version wasn't manually bumped** — the guard never silently degrades
into the no-op "old == new" cycle that proves nothing.

### 4.2 The harness flow (`scripts/contract-guard.mjs`)

```
1. start ephemeral Verdaccio (registry.sh start)        # reuse, CI-local
2. resolve baseline tag  -> vN                           # §4.3
3. build engine @ tag    -> publish @press/cms@vN, @press/web@vN
4. build engine @ HEAD   -> publish @press/{cms,web}@vN+1   # synthetic if needed
5. stage adopter @ vN: pin apps/{cms,web} to vN, install from Verdaccio,
   seed, build, boot, render  -> assert GREEN baseline (project really works @ vN)
6. commit-clean snapshot; pnpm update @press/* -> vN+1   # THE update path
7. assert FILE leak:  only apps/{cms,web}/package.json dep lines + lockfile moved
8. assert ENGINE-IN-HOST: host src/ still only extension points
9. rebuild + boot:    assert BOOT leak none
10. re-seed + e2e:     assert BEHAVIORAL leak none (blocks + <head> still render)
11. teardown Verdaccio; non-zero exit on ANY assertion
```

Step 5 — proving the project is **green at the baseline before updating** — is
not ceremony: it distinguishes "the update broke it" from "it was already
broken," so a guard failure is always attributable to the update alone (the same
discipline `contract-check`'s clean-tree precondition enforces today).

**Correctness note carried from Spec 0:** a Strapi boot-204 is a *false pass* for
Dynamic-Zone components — Strapi 5.48 defers DZ component validation to
entry-creation time. So steps 5 and 10 must **seed and render a real entry**
carrying `press.hero` + `custom.callout` (which `seed-e2e.mjs` + `e2e-check.mjs`
already do), not merely hit `/_health`. Boot-smoke alone would let a missing
reference-block component sail through.

### 4.3 Baseline source = release tags; bootstrap path

The baseline `vN` is built from the **last engine release tag** (e.g.
`@press/cms@0.3.2`, or a unified `engine-v0.3.2`). This couples the guard to a
small **release discipline**: cutting an engine version means tagging it. That is
a deliberate, low-cost obligation — without a tag there is no vN to update *from*.

**Bootstrap (no prior tag).** On a repo with no engine tag yet (today's state —
packages are local, unpublished, untagged), the guard cannot fetch a historical
baseline. It self-bootstraps: it treats **HEAD as the baseline** and publishes the
candidate as the synthetic `X.Y.Z-contract.<shortsha>` prerelease (§4.1). This
first run is a **degenerate cycle** (baseline code == candidate code) that proves
the *harness* end-to-end but not a *regression*; it is explicitly logged as such
(`BOOTSTRAP: no baseline tag, harness-only run`). Real regression coverage begins
at the first run that has a prior tag to diff against. The first real release tag
is created as part of this spec's Definition of Done.

### 4.4 Generalizing the allowed delta

`contract-check.mjs` today hardcodes `ALLOWED_FILES = {apps/cms/package.json,
pnpm-lock.yaml}` and updates only `@press/cms`. The orchestrator generalizes the
allowed delta to **both** adopter manifests plus the lockfile —
`{apps/cms/package.json, apps/web/package.json, pnpm-lock.yaml}` — and asserts the
only *meaningful* line change inside each manifest is the `@press/*` version
range (the existing per-line `@press/` regex, applied to both). Everything else is
a file leak. The single-purpose checks stay single-purpose; only the orchestrator
knows about "both packages."

## 5. The leak taxonomy (explicit principle)

A stated rule, because it is the spine of the guard's coverage and of Q2 itself:

| Class | Definition | Caught by | New in Spec 4? |
| --- | --- | --- | --- |
| **File leak** | A Project-zone file changed on disk after the update | allowed-delta + engine-in-host | No (Spec 0 had it, CMS-only → now both packages) |
| **Boot leak** | The host builds but does not boot after the update | boot smoke | No (Spec 0 had it, CMS-only) |
| **Behavioral leak** | Host boots, disk clean, but the adopter's custom block or whitelabel `<head>` **stops rendering** | seeded e2e render | **Yes** — the leak class Spec 0 was blind to |

The behavioral leak is the dangerous one precisely because it is **invisible to
the on-disk and boot checks**: vN+1 compiles, boots, leaves the Project zone
byte-identical, and silently renders nothing where the adopter's block used to be.
That is a non-breakage failure by the PRD §4 definition ("still builds, boots, and
deploys") and it is exactly the surface Spec 1 flagged as most leak-prone.

## 6. The CI workflow (GitHub Actions)

`.github/workflows/contract-guard.yml`:

- **Triggers:** `pull_request` filtered to `paths: ['packages/**']`, plus
  `workflow_dispatch` (manual). Not on `docs/**`/`apps/**`-only PRs (§2.4).
- **Runner:** Linux, Node 20 (matching `engines`), pnpm 10 via `packageManager`.
  Caches the pnpm store; the heavy cost (two engine builds + Strapi + Next) is
  accepted because the trigger is gated.
- **Steps:** checkout (full history + tags, for the baseline build) → setup
  Node/pnpm → `node scripts/contract-guard.mjs` (self-contained: starts/stops its
  own Verdaccio, builds both versions, runs the cycle) → upload boot/build logs as
  an artifact on failure.
- **Required check:** the workflow is a **required status check** on `main`, so a
  red guard **blocks merge**. A contract leak cannot land.

The guard is **self-contained in one script** so it is runnable identically
**locally** (`node scripts/contract-guard.mjs`) and in CI — CI just provides the
trigger and the gate. This keeps the "reproduce it on your laptop" property the
prior specs valued.

## 7. Acceptance criteria — testable

1. **Real update cycle is green, both packages, render-deep.** From a clean
   adopter checkout pinned at engine `vN`, `node scripts/contract-guard.mjs`
   publishes `vN` and `vN+1` of **both** `@press/cms` and `@press/web` to an
   ephemeral Verdaccio, runs `pnpm update @press/* → vN+1`, and passes all three
   leak classes: no file leak, host boots, **and** a seeded page still renders
   `press.hero` + `custom.callout` and the whitelabel `<head>`. Exit 0.
2. **The guard actually catches a leak (negative test).** A deliberately
   regressed candidate `vN+1` — a `@press/web` change that drops the custom-block
   render path — makes the guard **fail loud** at the behavioral-leak step with a
   clear message and a **non-zero exit**, while disk and boot checks pass. Proves
   the guard catches what Spec 0's checks could not, on the front-end surface
   Spec 1 named.
3. **CI runs it, gated, as a required check.** `.github/workflows/contract-guard.yml`
   runs on `packages/**` PRs and `workflow_dispatch`, is a required status check
   on `main` (red guard blocks merge), and depends on **no external registry** —
   Verdaccio is created and torn down within the job. A `docs/`-only PR does **not**
   trigger it.
4. **Bootstrap is handled and honest.** With no prior engine tag, the guard runs
   the bootstrap (harness-only) cycle, logs `BOOTSTRAP: …` explicitly, and exits
   0 — never silently passing a degenerate cycle off as regression coverage. After
   the first real release tag exists, a subsequent run diffs against it.
5. **Locally reproducible.** The same `scripts/contract-guard.mjs` runs on a
   developer machine and reproduces 1–2 from a clean state; a README section
   documents the command and the three leak classes.

## 8. Definition of done

`scripts/contract-guard.mjs` composes the existing checks into one real,
both-package, render-deep update cycle against ephemeral Verdaccio;
`.github/workflows/contract-guard.yml` runs it on `packages/**` PRs + manual
dispatch and is wired as a required check on `main`; all §7 acceptance criteria
pass, including the negative test (AC2); the first engine **release tag** is cut so
the guard has a non-bootstrap baseline going forward; the README documents the
update path (`pnpm update @press/*` + boot), the guard command, and the leak
taxonomy. `contract-check.mjs`'s CMS-only logic is folded into the generalized
orchestrator (no duplicated, divergent contract logic left behind).

## 9. Out of scope (deferred)

- **`press upgrade` command / assisted migration** — PRD §9 open question;
  post-beta. The beta update path is `pnpm update @press/*` + boot (§2.1).
- **Which registry ships the private beta packages** (PRD §9 "how is the engine
  delivered") — the guard proves non-breakage against *a* registry (Verdaccio);
  choosing the real private registry/distribution is a separate decision.
- **Cross-major-version migration** — the PRD scopes non-breakage to "within the
  same major" (§4). Major-bump migration is not a beta promise.
- **External-adopter update runs** (Phase 0/1 gate "≥3 external adopters complete
  ≥1 update cycle") — that is a *rollout* milestone measured in the field; Spec 4
  delivers the *mechanism* that makes those runs verifiable.
- **Performance budget / CI runtime optimization** beyond pnpm-store caching —
  acceptable cost given the `packages/**` trigger gate; revisit only if it blocks
  the team.

## 10. Risks & stop signals

| Risk | Signal | Response |
| --- | --- | --- |
| Two engine builds + Strapi + Next blow the CI runner's time/memory budget | Guard job times out or OOMs | Trigger is already gated to `packages/**`; cache the pnpm store; if still over budget, split baseline/candidate builds into parallel jobs or move to a larger runner. Do **not** drop the render step — that is the point. |
| Ephemeral Verdaccio is flaky in CI (publish/install races) | Intermittent red on `npm publish`/`pnpm update` | Pin `verdaccio@6.7.2` (already), health-gate startup (registry.sh loops on `:4873`), publish serially, fail fast with the Verdaccio log uploaded as an artifact. |
| No release tag exists, so the guard can only bootstrap | Guard logs `BOOTSTRAP` indefinitely; never diffs a real baseline | DoD cuts the first real tag. After that, absence of a tag on a release is itself the defect — surface it loudly, don't paper over it. |
| A `packages/**` PR doesn't bump the engine version | Update would be a no-op `old == old` | Synthetic `X.Y.Z-contract.<shortsha>` candidate guarantees a real code delta regardless of version bump (§4.1). |
| Boot-204 false-passes a missing Dynamic-Zone component | Guard green but a reference block silently 500s on entry creation | Steps 5 & 10 seed and render a real entry (Spec 0 lesson), not `/_health` alone — a missing DZ component fails the render check. |
| The guard's contract logic drifts from the (still-present) `contract-check.mjs` | Two sources of "what's an allowed delta," disagreeing | Fold `contract-check` into the orchestrator; one definition of the allowed delta, both packages, no divergent copy. |

## 11. Results

- **Outcome:** PASS. `scripts/contract-guard.mjs` runs a real both-package,
  render-deep update cycle against an ephemeral Verdaccio it starts/stops itself.
- **AC1 (real cycle green):** with the `engine-v0.3.2` baseline, both `@press/cms`
  and `@press/web` are published as baseline + candidate, the adopter is staged at
  the baseline, `pnpm update @press/*` runs, and the seeded page renders `press.hero`
  + `custom.callout` + the whitelabel `<head>` at both versions. `CONTRACT HELD`,
  exit 0.
- **AC2 (catches a leak):** dropping the custom-block render path in `@press/web`
  (uncommitted) is published only as the candidate; the baseline stays green, the
  file + boot checks pass, and the **post-update** render fails with
  `E2E FAIL: callout message missing from HTML`, exit 1. Reverting restores green —
  a clean RED/GREEN pair on identical shipped code.
- **AC3 (CI gated/required):** `.github/workflows/contract-guard.yml` runs on
  `packages/**` PRs + `workflow_dispatch`, Node 20 / pnpm 10, full history + tags,
  Verdaccio in-job; `guard` is to be enabled as a required check on `main`.
- **AC4 (bootstrap honest):** the first pre-tag run logged `BOOTSTRAP …` and exited 0.
- **AC5 (local repro):** `node scripts/contract-guard.mjs` reproduces the cycle from a
  clean tree; re-runs are robust.
- **First release tag:** `engine-v0.3.2` (`@press/cms@0.3.2` + `@press/web@0.1.0`).
- **`contract-check.mjs`:** removed; its allowed-delta logic is subsumed by the
  generalized guard (one source of truth, both packages).

### Implementation deltas vs. §4 (decided during execution)

- **Content-addressed publish labels.** §4.1's candidate was `X.Y.Z-contract.<shortsha>`.
  An uncommitted edit does not change the commit sha, so on a re-run the candidate
  collided with a prior tarball and was silently reused — masking the AC2 regression.
  Labels are now keyed on a hash of the engine **source** (`X.Y.Z-base.<srcHash>` /
  `X.Y.Z-contract.<srcHash>`): always distinct artifacts, always a fresh tarball, never
  a stale reuse. This also removes the need to mutate a shared registry (unpublish).
- **`pregenerateTypes` before publishing.** `@press/web/src/types/generated.ts` is
  gitignored, so a fresh checkout (and every published tarball) lacked it and the
  baseline build failed on the missing `CustomCallout` export. The guard now runs
  `sync-types` to disk before any publish; the clean-tag worktree reuses that file.
- **Clean-tree baseline.** The fast path (build baseline from HEAD) is taken only when
  the engine tree is clean; a dirty `packages/` (the AC2 regression) falls through to a
  pristine tag worktree so the regression is tested as vN+1, never leaked into vN.
- **Re-run hygiene (local only; CI is fresh per run):** clear `apps/web/.next` before
  each build (incremental cache is keyed by source path, not engine version) and kill
  any orphaned web server on `:3000` (`e2e-check` leaks it on assertion failure via
  `process.exit` skipping its `finally`).
- **Date:** 2026-06-12.
