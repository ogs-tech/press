# press command-surface revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the press CLI into a run-once scaffolder (`@ogs-tech/create-press`, only `create`) and a project-local runtime (`@ogs-tech/press-web` bin exposing `dev`/`build`/`upgrade`), purge the phantom `deploy`, and add the missing `upgrade` command.

**Architecture:** The orchestration (`materialize` + `dev` + `build` + new `upgrade`) moves from the CLI into `@ogs-tech/press-web`, which already ships the host template and a `.ts` bin. The CLI is renamed to `@ogs-tech/create-press`, stripped to the bare `create` action, and removed from the generated project's dependencies. The adopter runs `pnpm dev`/`pnpm build`/`pnpm upgrade` (root `package.json` scripts → the engine's `press` bin); `pnpm create @ogs-tech/press <name>` scaffolds.

**Tech Stack:** TypeScript, commander, vitest, pnpm workspaces, turbo. `@ogs-tech/press-web` is ESM (`"type": "module"`, ships TS source, `.ts` bins via `#!/usr/bin/env tsx`); `@ogs-tech/create-press` is CommonJS (compiles to `dist/`, CJS bin launcher).

## Global Constraints

- **Engine trio releases in lockstep**; pins in generated projects are **exact** (no caret) — `compute-versions.ts` policy. `upgrade` rewrites exact pins; `pnpm update` is a no-op against them.
- **The adopter's Project zone is never touched** by `upgrade` (config, `blocks/custom/`, content, `cms/`). Only `package.json` + lockfile change.
- **`@ogs-tech/press-shared` stays `private` + contract-pure** — it is NOT the runtime home.
- **`@ogs-tech/press-web` ships TS source** (`"build": "echo …; nothing to build"`); its bins are `.ts` with `#!/usr/bin/env tsx`. Any bin it exposes needs `tsx` as a **runtime dependency** (devDeps are not installed for adopters).
- **Directory names are unchanged** — `packages/cli/` keeps its path; only the package `name` becomes `@ogs-tech/create-press` (pnpm-workspace `packages/*` glob still matches).
- Spec: `docs/superpowers/specs/2026-06-18-press-cli-command-surface-design.md`.

---

### Task 1: Relocate `materialize` + dev-only utils into `@ogs-tech/press-web` (ESM)

Copy the orchestration primitives into web, adapting CJS→ESM. The CLI keeps its
own copies until Task 5 (so the CLI stays green meanwhile); `run.ts` is
**duplicated on purpose** (both packages publish independently — `create` needs it
too).

**Files:**
- Create: `packages/web/src/util/run.ts` (copy of `packages/cli/src/util/run.ts`, unchanged)
- Create: `packages/web/src/util/wait-for-ready-or-exit.ts` (copy of CLI's, unchanged)
- Create: `packages/web/src/util/wait-for-ready-or-exit.test.ts` (copy of CLI's)
- Create: `packages/web/src/util/watch-schema.ts` (copy of CLI's, unchanged)
- Create: `packages/web/src/util/watch-schema.test.ts` (copy of CLI's)
- Create: `packages/web/src/materialize.ts` (adapted — local template, no cross-package resolve)
- Create: `packages/web/src/materialize.test.ts` (adapted to the new signature)
- Modify: `packages/web/package.json` (move `tsx` to `dependencies`)

**Interfaces:**
- Produces: `materialize(projectRoot: string): void` (writes `<projectRoot>/.press/web` from `packages/web/templates/host`); `run(cmd, args, opts?): Promise<void>`; `waitForReadyOrExit(...)`; `watchSchema(...)` — same signatures as today's CLI versions.

- [ ] **Step 1: Copy the three utils verbatim into web**

```bash
mkdir -p packages/web/src/util
cp packages/cli/src/util/run.ts packages/web/src/util/run.ts
cp packages/cli/src/util/wait-for-ready-or-exit.ts packages/web/src/util/wait-for-ready-or-exit.ts
cp packages/cli/src/util/wait-for-ready-or-exit.test.ts packages/web/src/util/wait-for-ready-or-exit.test.ts
cp packages/cli/src/util/watch-schema.ts packages/web/src/util/watch-schema.ts
cp packages/cli/src/util/watch-schema.test.ts packages/web/src/util/watch-schema.test.ts
```

These use only `node:*` + standard imports — ESM-safe as-is.

- [ ] **Step 2: Write the adapted `materialize` (local template, ESM)**

Create `packages/web/src/materialize.ts`. The template now lives in this very
package, so resolve it relative to the file instead of `createRequire`:

```ts
import { cpSync, rmSync } from 'node:fs';
import path from 'node:path';

/**
 * Regenerates `<projectRoot>/.press/web/` from this package's host template
 * (spec §4). The host lives INSIDE the project tree so Node resolution reaches
 * the root node_modules (@ogs-tech/press-web, next, react) and the adopter's
 * blocks/custom/. Engine-owned and rewritten every run, like `.next/` — never
 * hand-edited.
 */
export function materialize(projectRoot: string): void {
  const templateDir = path.join(import.meta.dirname, '..', 'templates', 'host');
  const dest = path.join(projectRoot, '.press', 'web');
  rmSync(dest, { recursive: true, force: true });
  cpSync(templateDir, dest, { recursive: true });
}
```

- [ ] **Step 3: Write the adapted `materialize` test**

Create `packages/web/src/materialize.test.ts`:

```ts
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { materialize } from './materialize';

describe('materialize', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

  it('writes .press/web from this package host template', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'press-mat-'));
    dirs.push(root);
    materialize(root);
    // The host template ships an app/ dir and next.config.ts (see templates/host).
    expect(existsSync(path.join(root, '.press', 'web', 'next.config.ts'))).toBe(true);
    expect(existsSync(path.join(root, '.press', 'web', 'app'))).toBe(true);
  });

  it('is idempotent — a second run replaces the host cleanly', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'press-mat-'));
    dirs.push(root);
    materialize(root);
    materialize(root);
    expect(existsSync(path.join(root, '.press', 'web', 'next.config.ts'))).toBe(true);
  });
});
```

- [ ] **Step 4: Move `tsx` to runtime deps in web**

In `packages/web/package.json`, remove `"tsx": "^4.19.0"` from `devDependencies`
and add it to a new/existing `dependencies` block:

```json
  "dependencies": {
    "tsx": "^4.19.0"
  },
```

(Bins are `.ts` with a `tsx` shebang; adopters get `tsx` only if it is a runtime dep.)

- [ ] **Step 5: Run web tests**

Run: `pnpm --filter @ogs-tech/press-web test`
Expected: PASS — including the new `materialize`, `wait-for-ready-or-exit`, and `watch-schema` suites.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/util packages/web/src/materialize.ts packages/web/src/materialize.test.ts packages/web/package.json
git commit -m "feat(web): relocate materialize + orchestration utils into the engine runtime"
```

---

### Task 2: Relocate `dev` + `build` commands into `@ogs-tech/press-web`

Copy the two commands into web, rewiring their imports to the now-local
`materialize`/utils and the local `sync-types` bin (ESM `import.meta.dirname`).

**Files:**
- Create: `packages/web/src/commands/dev.ts` (adapted from CLI)
- Create: `packages/web/src/commands/build.ts` (adapted from CLI)

**Interfaces:**
- Consumes: `materialize`, `run`, `waitForReadyOrExit`, `watchSchema` (Task 1).
- Produces: `devCommand(opts: { cwd: string }): Promise<void>`; `buildCommand(opts: { cwd: string }): Promise<void>`.

- [ ] **Step 1: Copy `build.ts` and adapt imports**

```bash
mkdir -p packages/web/src/commands
cp packages/cli/src/commands/build.ts packages/web/src/commands/build.ts
```

In `packages/web/src/commands/build.ts` the imports become local — change
`import { materialize } from '../materialize';` to stay `'../materialize'`
(now `packages/web/src/materialize.ts`) and `import { run } from '../util/run';`
likewise. No path change needed (same relative shape); verify they resolve.

- [ ] **Step 2: Copy `dev.ts` and rewrite the `sync-types` resolution**

```bash
cp packages/cli/src/commands/dev.ts packages/web/src/commands/dev.ts
```

In `packages/web/src/commands/dev.ts`, replace the cross-package `syncTypesScript`
helper (which used `createRequire` to find `@ogs-tech/press-web`) with a local
path, and drop the now-unused `createRequire`/`createRequire` import:

```ts
// remove: import { createRequire } from 'node:module';

function syncTypesScript(): string {
  // sync-types ships in THIS package's bin/ — resolve it locally (ESM).
  return path.join(import.meta.dirname, '..', '..', 'bin', 'sync-types.ts');
}
```

Update both call sites in `dev.ts` from `syncTypesScript(root)` to
`syncTypesScript()`. Everything else (`materialize(root)`, `run`,
`waitForReadyOrExit`, `watchSchema`) is unchanged and now resolves locally.

- [ ] **Step 3: Typecheck web**

Run: `pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS (no unresolved imports, no `__dirname` in ESM).

- [ ] **Step 4: Run web tests**

Run: `pnpm --filter @ogs-tech/press-web test`
Expected: PASS (unchanged — dev/build have no dedicated unit tests; they are exercised by the dogfood in Task 7).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/commands
git commit -m "feat(web): relocate dev + build orchestration into the engine runtime"
```

---

### Task 3: Implement the `upgrade` command in `@ogs-tech/press-web`

The new command. TDD the pure pin-rewrite core; the install/materialize
orchestration is thin I/O around it.

**Files:**
- Create: `packages/web/src/commands/upgrade.ts`
- Test: `packages/web/src/commands/upgrade.test.ts`

**Interfaces:**
- Consumes: `materialize` (Task 1), `run` (Task 1).
- Produces: `upgradeCommand(opts: { cwd: string; target?: string }): Promise<void>`; `rewritePin(manifestPath: string, dep: string, version: string): string | null`; `resolveLatest(): string`.

- [ ] **Step 1: Write the failing test for `rewritePin`**

Create `packages/web/src/commands/upgrade.test.ts`:

```ts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { rewritePin } from './upgrade';

describe('rewritePin', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

  function tmpManifest(deps: Record<string, string>): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'press-upgrade-'));
    dirs.push(dir);
    const file = path.join(dir, 'package.json');
    writeFileSync(file, JSON.stringify({ name: 'x', dependencies: deps }, null, 2) + '\n');
    return file;
  }

  it('rewrites the dep to the target and returns the previous version', () => {
    const file = tmpManifest({ '@ogs-tech/press-web': '0.3.1', next: '^15.1.0' });
    const prev = rewritePin(file, '@ogs-tech/press-web', '0.4.0');
    expect(prev).toBe('0.3.1');
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    expect(pkg.dependencies['@ogs-tech/press-web']).toBe('0.4.0');
    expect(pkg.dependencies.next).toBe('^15.1.0'); // sibling pins untouched
  });

  it('preserves 2-space JSON + trailing newline (clean diff)', () => {
    const file = tmpManifest({ '@ogs-tech/press-web': '0.3.1' });
    rewritePin(file, '@ogs-tech/press-web', '0.4.0');
    const raw = readFileSync(file, 'utf8');
    expect(raw.endsWith('}\n')).toBe(true);
    expect(raw).toContain('\n  "dependencies": {');
  });

  it('returns null and writes nothing when the dep is absent', () => {
    const file = tmpManifest({ next: '^15.1.0' });
    const before = readFileSync(file, 'utf8');
    const prev = rewritePin(file, '@ogs-tech/press-web', '0.4.0');
    expect(prev).toBeNull();
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test upgrade`
Expected: FAIL — `rewritePin` is not exported / module not found.

- [ ] **Step 3: Implement `upgrade.ts`**

Create `packages/web/src/commands/upgrade.ts`:

```ts
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { materialize } from '../materialize';
import { run } from '../util/run';

export interface UpgradeOptions {
  /** Project root (the adopter's cwd). */
  cwd: string;
  /** Explicit target version; default = latest published @ogs-tech/press-web. */
  target?: string;
}

/** The exact engine pins a generated project carries, and the manifest each lives in. */
const ENGINE_PINS = [
  { manifest: 'package.json', dep: '@ogs-tech/press-web' },
  { manifest: path.join('packages', 'cms', 'package.json'), dep: '@ogs-tech/press-cms' },
] as const;

/** Resolves the latest published version of the engine trio from the registry. */
export function resolveLatest(): string {
  const out = execFileSync('npm', ['view', '@ogs-tech/press-web', 'version'], { encoding: 'utf8' });
  return out.trim();
}

/**
 * Rewrites one manifest's exact pin for `dep` to `version`, in place, preserving
 * 2-space JSON + trailing newline. Returns the previous version, or null if the
 * dep is absent. Pure file I/O — no install, no network.
 */
export function rewritePin(manifestPath: string, dep: string, version: string): string | null {
  const pkg = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  const prev = pkg.dependencies?.[dep] ?? null;
  if (prev === null) return null;
  pkg.dependencies![dep] = version;
  writeFileSync(manifestPath, JSON.stringify(pkg, null, 2) + '\n');
  return prev;
}

/**
 * Upgrades a generated project to a new engine version (spec §5): rewrite the
 * exact pins (web + cms), reinstall, re-materialize the host to fail early, and
 * report from→to. The adopter's zone (config, blocks, content) is never touched.
 * With exact pins, `pnpm update` is a no-op — this is the only coordinated path.
 */
export async function upgradeCommand(opts: UpgradeOptions): Promise<void> {
  const root = opts.cwd;
  const target = opts.target ?? resolveLatest();
  console.log(`> press upgrade → ${target}`);

  const changes: Array<{ dep: string; from: string; to: string }> = [];
  for (const { manifest, dep } of ENGINE_PINS) {
    const from = rewritePin(path.join(root, manifest), dep, target);
    if (from === null) {
      console.warn(`  (skip ${dep}: not pinned in ${manifest})`);
      continue;
    }
    changes.push({ dep, from, to: target });
  }
  if (changes.length === 0) {
    throw new Error('press upgrade: no @ogs-tech/press-* pins found — is this a press project?');
  }

  console.log('> pnpm install');
  await run('pnpm', ['install'], { cwd: root });

  console.log('> re-materialize .press/web (validates the new engine)');
  materialize(root);

  console.log('\npress upgrade complete:');
  for (const c of changes) console.log(`  ${c.dep}  ${c.from} → ${c.to}`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test upgrade`
Expected: PASS — all three `rewritePin` cases green.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/commands/upgrade.ts packages/web/src/commands/upgrade.test.ts
git commit -m "feat(web): add press upgrade (exact-pin lockstep bump + re-materialize)"
```

---

### Task 4: Expose the `press` runtime bin + `runtime-cli` in `@ogs-tech/press-web`

Wire `dev`/`build`/`upgrade` behind a testable program and a `.ts` bin, mirroring
the CLI's `buildProgram`/`run` pattern.

**Files:**
- Create: `packages/web/src/runtime-cli.ts`
- Create: `packages/web/bin/press.ts`
- Test: `packages/web/src/runtime-cli.test.ts`
- Modify: `packages/web/package.json` (add `commander` dep; add `press` bin)

**Interfaces:**
- Consumes: `devCommand`, `buildCommand` (Task 2), `upgradeCommand` (Task 3).
- Produces: bin `press` (subcommands `dev`/`build`/`upgrade`); `buildProgram(): Command`; `run(argv: string[]): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/runtime-cli.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildProgram } from './runtime-cli';

describe('runtime buildProgram', () => {
  it('exposes dev, build, and upgrade in --help', () => {
    const program = buildProgram();
    program.exitOverride();
    let out = '';
    program.configureOutput({ writeOut: (s) => (out += s), writeErr: (s) => (out += s) });
    expect(() => program.parse(['node', 'press', '--help'])).toThrow();
    for (const cmd of ['dev', 'build', 'upgrade']) {
      expect(out).toContain(cmd);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test runtime-cli`
Expected: FAIL — `runtime-cli` module not found.

- [ ] **Step 3: Implement `runtime-cli.ts`**

Create `packages/web/src/runtime-cli.ts`:

```ts
import { Command } from 'commander';
import { buildCommand } from './commands/build';
import { devCommand } from './commands/dev';
import { upgradeCommand } from './commands/upgrade';

/** Builds the press runtime program (dev/build/upgrade), extracted for testability. */
export function buildProgram(): Command {
  const program = new Command();
  program.name('press').description('press runtime — dev / build / upgrade the press stack');

  program
    .command('dev')
    .description('Boot the whole stack (cms + web) for development')
    .action(() => devCommand({ cwd: process.cwd() }));

  program
    .command('build')
    .description('Build deployable artifacts for cms + web')
    .action(() => buildCommand({ cwd: process.cwd() }));

  program
    .command('upgrade')
    .argument('[target]', 'engine version to upgrade to (default: latest)')
    .description('Bump @ogs-tech/press-* to the target, reinstall, and re-materialize')
    .action((target?: string) => upgradeCommand({ cwd: process.cwd(), target }));

  return program;
}

export async function run(argv: string[]): Promise<void> {
  await buildProgram().parseAsync(argv);
}
```

- [ ] **Step 4: Write the bin launcher**

Create `packages/web/bin/press.ts`:

```ts
#!/usr/bin/env tsx
import { run } from '../src/runtime-cli';

run(process.argv).catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
```

- [ ] **Step 5: Register the bin + commander dep**

In `packages/web/package.json`:
- change `"bin"` to:

```json
  "bin": {
    "press": "./bin/press.ts",
    "press-sync-types": "./bin/sync-types.ts"
  },
```

- add `"commander": "^13.0.0"` to `dependencies` (alongside `tsx` from Task 1):

```json
  "dependencies": {
    "commander": "^13.0.0",
    "tsx": "^4.19.0"
  },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test runtime-cli`
Expected: PASS — `dev`, `build`, `upgrade` present in help.

- [ ] **Step 7: Smoke the bin end-to-end**

Run: `pnpm install && pnpm --filter @ogs-tech/press-web exec press --help`
Expected: prints the runtime help listing `dev`, `build`, `upgrade` (proves the `tsx` shebang + bin registration resolve).

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/runtime-cli.ts packages/web/src/runtime-cli.test.ts packages/web/bin/press.ts packages/web/package.json
git commit -m "feat(web): expose the press runtime bin (dev/build/upgrade)"
```

---

### Task 5: Rename CLI → `@ogs-tech/create-press`, strip to `create`-only

Remove the now-relocated runtime from the CLI, collapse it to the bare `create`
action, and rename the package + bin.

**Files:**
- Modify: `packages/cli/src/cli.ts` (create-only)
- Modify: `packages/cli/src/cli.test.ts`
- Delete: `packages/cli/src/commands/dev.ts`, `packages/cli/src/commands/build.ts`, `packages/cli/src/materialize.ts`, `packages/cli/src/materialize.test.ts`, `packages/cli/src/util/wait-for-ready-or-exit.ts`, `packages/cli/src/util/wait-for-ready-or-exit.test.ts`, `packages/cli/src/util/watch-schema.ts`, `packages/cli/src/util/watch-schema.test.ts`
- Keep: `packages/cli/src/util/run.ts` (`create` still uses it)
- Rename: `packages/cli/bin/press.js` → `packages/cli/bin/create-press.js`
- Modify: `packages/cli/package.json` (name, bin, description, deps)

**Interfaces:**
- Produces: package `@ogs-tech/create-press`, bin `create-press`; `buildProgram()` taking a `<name>` positional; `run(argv)`.

- [ ] **Step 1: Rewrite `cli.ts` to create-only**

Replace `packages/cli/src/cli.ts` with:

```ts
import { Command } from 'commander';
import pkg from '../package.json';
import { createCommand } from './commands/create';

/** Builds the create-press program — scaffold is the package's default action. */
export function buildProgram(): Command {
  const program = new Command();
  program
    .name('create-press')
    .description('Scaffold a new press project (ultra-thin Project zone)')
    .version(pkg.version)
    .argument('<name>', 'project directory to scaffold')
    .action((name: string) => createCommand({ name }));
  return program;
}

export async function run(argv: string[]): Promise<void> {
  await buildProgram().parseAsync(argv);
}
```

- [ ] **Step 2: Update `cli.test.ts`**

Replace `packages/cli/src/cli.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { buildProgram } from './cli';

describe('create-press buildProgram', () => {
  it('takes a <name> argument and exposes no dev/build subcommands', () => {
    const program = buildProgram();
    program.exitOverride();
    let out = '';
    program.configureOutput({ writeOut: (s) => (out += s), writeErr: (s) => (out += s) });
    expect(() => program.parse(['node', 'create-press', '--help'])).toThrow();
    expect(out).toContain('<name>');
    expect(out).not.toContain('dev');
    expect(out).not.toContain('build');
  });

  it('reports the package version', () => {
    const program = buildProgram();
    program.exitOverride();
    let out = '';
    program.configureOutput({ writeOut: (s) => (out += s) });
    expect(() => program.parse(['node', 'create-press', '--version'])).toThrow();
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
```

- [ ] **Step 3: Delete the relocated files from the CLI**

```bash
git rm packages/cli/src/commands/dev.ts packages/cli/src/commands/build.ts \
  packages/cli/src/materialize.ts packages/cli/src/materialize.test.ts \
  packages/cli/src/util/wait-for-ready-or-exit.ts packages/cli/src/util/wait-for-ready-or-exit.test.ts \
  packages/cli/src/util/watch-schema.ts packages/cli/src/util/watch-schema.test.ts
```

- [ ] **Step 4: Rename the bin launcher**

```bash
git mv packages/cli/bin/press.js packages/cli/bin/create-press.js
```

Content is unchanged (`require('../dist/cli.js').run(process.argv)…`).

- [ ] **Step 5: Update `packages/cli/package.json`**

- `"name": "@ogs-tech/press-cli"` → `"name": "@ogs-tech/create-press"`
- `"description"` → `"Scaffold a new press project (ultra-thin Project zone)"`
- `"bin": { "press": "bin/press.js" }` → `"bin": { "create-press": "bin/create-press.js" }`
- Move `"tsx"` from `dependencies` to `devDependencies` (only `gen:versions`/build use it now; adopters run the compiled CJS bin). Keep `"commander"` in `dependencies`.

- [ ] **Step 6: Build + test the CLI**

Run: `pnpm --filter @ogs-tech/create-press build && pnpm --filter @ogs-tech/create-press test`
Expected: PASS — `tsc` compiles `dist/cli.js` (no dangling imports of the deleted files); `cli.test.ts` + `scaffold`/`compute-versions`/`publish-readiness` suites green (the latter two are touched in Task 6).

- [ ] **Step 7: Commit**

```bash
git add packages/cli
git commit -m "refactor(cli)!: rename @ogs-tech/press-cli → @ogs-tech/create-press, strip to create-only"
```

---

### Task 6: Update scaffold output + publish-readiness for the new surface

The generated project drops the CLI dep, gains an `upgrade` script; the
publishable set learns the new name.

**Files:**
- Modify: `packages/cli/src/create/scaffold.ts:26,28`
- Modify: `packages/cli/src/create/scaffold.test.ts`
- Modify: `packages/cli/src/publish/publish-readiness.ts`
- Modify: `packages/cli/src/publish/publish-readiness.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: generated root `package.json` with `scripts.{dev,build,upgrade}` and **no** `@ogs-tech/press-cli` / `@ogs-tech/create-press` dependency; `PUBLISHABLE_PACKAGES` containing `@ogs-tech/create-press`.

- [ ] **Step 1: Add the `upgrade` script in the scaffold**

In `packages/cli/src/create/scaffold.ts`, change line 26:

```ts
        scripts: { dev: 'press dev', build: 'press build', upgrade: 'press upgrade' },
```

- [ ] **Step 2: Remove the CLI dependency from the generated root**

In `packages/cli/src/create/scaffold.ts`, delete the line (≈28):

```ts
          '@ogs-tech/press-cli': VERSIONS.pressCli,
```

`@ogs-tech/press-web` (which now ships the `press` bin) stays as the root dep that
provides `press dev`/`build`/`upgrade`.

- [ ] **Step 3: Update the scaffold test**

In `packages/cli/src/create/scaffold.test.ts`, find the assertions on the root
`package.json` and update them to: (a) assert `scripts.upgrade === 'press upgrade'`
(plus existing `dev`/`build`); (b) assert **neither** `@ogs-tech/press-cli` nor
`@ogs-tech/create-press` appears in `dependencies`; (c) keep the existing
`@ogs-tech/press-web` dependency assertion. If the current test asserts
`root.dependencies['@ogs-tech/press-cli']` (per the publish-pipeline plan),
**replace** that with the absence assertion:

```ts
expect(root.dependencies['@ogs-tech/press-cli']).toBeUndefined();
expect(root.dependencies['@ogs-tech/create-press']).toBeUndefined();
expect(root.dependencies['@ogs-tech/press-web']).toBeDefined();
expect(root.scripts.upgrade).toBe('press upgrade');
```

- [ ] **Step 4: Rename in `PUBLISHABLE_PACKAGES`**

In `packages/cli/src/publish/publish-readiness.ts`, change:

```ts
export const PUBLISHABLE_PACKAGES = ['@ogs-tech/create-press', '@ogs-tech/press-web', '@ogs-tech/press-cms'] as const;
```

- [ ] **Step 5: Update the publish-readiness test**

In `packages/cli/src/publish/publish-readiness.test.ts`, update any literal
`'@ogs-tech/press-cli'` in the expected publishable set to
`'@ogs-tech/create-press'`. (Search the file for `press-cli` and replace the set
member; leave `press-web`/`press-cms` as-is.)

- [ ] **Step 6: Run the CLI test suite**

Run: `pnpm --filter @ogs-tech/create-press test`
Expected: PASS — scaffold + publish-readiness suites green.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/create packages/cli/src/publish
git commit -m "feat(cli): scaffold writes pnpm upgrade + drops the scaffolder dep; rename publishable set"
```

---

### Task 7: Rewire repo-internal dogfood + maintainer tooling

The monorepo's own scripts referenced the old name / old `materialize` location.
Fix them and regenerate the committed dogfood from the new scaffolder as an
end-to-end check.

**Files:**
- Modify: `scripts/upgrade-playground.ts:14` (materialize import)
- Modify: `scripts/create-playground.ts:62` (rewire list)
- Modify: `package.json:15` (version-packages filter)
- Modify: `packages/cli/scripts/gen-versions.ts` (filter name in docstrings/stale message)
- Modify: `apps/playground/package.json` (add `upgrade` script)
- Regenerate: `apps/playground/**` via `pnpm play:create`

- [ ] **Step 1: Repoint the playground upgrade script to web's materialize**

In `scripts/upgrade-playground.ts` line 14:

```ts
import { materialize } from '../packages/web/src/materialize';
```

`materialize(root)` is still the call (the `resolveFrom` option was removed in
Task 1) — no other change.

- [ ] **Step 2: Drop the CLI from the playground rewire list**

In `scripts/create-playground.ts` line 62, the generated root no longer carries a
`@ogs-tech/press-cli` dependency, so rewire only what it actually emits:

```ts
rewireToWorkspace(path.join(staged, 'package.json'), ['@ogs-tech/press-web']);
```

- [ ] **Step 3: Update the `version-packages` filter to the new name**

In root `package.json` line 15:

```json
    "version-packages": "changeset version && pnpm --filter @ogs-tech/create-press gen:versions && git add -A",
```

- [ ] **Step 4: Update `gen-versions.ts` filter references**

In `packages/cli/scripts/gen-versions.ts`, replace `@ogs-tech/press-cli` with
`@ogs-tech/create-press` in the usage docstrings (lines ≈7–8) and the stale-file
error message (line ≈35) so copy-pasted commands resolve.

- [ ] **Step 5: Add the `upgrade` script to the committed playground**

In `apps/playground/package.json`, extend `scripts`:

```json
    "dev": "press dev",
    "build": "press build",
    "upgrade": "press upgrade"
```

- [ ] **Step 6: Regenerate the dogfood from the new scaffolder + relink**

Run:
```bash
pnpm install            # relink workspace after the package rename
pnpm play:create        # regenerate apps/playground from the REAL scaffold
```
Expected: completes with no `@ogs-tech/press-cli` reference; `apps/playground/package.json` shows `scripts.{dev,build,upgrade}` and no scaffolder dependency.

- [ ] **Step 7: Boot the dogfood to prove the relocated runtime works**

Run: `pnpm play` (Ctrl-C once both are up)
Expected: `press dev` (now the web bin) materializes `.press/web`, seeds, boots cms `:1337` + web `:3000`, and prints `press dev ready`. This is the integration test for Tasks 1–4.

- [ ] **Step 8: Commit**

```bash
git add scripts package.json packages/cli/scripts/gen-versions.ts apps/playground
git commit -m "chore: rewire dogfood + maintainer tooling for the scaffolder/runtime split"
```

---

### Task 8: Update docs + full-repo verification

Purge `deploy`, document the new invocation, and prove the whole workspace is green.

**Files:**
- Modify: `README.md`
- Modify: `docs/beta/roadmap.md`

- [ ] **Step 1: Update the README command surface**

In `README.md`:
- Quickstart/Install: `npx @ogs-tech/press-cli create my-site` → `pnpm create @ogs-tech/press my-site`.
- Commands table: rows for `pnpm create @ogs-tech/press <name>` (scaffold, `@ogs-tech/create-press`), `pnpm dev`, `pnpm build`, and a new `pnpm upgrade [version]` row — "Bump `@ogs-tech/press-*` to the target in lockstep, reinstall, and re-materialize the host." Remove any `deploy` reference.
- "Updating the engine" section: replace the manual `pnpm update @ogs-tech/press-*` block (a no-op against exact pins) with:

```bash
pnpm upgrade            # latest engine
pnpm upgrade 0.4.0      # a specific version
```

- "Repository internals": line 133 `@ogs-tech/press-cli` → `@ogs-tech/create-press` (describe it as the run-once scaffolder); line 149 test filter → `pnpm --filter @ogs-tech/create-press test`.

- [ ] **Step 2: Note the surface revision in the roadmap**

In `docs/beta/roadmap.md`, add a short note under Spec 3 (or a "Post-beta surface revision" line): the CLI was split into `@ogs-tech/create-press` (scaffold) + the `@ogs-tech/press-web` runtime bin (`dev`/`build`/`upgrade`); `deploy` was purged from the package description; see `docs/superpowers/specs/2026-06-18-press-cli-command-surface-design.md`.

- [ ] **Step 3: Full build + typecheck + test across the workspace**

Run:
```bash
pnpm build
pnpm -r typecheck
pnpm -r test
```
Expected: all PASS. No package imports a deleted CLI file; `@ogs-tech/create-press` compiles; `@ogs-tech/press-web` ships the runtime bin.

- [ ] **Step 4: Publish dry-run (pack:check)**

Run: `pnpm pack:check`
Expected: would-publish tarballs for `@ogs-tech/create-press`, `@ogs-tech/press-web`, `@ogs-tech/press-cms`; `@ogs-tech/press-shared` skipped (private); no `workspace:` spec leaks into any published manifest.

- [ ] **Step 5: Grep for stragglers**

Run: `grep -rn "press-cli\|press deploy\|press dev / build / deploy" --include="*.ts" --include="*.json" --include="*.md" . --exclude-dir=node_modules --exclude-dir=dist | grep -v "docs/superpowers/plans/2026-06-18-press-npm-publish" | grep -v "docs/superpowers/specs/2026-06-18-press-npm-publish"`
Expected: no hits in **live** code/config/README (historical publish-pipeline plan/spec docs are dated records and may keep the old name).

- [ ] **Step 6: Commit**

```bash
git add README.md docs/beta/roadmap.md
git commit -m "docs: document scaffolder/runtime split + upgrade; purge deploy"
```

---

## Self-Review

**1. Spec coverage:**
- §3.1 scaffolder/runtime split + rename → Tasks 1–5 (relocate) + Task 5 (rename). ✓
- §3.2 root scripts → engine bin → Task 4 (bin) + Task 6 (scaffold scripts). ✓
- §3.3 `upgrade` = re-materialize + lockstep bump → Task 3. ✓
- §3.4 dev/build retained → Task 2. ✓
- §4 CLI removed from project deps → Task 6 Step 2. ✓
- §5 upgrade behaviour (resolve target, rewrite exact pins web+cms, install, re-materialize, report) → Task 3 code. ✓
- §6 file-level changes (cli.ts, scaffold, package.json, README, roadmap) → Tasks 5–8. ✓
- Purge `deploy` → Task 5 (description) + Task 8 (README). ✓
- §9 bin ambiguity resolved by rename → Task 5 (bin `create-press` vs `press`). ✓

**2. Placeholder scan:** New files (`materialize.ts`, `upgrade.ts`, `runtime-cli.ts`, `bin/press.ts`, `cli.ts`, all tests) carry full code. Edit steps that defer to "find the assertion" (Task 6 Step 3/5, Task 8 docs) name the exact file, literal, and replacement — mechanical, not vague.

**3. Type consistency:** `materialize(projectRoot: string)` (Task 1) is called identically in `dev`/`build` (Task 2), `upgrade` (Task 3), and `scripts/upgrade-playground.ts` (Task 7). `rewritePin`/`resolveLatest`/`upgradeCommand` signatures (Task 3) match their use in `runtime-cli.ts` (Task 4). `buildProgram`/`run` mirror the established CLI pattern. `@ogs-tech/create-press` is used identically across package name (Task 5), `PUBLISHABLE_PACKAGES` (Task 6), `version-packages`/`gen:versions` filters (Task 7), and README (Task 8).
