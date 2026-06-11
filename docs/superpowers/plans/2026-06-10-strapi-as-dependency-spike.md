---
title: "Plan — Strapi-as-dependency spike (@press/cms)"
internal_name: press-cli
relates_to: docs/superpowers/specs/2026-06-10-strapi-as-dependency-spike-design.md
status: Ready to execute
created_at: 2026-06-10
updated_at: 2026-06-10
---

# Strapi-as-dependency Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that Strapi 5 can ship as a versioned, updatable dependency (`@press/cms`) consumed by a thin owned host, such that `pnpm update @press/cms` upgrades the engine — content-types **and** Dynamic-Zone blocks — without touching the adopter's Project zone.

**Architecture:** A pnpm + Turborepo monorepo with two zones across a hard boundary: `packages/press-cms` (the engine — a Strapi plugin, versioned, published to a local Verdaccio registry) and `apps/cms` (the host — the thinnest bootable Strapi app, adopter-owned). The spike develops the engine against a fast `workspace:*` link, then runs the actual non-breakage proof against Verdaccio with real semver resolution. The one genuine unknown — can a plugin deliver Dynamic-Zone components from `node_modules`? — is resolved empirically in Task 4 (the §6 T1 pivot) before anything downstream is committed.

**Tech Stack:** Strapi `5.48.0` (pinned), pnpm `10.x` workspaces, Turborepo `2.x`, TypeScript, Node 20 LTS, SQLite (spike DB), Verdaccio `6.x` (local registry), `@strapi/sdk-plugin` (plugin scaffold).

**Spec → task map (self-review, §coverage):**

| Spec item | Task(s) |
| --- | --- |
| §4 Stack pin (Strapi 5.x, pnpm+Turbo, TS, Node 20) | T0, T1 |
| §5.1 `@press/cms` engine skeleton | T3 |
| §5.2 `apps/cms` thin host skeleton | T1, T2 |
| §5.3 / §6 T1 — A vs B pivot (components from plugin) | **T4** |
| §6 T2 — boot 100% from dependency | T5, T6 |
| §6 T3 — custom block in Project zone | T7 |
| §6 T4 / §7 — update loop vN→vN+1 via Verdaccio | T5, T9 |
| §8 Acceptance criteria (allowed delta, builds, boots, deploy doc) | T8, T9 |
| §9 Contract test (reusable) | T8 |
| §12 Definition of done + §13 Results | T10 |

**The A/B/C decision lives in Task 4.** Tasks 5–10 are written to be path-agnostic: they consume whatever Task 4 produces (`@press/cms` either auto-injects components via its `register` lifecycle [A], or exports `createPressCms()` [B]). Task 4 ends by recording the decision in the spec's §13 Results stub so later tasks — and the executor — know which path is live.

---

## Conventions used in every task

- **Run from the repo root** (`/Users/odenirgomes/Projects/ogs-tech/internal/press-cli`) unless a step says otherwise. Avoid `cd` in compound commands.
- **Pinned versions, no carets, for the spike.** A floating range could swap Strapi 5.x mid-spike and poison the result (spec §4, §11). Pin exact.
- **Commit after every green step.** Frequent commits; conventional-commit messages.
- **The host (`apps/cms`) is sacred.** Outside the two designated extension points (`config/plugins.ts` enabling the engine, and `src/components/custom/`), nothing the engine needs may land in the host. If you find yourself editing the host to make the engine work, that is the contract leak the spike exists to detect — stop and record it (Task 4 / Task 9).

---

## Task 0: Bootstrap the monorepo skeleton

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.npmrc`
- Create: `.gitignore`
- Create: `.nvmrc`

- [ ] **Step 1: Confirm toolchain**

Run:
```bash
node -v && pnpm -v && npx --version
```
Expected: Node `v20.x`, pnpm `10.x`, npx present. If Node is not 20.x, switch with `nvm use 20` before continuing.

- [ ] **Step 2: Create `.nvmrc`**

Create `.nvmrc`:
```
20
```

- [ ] **Step 3: Create the root `package.json`**

Create `package.json`:
```json
{
  "name": "press-monorepo",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@10.28.2",
  "engines": {
    "node": ">=20.0.0 <21.0.0"
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "cms:dev": "pnpm --filter cms develop",
    "cms:build": "pnpm --filter cms build",
    "cms:start": "pnpm --filter cms start"
  },
  "devDependencies": {
    "turbo": "2.9.18"
  }
}
```

- [ ] **Step 4: Create `pnpm-workspace.yaml`**

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 5: Create `.npmrc` (Strapi-on-pnpm hoisting)**

Create `.npmrc`:
```
# Strapi expects a flat, npm-like node_modules. node-linker=hoisted gives that
# under pnpm and is the most reliable layout for Strapi 5 (spec §4 stack pin).
node-linker=hoisted
# Strapi peer-dep graph is wide; let pnpm satisfy peers automatically.
auto-install-peers=true
strict-peer-dependencies=false
```

> Why `node-linker=hoisted`: Strapi's module resolution and its admin bundler assume a hoisted layout. The default pnpm symlinked store frequently breaks Strapi's plugin discovery and `@strapi/*` peer resolution. Hoisting trades some isolation for a working CMS — the right call for a CMS-centric monorepo. The Verdaccio scope line is added later (Task 5), not now, so nothing tries to resolve `@press/*` from a registry that isn't running yet.

- [ ] **Step 6: Create `turbo.json`**

Create `turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".strapi/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 7: Create `.gitignore`**

Create `.gitignore`:
```
node_modules/
.turbo/
dist/
build/
.strapi/
.cache/
*.log
.env
.env.*
!.env.example
.tmp/
*.db
*.sqlite
.verdaccio/
.DS_Store
```

- [ ] **Step 8: Install and verify the empty workspace resolves**

Run:
```bash
pnpm install
```
Expected: completes, writes `pnpm-lock.yaml`, installs `turbo`. No workspace packages yet — that is fine.

Run:
```bash
pnpm exec turbo --version
```
Expected: prints `2.9.18`.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .npmrc .gitignore .nvmrc pnpm-lock.yaml
git commit -m "chore: bootstrap pnpm + turborepo monorepo skeleton"
```

---

## Task 1: Scaffold the thin host `apps/cms` and prove a baseline boot

**Files:**
- Create: `apps/cms/**` (Strapi 5 app, scaffolded)
- Modify: `apps/cms/package.json` (rename, pin Strapi)
- Create: `apps/cms/.env.example`

**Goal of this task:** a *standard* Strapi 5 app that boots on its own. We trim it into a thin host in Task 2. Proving a vanilla boot first isolates "is my toolchain sane?" from "does the engine-as-dependency idea work?".

- [ ] **Step 1: Scaffold Strapi 5 (pinned), no nested install, no example**

Run:
```bash
npx create-strapi@5.48.0 apps/cms \
  --no-run --skip-cloud --no-git-init --no-install \
  --use-pnpm --typescript --dbclient sqlite --no-example
```
If the CLI still prompts interactively, answer: **no** example app, **skip** Strapi Cloud login, **no** telemetry, TypeScript **yes**, database **sqlite**. The result is a self-contained Strapi app under `apps/cms/`.

- [ ] **Step 2: Make it a workspace member with a stable name and pinned engine**

Open `apps/cms/package.json`. Set the package `name` to `cms` (so `pnpm --filter cms ...` works) and pin Strapi exactly. Replace the `name` field and the three `@strapi/*` dependency ranges:

```jsonc
{
  "name": "cms",
  // ...
  "dependencies": {
    "@strapi/strapi": "5.48.0",
    "@strapi/plugin-users-permissions": "5.48.0",
    "@strapi/plugin-cloud": "5.48.0"
    // ...keep the rest (react, better-sqlite3, styled-components, etc.) as scaffolded
  }
}
```
> Exact pins (no `^`) satisfy spec §4 and §11: a Strapi 5.49 or 6.0 landing mid-spike must not change what boots.

- [ ] **Step 3: Install at the workspace root**

Run:
```bash
pnpm install
```
Expected: `apps/cms` now resolves as workspace member `cms`; install completes under the hoisted linker.

- [ ] **Step 4: Create `.env.example` and a working `.env`**

Create `apps/cms/.env.example`:
```
HOST=0.0.0.0
PORT=1337
APP_KEYS=toBeModified1,toBeModified2
API_TOKEN_SALT=toBeModified
ADMIN_JWT_SECRET=toBeModified
TRANSFER_TOKEN_SALT=toBeModified
JWT_SECRET=toBeModified
ENCRYPTION_KEY=toBeModified
```
Then create the real `apps/cms/.env` by copying it and filling random secrets:
```bash
cp apps/cms/.env.example apps/cms/.env
node -e "const c=require('crypto');const k=['APP_KEYS','API_TOKEN_SALT','ADMIN_JWT_SECRET','TRANSFER_TOKEN_SALT','JWT_SECRET','ENCRYPTION_KEY'];const fs=require('fs');let e=fs.readFileSync('apps/cms/.env','utf8');for(const key of k){const v=key==='APP_KEYS'?[0,0].map(()=>c.randomBytes(16).toString('base64')).join(','):c.randomBytes(16).toString('base64');e=e.replace(new RegExp('^'+key+'=.*$','m'),key+'='+v);}fs.writeFileSync('apps/cms/.env',e);console.log('secrets written');"
```
Expected: prints `secrets written`. (`.env` is gitignored; `.env.example` is committed.)

- [ ] **Step 5: Build the host (baseline)**

Run:
```bash
pnpm --filter cms build
```
Expected: Strapi builds the admin panel and TS server; exits 0. First build is slow (minutes) — that is normal.

- [ ] **Step 6: Boot smoke test the host (baseline)**

Run (background-friendly; boots, probes health, stops):
```bash
( pnpm --filter cms start & SP=$!; \
  for i in $(seq 1 60); do \
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health || true); \
    if [ "$code" = "204" ]; then echo "BOOT OK ($code)"; break; fi; \
    sleep 2; \
  done; \
  kill $SP 2>/dev/null )
```
Expected: prints `BOOT OK (204)`. Strapi exposes `/_health` → `204 No Content` once the server is up. If it never reaches 204 within 120s, debug the toolchain now (use `superpowers:systematic-debugging`) — do not proceed.

- [ ] **Step 7: Commit**

```bash
git add apps/cms package.json pnpm-lock.yaml
git commit -m "feat(cms): scaffold pinned Strapi 5 host with baseline boot"
```

---

## Task 2: Trim `apps/cms` into the thin host shape (Project zone)

**Files:**
- Modify: `apps/cms/src/index.ts` (empty register/bootstrap)
- Create: `apps/cms/config/plugins.ts` (engine enable point — empty for now)
- Create: `apps/cms/src/components/custom/.gitkeep` (custom-block extension point)
- Create: `apps/cms/press.config.ts` (whitelabel placeholder, Project zone)

**Goal:** establish the exact Project-zone layout from spec §5.2, so the contract test (Task 8) has a precise surface to watch.

- [ ] **Step 1: Make `src/index.ts` an empty, owned lifecycle**

Replace `apps/cms/src/index.ts` with:
```typescript
// apps/cms/src/index.ts — Project zone.
// The host owns an INTENTIONALLY EMPTY lifecycle. All engine behavior ships
// from @press/cms. If anything engine-related ever has to be added here, that is
// a contract leak (spec §8).
export default {
  register(/* { strapi } */) {},
  bootstrap(/* { strapi } */) {},
};
```

- [ ] **Step 2: Create the engine-enable point `config/plugins.ts` (empty placeholder)**

Create `apps/cms/config/plugins.ts`:
```typescript
// apps/cms/config/plugins.ts — Project zone, STABLE.
// The single line the adopter ever needs to enable the press engine.
// Left empty until Task 3 wires @press/cms; kept as a file so the contract
// snapshot tracks it from the start.
export default ({ env }: { env: (key: string, def?: unknown) => unknown }) => ({
  // 'press-cms' enabled in Task 3
});
```

- [ ] **Step 3: Create the custom-block extension point**

Create `apps/cms/src/components/custom/.gitkeep`:
```
# Project zone — adopter custom blocks live here (spec §5.2 mapping note).
# A Strapi component placed here registers under category "custom".
```

- [ ] **Step 4: Create the whitelabel placeholder**

Create `apps/cms/press.config.ts`:
```typescript
// apps/cms/press.config.ts — Project zone (whitelabel; spec §10 placeholder only).
// Full whitelabel resolution is spec 2. Here it exists solely so the contract
// snapshot includes it and proves an engine update never rewrites it.
export default {
  brand: {
    name: "Acme Press Site",
  },
};
```

- [ ] **Step 5: Re-boot to confirm the trim didn't break the host**

Run the boot smoke from Task 1 Step 6 again.
Expected: `BOOT OK (204)`.

- [ ] **Step 6: Commit**

```bash
git add apps/cms/src/index.ts apps/cms/config/plugins.ts apps/cms/src/components/custom/.gitkeep apps/cms/press.config.ts
git commit -m "feat(cms): establish thin-host Project-zone layout and extension points"
```

---

## Task 3: Scaffold the `@press/cms` engine plugin and ship a base content-type

**Files:**
- Create: `packages/press-cms/**` (plugin, scaffolded with `@strapi/sdk-plugin`)
- Modify: `packages/press-cms/package.json` (name `@press/cms`, version `0.1.0`)
- Create: `packages/press-cms/server/src/content-types/page/schema.json` (base `page` with a Dynamic Zone)
- Modify: `apps/cms/config/plugins.ts` (enable engine via workspace link)
- Modify: `apps/cms/package.json` (add `@press/cms: workspace:*`)

**Goal:** the engine ships a `page` content-type with a Dynamic Zone, consumed by the host through a fast `workspace:*` link. This proves the *content-type* half of the contract (the documented, low-risk half) and sets up Task 4's component experiment.

- [ ] **Step 1: Scaffold the plugin**

Run:
```bash
npx @strapi/sdk-plugin@latest init packages/press-cms
```
Answer prompts: plugin name `press-cms`, description `press engine`, author your name, license `MIT`, register with Strapi **no** (we wire it manually), TypeScript **yes**, editorconfig/eslint/prettier as you like. This scaffolds `strapi-server`, `server/`, `admin/`, and a `package.json`.

- [ ] **Step 2: Rename to the published name and pin the version**

Open `packages/press-cms/package.json`. Set:
```jsonc
{
  "name": "@press/cms",
  "version": "0.1.0",
  // sdk-plugin sets a "strapi" block — ensure the plugin's internal name:
  "strapi": {
    "kind": "plugin",
    "name": "press-cms",
    "displayName": "Press CMS",
    "description": "press engine — content-types and reference blocks"
  }
  // keep "exports", "files", "scripts" (build/watch via strapi-plugin) as scaffolded
}
```
> The npm package is `@press/cms`; the *Strapi plugin id* is `press-cms`. The host enables it by the plugin id with an explicit `resolve` to the package (Step 6), because `@press/cms` does not match Strapi's `strapi-plugin-*` auto-discovery prefix.

- [ ] **Step 3: Define the base `page` content-type with a Dynamic Zone**

Create `packages/press-cms/server/src/content-types/page/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "pages",
  "info": {
    "singularName": "page",
    "pluralName": "pages",
    "displayName": "Page",
    "description": "Base page provided by the press engine"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "title": {
      "type": "string",
      "required": true
    },
    "slug": {
      "type": "uid",
      "targetField": "title"
    },
    "body": {
      "type": "dynamiczone",
      "components": ["press.hero"]
    }
  }
}
```
> `press.hero` (a reference block) does not exist yet — Task 4 is where we discover whether the engine can supply it. Booting now will surface exactly the "missing component" failure that Task 4 resolves; that is intentional and informative, not a mistake.

- [ ] **Step 4: Register the content-type in the plugin server entry**

Open the plugin's server content-types index (scaffold path is typically `packages/press-cms/server/src/content-types/index.ts`). Set it to export the `page` schema:
```typescript
// packages/press-cms/server/src/content-types/index.ts
import page from "./page/schema.json";

export default {
  page: { schema: page },
};
```
Confirm the plugin's `server/src/index.ts` (or `strapi-server` entry) wires `content-types` through (the sdk-plugin scaffold already imports `./content-types`). If not, ensure it exports `contentTypes` from this module.

- [ ] **Step 5: Build the plugin and link it into the host**

Add the dependency to `apps/cms/package.json` dependencies:
```jsonc
"@press/cms": "workspace:*"
```
Then:
```bash
pnpm --filter @press/cms build
pnpm install
```
Expected: plugin builds to `packages/press-cms/dist`; `pnpm install` links `@press/cms` into `apps/cms`.

> **Why `workspace:*` here and not Verdaccio:** this is the engine *development* link — instant rebuilds, no publish step. Spec §7 rejects `workspace:*` only for the *update proof* because a symlink skips semver resolution. We switch to Verdaccio for the proof in Task 5. Developing against the link first is standard and keeps iteration tight.

- [ ] **Step 6: Enable the engine in the host (the one owned line)**

Replace `apps/cms/config/plugins.ts` body:
```typescript
// apps/cms/config/plugins.ts — Project zone, STABLE.
export default ({ env }: { env: (key: string, def?: unknown) => unknown }) => ({
  "press-cms": {
    enabled: true,
    resolve: "@press/cms",
  },
});
```

- [ ] **Step 7: Boot and verify the content-type appears**

Run the boot smoke from Task 1 Step 6.
Expected at this stage: boot may **fail or warn** that component `press.hero` is unknown (no component yet). That is the expected pre-Task-4 state. If instead it boots `204`, even better — verify the `Page` content-type is present:
```bash
( pnpm --filter cms start & SP=$!; sleep 25; \
  curl -s http://localhost:1337/_health -o /dev/null -w "health:%{http_code}\n"; \
  kill $SP 2>/dev/null )
```
Record what happened (boots vs. complains about the missing component) — it is the input to Task 4.

- [ ] **Step 8: Commit**

```bash
git add packages/press-cms apps/cms/config/plugins.ts apps/cms/package.json pnpm-lock.yaml
git commit -m "feat(press-cms): engine plugin ships base Page content-type with dynamic zone"
```

---

## Task 4: T1 — The pivot. Can the engine deliver Dynamic-Zone components? (A vs B vs C)

**This is the gate (spec §5.3, §6 T1).** Everything after depends on its outcome. The task is an ordered experiment: try the cheapest viable mechanism first, falsify fast, escalate. Each candidate has concrete code and a concrete pass/fail check. Timebox the whole task; if all of A1/A2/B fail, you have hit stop-signal **C** and the spike's answer is "no" — which is itself a valid Definition-of-Done outcome (spec §12).

**Files (candidate A, the primary path):**
- Create: `packages/press-cms/server/src/components/hero.json` (reference block schema, engine-owned)
- Create/Modify: `packages/press-cms/server/src/register.ts` (programmatic component injection)
- Modify: `packages/press-cms/server/src/index.ts` (wire `register`)

**Files (candidate B, the fallback):**
- Create: `packages/press-cms/server/src/create-press-cms.ts` (`createStrapi` wrapper)
- Modify: `apps/cms/src/index.ts` is NOT touched; instead a `~5-line` entry under the host's allowed boot file is used (decided in Step 5 if B is reached)

### Candidate A1 — declarative component in the plugin (fastest falsification)

- [ ] **Step 1: Add the reference block schema inside the engine**

Create `packages/press-cms/server/src/components/hero.json`:
```json
{
  "collectionName": "components_press_heroes",
  "info": {
    "displayName": "Hero",
    "description": "Reference hero block shipped by the press engine"
  },
  "options": {},
  "attributes": {
    "heading": { "type": "string", "required": true },
    "subheading": { "type": "string" },
    "ctaLabel": { "type": "string" }
  }
}
```

- [ ] **Step 2: Probe whether Strapi auto-loads it from the plugin**

Rebuild the plugin and boot:
```bash
pnpm --filter @press/cms build && pnpm install
( pnpm --filter cms start & SP=$!; \
  for i in $(seq 1 40); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health||true); [ "$c" = "204" ] && { echo "BOOT OK"; break; }; sleep 2; done; \
  kill $SP 2>/dev/null )
```
**Pass criterion for A1:** boots `204` AND the `press.hero` component is registered (verify in Step 4). Given the docs (no declarative plugin-component API), **A1 is expected to fail** — Strapi will not find `press.hero` because it only scans the *app's* `src/components`. Confirm the failure mode, then move to A2. (If A1 unexpectedly works, skip to Step 4 to verify, then jump to "Record the decision".)

### Candidate A2 — programmatic injection in the plugin's `register` lifecycle (primary real path)

- [ ] **Step 3: Inject the component into `strapi.components` during `register`**

Create `packages/press-cms/server/src/register.ts`:
```typescript
// packages/press-cms/server/src/register.ts
// Engine register lifecycle. Strapi has no declarative plugin-component API, so
// the engine injects its reference blocks into strapi.components at register
// time — BEFORE content-types resolve their dynamic-zone component references.
// This keeps the host a standard Strapi app (path A advantage) while shipping
// blocks from node_modules.
import type { Core } from "@strapi/strapi";
import heroSchema from "./components/hero.json";

type RawComponent = {
  category: string;
  schema: Record<string, unknown>;
};

// One place to declare every engine reference block.
const ENGINE_COMPONENTS: RawComponent[] = [
  { category: "press", schema: { ...heroSchema, info: { ...(heroSchema as any).info, name: "hero" } } },
];

export default ({ strapi }: { strapi: Core.Strapi }) => {
  for (const { category, schema } of ENGINE_COMPONENTS) {
    const displayName = (schema as any).info?.displayName ?? "Component";
    const name = (schema as any).info?.name ?? displayName.toLowerCase();
    const uid = `${category}.${name}`;

    // Build the component entry the same shape Strapi's component loader produces.
    const modelName = name;
    const globalId = `Component${category[0].toUpperCase()}${category.slice(1)}${displayName.replace(/\s+/g, "")}`;

    (strapi.components as Record<string, unknown>)[uid] = {
      ...schema,
      uid,
      category,
      modelName,
      globalId,
      modelType: "component",
      collectionName: (schema as any).collectionName,
      attributes: (schema as any).attributes,
      __schema__: schema,
    };

    strapi.log.info(`[press-cms] injected engine component '${uid}'`);
  }
};
```

- [ ] **Step 4: Wire `register` into the plugin server entry and boot**

Ensure `packages/press-cms/server/src/index.ts` imports and exports the register hook:
```typescript
// packages/press-cms/server/src/index.ts (merge with scaffold)
import register from "./register";
import contentTypes from "./content-types";

export default {
  register,
  contentTypes,
};
```
Then rebuild + boot, and verify the component is present via the Content-Type Builder's components API:
```bash
pnpm --filter @press/cms build && pnpm install
( pnpm --filter cms start & SP=$!; \
  for i in $(seq 1 40); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health||true); [ "$c" = "204" ] && break; sleep 2; done; \
  echo "--- component-categories ---"; \
  curl -s http://localhost:1337/content-type-builder/component-categories -o /dev/null -w "cats:%{http_code}\n"; \
  kill $SP 2>/dev/null )
```
**Pass criterion for A2 (this is the spec's "primary path A"):**
1. Boot reaches `204`.
2. The startup log shows `[press-cms] injected engine component 'press.hero'`.
3. The `page` content-type's Dynamic Zone resolves `press.hero` without error (no "unknown component" boot failure).
4. **Admin check (manual, required by §6 T2):** open `http://localhost:1337/admin`, create the first admin user, open **Content Manager → Page → Create**, and confirm the `body` Dynamic Zone offers the **Hero** block and an entry can be saved.

If A2 passes, **path A is confirmed** → record the decision and proceed to Task 5.

If A2 fails (component never registers, or the dynamic zone still rejects it, or admin doesn't surface it), proceed to candidate B.

### Candidate B — programmatic boot wrapper (`createPressCms`)

- [ ] **Step 5: Implement the `createStrapi` wrapper**

Create `packages/press-cms/server/src/create-press-cms.ts`:
```typescript
// packages/press-cms/server/src/create-press-cms.ts
// Fallback path B (spec §5.3): the engine wraps createStrapi and injects engine
// content-types AND components in memory before start(). The host shrinks to a
// ~5-line entry that calls this. More deterministic than register-time mutation,
// but it fights the standard Strapi CLI — adopted only if A2 fails.
import { createStrapi, type Core } from "@strapi/strapi";
import heroSchema from "./components/hero.json";
import pageSchema from "./content-types/page/schema.json";

export function createPressCms(opts?: Parameters<typeof createStrapi>[0]): Core.Strapi {
  const app = createStrapi(opts);

  // Inject before the load phase wires dynamic zones.
  const inject = () => {
    (app.components as Record<string, unknown>)["press.hero"] = {
      ...heroSchema,
      uid: "press.hero",
      category: "press",
      modelName: "hero",
      modelType: "component",
      attributes: (heroSchema as any).attributes,
    };
    (app.contentTypes as Record<string, unknown>)["plugin::press-cms.page"] = {
      ...pageSchema,
      uid: "plugin::press-cms.page",
    };
  };

  // Hook the earliest available lifecycle. If app exposes a pre-register hook use
  // it; otherwise wrap load(). The exact seam is part of this experiment.
  const originalLoad = app.load.bind(app);
  app.load = async (...args: unknown[]) => {
    inject();
    // @ts-expect-error pass-through
    return originalLoad(...args);
  };

  return app;
}
```

- [ ] **Step 6: Add the ~5-line host entry and boot via the wrapper**

If B is the live path, the host boots through a tiny owned entry instead of the standard CLI. Create `apps/cms/src/main.ts`:
```typescript
// apps/cms/src/main.ts — Project zone, ~5 lines, STABLE across updates (path B).
import { createPressCms } from "@press/cms/boot";

createPressCms({ distDir: "./dist" }).start();
```
Add a `boot` export to `packages/press-cms/package.json` `exports` map pointing at the built `create-press-cms` module, then boot with `node apps/cms/dist/main.js` after a build.

**Pass criterion for B:** same four checks as A2 Step 4 (boots, components present, dynamic zone resolves, admin surfaces Hero), achieved through the wrapper with the host entry ≤ ~5 lines and no engine schema in the host `src/`.

### Decision and stop-signal

- [ ] **Step 7: Resolve A / B / C and record it in the spec**

Decision rule:
- A2 passed → **Path A** (primary). Host stays a standard Strapi app; engine injects via `register`.
- A2 failed, B passed → **Path B** (fallback). Host uses the `createPressCms` entry.
- Both failed → **Stop signal C** (spec §11): reference blocks cannot leave the owned host without a structural leak. This is a *valid* spike conclusion — the framework's Q2 is answered "no as specced".

Append the decision to the spec's §13 Results stub. Open `docs/superpowers/specs/2026-06-10-strapi-as-dependency-spike-design.md`, replace the §13 placeholder line with:
```markdown
## 13. Results

- **Strapi pin:** `5.48.0` (spec §4, §11).
- **T1 / pivot decision:** Path <A | B | C-stop>. Evidence: <one line — e.g. "A2: register-time strapi.components injection surfaces press.hero in the Page dynamic zone; admin renders and saves it.">
- **Date:** 2026-06-10.
- _(Acceptance evidence appended in Task 9 / Task 10.)_
```

- [ ] **Step 8: Commit (and STOP here if path C)**

```bash
git add packages/press-cms apps/cms docs/superpowers/specs/2026-06-10-strapi-as-dependency-spike-design.md pnpm-lock.yaml
git commit -m "feat(press-cms): resolve T1 pivot — engine ships dynamic-zone components (path <A|B>)"
```
If the decision is **C**, the spike is *done* with a negative result: skip Tasks 5–9, go straight to Task 10 to write up the stop signal and evidence (spec §12 second branch).

---

## Task 5: Stand up Verdaccio and publish `@press/cms@0.1.0`

**Files:**
- Create: `verdaccio/config.yaml` (local registry config)
- Modify: `.npmrc` (route `@press` scope to Verdaccio)
- Create: `scripts/registry.sh` (start/stop helpers)

**Goal:** replace the `workspace:*` link with a *real* dependency resolved from a local registry, so `pnpm update` exercises true semver + lockfile behavior (spec §7).

- [ ] **Step 1: Create a Verdaccio config**

Create `verdaccio/config.yaml`:
```yaml
storage: ../.verdaccio/storage
auth:
  htpasswd:
    file: ../.verdaccio/htpasswd
    max_users: 1000
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  "@press/*":
    access: $all
    publish: $all
    unpublish: $all
    # no proxy: engine packages are local-only for the spike
  "**":
    access: $all
    publish: $authenticated
    proxy: npmjs
log:
  type: stdout
  format: pretty
  level: warn
```

- [ ] **Step 2: Start Verdaccio in the background**

Run:
```bash
npx verdaccio@6.7.2 --config verdaccio/config.yaml &
sleep 5
curl -s -o /dev/null -w "verdaccio:%{http_code}\n" http://localhost:4873/
```
Expected: `verdaccio:200`.

- [ ] **Step 3: Create a publish user and capture an auth token**

Run:
```bash
npx npm-cli-login -u press -p press -e press@example.com -r http://localhost:4873 || \
  curl -s -XPUT -H "Content-type:application/json" \
  -d '{"name":"press","password":"press"}' \
  http://localhost:4873/-/user/org.couchdb.user:press
```
Expected: a token/created response. (Either tool registers the local user.)

- [ ] **Step 4: Route the `@press` scope to Verdaccio**

Append to `.npmrc`:
```
@press:registry=http://localhost:4873
//localhost:4873/:_authToken=fake-token-replaced-below
```
Then write the real token (from the user you just created) — easiest is:
```bash
npm --registry http://localhost:4873 whoami 2>/dev/null || true
npm config set //localhost:4873/:_authToken "$(curl -s -XPUT -H 'Content-type:application/json' -d '{"name":"press","password":"press"}' http://localhost:4873/-/user/org.couchdb.user:press | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).token))")" --location project
```
Expected: `.npmrc` now has a usable `_authToken` for `localhost:4873`.

- [ ] **Step 5: Publish `@press/cms@0.1.0`**

Run:
```bash
pnpm --filter @press/cms build
cd packages/press-cms && npm publish --registry http://localhost:4873 ; cd -
```
Expected: `+ @press/cms@0.1.0`. Verify:
```bash
curl -s http://localhost:4873/@press%2fcms | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('versions:',Object.keys(JSON.parse(s).versions||{})))"
```
Expected: `versions: [ '0.1.0' ]`.

- [ ] **Step 6: Switch the host off the workspace link onto the real version**

In `apps/cms/package.json`, change the dependency from `"@press/cms": "workspace:*"` to:
```jsonc
"@press/cms": "0.1.0"
```
Then resolve from Verdaccio:
```bash
pnpm install
```
Expected: `@press/cms@0.1.0` installed from `localhost:4873` (check `pnpm-lock.yaml` shows the `localhost:4873` resolution). This is the configuration the contract loop runs against.

- [ ] **Step 7: Re-boot from the published dependency (spec §6 T2 final form)**

Run the boot smoke (Task 1 Step 6) plus the admin Dynamic-Zone check from Task 4 Step 4.
Expected: `BOOT OK (204)`, admin shows the `Page` content-type and the `Hero` block — now sourced 100% from the published `@press/cms`, with no engine code in the host `src/`.

- [ ] **Step 8: Commit**

```bash
git add .npmrc verdaccio apps/cms/package.json pnpm-lock.yaml
git commit -m "chore(registry): publish @press/cms@0.1.0 to Verdaccio and consume it as a real dependency"
```

---

## Task 6: Verify the boot is 100% from the dependency (spec §6 T2 assertion)

**Files:**
- Create: `scripts/assert-no-engine-in-host.mjs`

**Goal:** turn "no engine code in the owned `src/`" into an automated assertion, not a vibe.

- [ ] **Step 1: Write the assertion script**

Create `scripts/assert-no-engine-in-host.mjs`:
```javascript
// scripts/assert-no-engine-in-host.mjs
// Fails if the host src/ contains anything other than the two allowed extension
// points: an empty lifecycle (index.ts / main.ts) and src/components/custom/**.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const HOST_SRC = "apps/cms/src";
const ALLOWED_TOP = new Set(["index.ts", "main.ts", "components", "admin", "api", "extensions"]);
// engine reference blocks must NOT live here:
const FORBIDDEN_COMPONENT_CATEGORIES = new Set(["press"]);

let violations = [];

for (const entry of readdirSync(HOST_SRC)) {
  if (!ALLOWED_TOP.has(entry)) {
    violations.push(`unexpected host src entry: ${entry}`);
  }
}

const componentsDir = join(HOST_SRC, "components");
try {
  for (const cat of readdirSync(componentsDir)) {
    if (statSync(join(componentsDir, cat)).isDirectory() && FORBIDDEN_COMPONENT_CATEGORIES.has(cat)) {
      violations.push(`engine component category leaked into host: components/${cat}`);
    }
  }
} catch {}

if (violations.length) {
  console.error("ENGINE-IN-HOST LEAK:\n" + violations.map((v) => "  - " + v).join("\n"));
  process.exit(1);
}
console.log("OK: host src/ contains only allowed extension points (no engine code).");
```

- [ ] **Step 2: Run it**

Run:
```bash
node scripts/assert-no-engine-in-host.mjs
```
Expected: `OK: host src/ contains only allowed extension points (no engine code).`

- [ ] **Step 3: Commit**

```bash
git add scripts/assert-no-engine-in-host.mjs
git commit -m "test(contract): assert host src/ holds no engine code (T2 invariant)"
```

---

## Task 7: T3 — Adopter adds a custom block in the Project zone

**Files:**
- Create: `apps/cms/src/components/custom/callout.json` (adopter-owned block)
- Modify: `packages/press-cms/server/src/content-types/page/schema.json`? **NO** — must not edit the engine. See Step 2.

**Goal:** prove the custom-block extension point — the surface spec §6 flags as the most likely contract-leak site — works *without editing the engine*.

- [ ] **Step 1: Add an adopter custom block**

Create `apps/cms/src/components/custom/callout.json`:
```json
{
  "collectionName": "components_custom_callouts",
  "info": {
    "displayName": "Callout",
    "description": "Adopter-owned custom block (Project zone)"
  },
  "options": {},
  "attributes": {
    "message": { "type": "string", "required": true },
    "variant": {
      "type": "enumeration",
      "enum": ["info", "warning", "success"],
      "default": "info"
    }
  }
}
```

- [ ] **Step 2: Make the engine's Dynamic Zone accept adopter blocks WITHOUT editing the engine**

The engine must not name `custom.callout` in its schema (that would couple the engine to an adopter block). Two acceptable mechanisms — pick the one that matches the live path from Task 4 and is the *engine's* job, configured by the adopter through the stable contract surface:

- **If Path A:** the engine reads which custom categories to allow from `press.config.ts` (Project zone) at `register` time and appends them to the `page.body` dynamic zone's `components` list in memory. Add to `apps/cms/press.config.ts`:
  ```typescript
  export default {
    brand: { name: "Acme Press Site" },
    // Stable contract surface: adopter declares custom block categories the
    // engine should admit into reference dynamic zones.
    customBlockCategories: ["custom"],
  };
  ```
  And in the engine `register.ts`, after injecting components, extend the page dynamic zone:
  ```typescript
  // append (engine code, packages/press-cms/server/src/register.ts)
  const page = (strapi.contentTypes as any)["plugin::press-cms.page"];
  if (page?.attributes?.body?.type === "dynamiczone") {
    // discovered from host components dir at boot; here we trust Strapi's own
    // app-level component loader to have registered custom.* already.
    for (const uid of Object.keys(strapi.components as Record<string, unknown>)) {
      if (uid.startsWith("custom.") && !page.attributes.body.components.includes(uid)) {
        page.attributes.body.components.push(uid);
      }
    }
  }
  ```
  > This keeps the engine schema free of adopter names while letting adopter blocks flow into the reference Dynamic Zone — the extension point working as designed.

- **If Path B:** do the same append inside `createPressCms`'s `inject()` after components load.

- [ ] **Step 3: Rebuild engine, republish is NOT needed (engine logic changed)**

The engine code changed, so bump the working copy and republish so the host (which now consumes `0.1.0` from Verdaccio) sees it. To keep `0.1.0` as the contract baseline, republish under the same version only if Verdaccio `unpublish` is allowed, OR simpler — re-link to workspace for this dev step, verify, then fold this engine logic into the `0.1.0` artifact you publish as the *baseline* before the update loop:

```bash
# fastest dev verification: temporary workspace link
# (set apps/cms/package.json dep back to "workspace:*" TEMPORARILY)
pnpm --filter @press/cms build && pnpm install
node scripts/assert-no-engine-in-host.mjs
```
> Sequencing note: the custom-block support is *engine baseline* behavior, so it belongs in `0.1.0`. Develop it on the workspace link, then in Task 8/9 publish the finalized `0.1.0` engine to Verdaccio as the pre-update baseline. The adopter's `callout.json` stays in the host the whole time and is never touched by the engine.

- [ ] **Step 4: Boot and verify the custom block in the Dynamic Zone**

Boot, open admin → Content Manager → Page → Create. Confirm the `body` Dynamic Zone now offers **both** `Hero` (engine) and `Callout` (adopter), and an entry using both saves successfully.

- [ ] **Step 5: Re-assert no engine code leaked into the host**

Run:
```bash
node scripts/assert-no-engine-in-host.mjs
```
Expected: `OK`. (`custom/callout.json` is allowed; nothing under `press` category in the host.)

- [ ] **Step 6: Commit**

```bash
git add apps/cms/src/components/custom/callout.json apps/cms/press.config.ts packages/press-cms/server/src/register.ts
git commit -m "feat(cms): adopter custom block works via Project-zone extension point (T3)"
```

---

## Task 8: The contract test script (spec §9 — reusable deliverable)

**Files:**
- Create: `scripts/contract-check.mjs`
- Modify: `package.json` (add `contract:check` script)

**Goal:** the seed of the CI guard from PRD §8 — snapshot the Project zone, run a simulated update, fail on any out-of-delta change, then build+boot smoke.

- [ ] **Step 1: Write the contract-check script**

Create `scripts/contract-check.mjs`:
```javascript
// scripts/contract-check.mjs
// Spec §9 contract test. Run from repo root with a clean git working tree.
// Usage: node scripts/contract-check.mjs <fromVersion> <toVersion>
//   e.g. node scripts/contract-check.mjs 0.1.0 0.2.0
import { execSync } from "node:child_process";

const [, , fromV, toV] = process.argv;
if (!fromV || !toV) {
  console.error("usage: contract-check.mjs <fromVersion> <toVersion>");
  process.exit(2);
}

const sh = (cmd, opts = {}) =>
  execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts }).trim();

// Allowed delta (spec §8.1): only the dependency version line + the lockfile.
const ALLOWED_FILES = new Set(["apps/cms/package.json", "pnpm-lock.yaml"]);

// 0. Require a clean tree so the diff is attributable to the update alone.
const pre = sh("git status --porcelain");
if (pre) {
  console.error("working tree not clean; commit/stash before running:\n" + pre);
  process.exit(1);
}

// 1. Perform the simulated production update.
console.log(`> pnpm update @press/cms (${fromV} -> ${toV}) from Verdaccio`);
sh(`pnpm --filter cms update @press/cms@${toV}`);

// 2. Snapshot what changed on disk.
const changed = sh("git status --porcelain")
  .split("\n")
  .filter(Boolean)
  .map((l) => l.slice(3));

// 3. Fail on anything outside the allowed delta.
const leaks = changed.filter((f) => !ALLOWED_FILES.has(f));
if (leaks.length) {
  console.error("CONTRACT LEAK — Project-zone files changed by the update:");
  for (const f of leaks) console.error("  - " + f);
  process.exit(1);
}

// 4. Confirm the ONLY change inside apps/cms/package.json is the version range.
const pkgDiff = sh("git diff -- apps/cms/package.json");
const meaningful = pkgDiff
  .split("\n")
  .filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"));
const allVersionLines = meaningful.every((l) => /@press\/cms/.test(l));
if (meaningful.length > 0 && !allVersionLines) {
  console.error("CONTRACT LEAK — non-version change in apps/cms/package.json:\n" + pkgDiff);
  process.exit(1);
}

console.log(`OK: only allowed delta changed (apps/cms/package.json @press/cms + lockfile).`);

// 5. Build + boot smoke.
console.log("> build host");
sh("pnpm --filter cms build", { stdio: "inherit" });

console.log("> boot smoke");
const boot = `( pnpm --filter cms start & SP=$!; \
  for i in $(seq 1 60); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health||true); \
  [ "$c" = "204" ] && { echo BOOTOK; break; }; sleep 2; done; kill $SP 2>/dev/null )`;
const out = sh(boot, { shell: "/bin/bash" });
if (!out.includes("BOOTOK")) {
  console.error("BOOT FAILED after update");
  process.exit(1);
}
console.log("OK: host builds and boots after update. CONTRACT HELD.");
```

- [ ] **Step 2: Add the npm script**

In root `package.json` `scripts`, add:
```jsonc
"contract:check": "node scripts/contract-check.mjs"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/contract-check.mjs package.json
git commit -m "test(contract): add Project-zone non-breakage contract script (spec §9)"
```

---

## Task 9: T4 — The update loop v0.1.0 → v0.2.0 (the Q2 proof)

**Files:**
- Modify: `packages/press-cms/**` (internal-only change, public contract stable)
- Modify: `packages/press-cms/package.json` (version → `0.2.0`)

**Goal:** publish a v0.2.0 that changes engine *internals* while holding the *public contract* (the `press.hero` `__component` id and the `custom.*` interface) stable, then prove the update touches only the allowed delta.

- [ ] **Step 1: Ensure the baseline is committed and published as 0.1.0**

Confirm the host depends on `@press/cms@0.1.0` (from Verdaccio, not workspace), the tree is clean, and `0.1.0` on Verdaccio contains the finalized engine (incl. Task 7 custom-block support). If you developed Task 7 on a workspace link, re-point the host to `"@press/cms": "0.1.0"`, republish the engine as `0.1.0` (unpublish first if needed), `pnpm install`, and commit so the working tree is clean before the loop.

- [ ] **Step 2: Make a real internal-only change for v0.2.0**

Pick at least one (spec §7) — all must leave the public `press.hero` `__component` id and `custom.*` interface unchanged:
- Rename an **internal** attribute the public block does not expose, e.g. add an internal `_layoutHint` field used only by engine logic, or rename a private helper.
- Restructure the plugin's internal folder layout (move `register.ts` logic into `server/src/lib/inject-components.ts`).
- Change an engine-internal `register`/`bootstrap` detail (e.g. log format, injection order).

Concretely, do the folder restructure: create `packages/press-cms/server/src/lib/inject-components.ts`, move the injection logic there, and have `register.ts` call it. The public block id `press.hero` and its `heading/subheading/ctaLabel` attributes stay identical.

- [ ] **Step 3: Bump and publish v0.2.0**

```bash
# set packages/press-cms/package.json "version": "0.2.0"
pnpm --filter @press/cms build
cd packages/press-cms && npm publish --registry http://localhost:4873 ; cd -
curl -s http://localhost:4873/@press%2fcms | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('versions:',Object.keys(JSON.parse(s).versions||{})))"
```
Expected: `versions: [ '0.1.0', '0.2.0' ]`.

- [ ] **Step 4: Commit the engine v0.2.0 (keep tree clean for the contract run)**

```bash
git add packages/press-cms
git commit -m "feat(press-cms): v0.2.0 — internal restructure, public contract unchanged"
```

- [ ] **Step 5: Run the contract check across the bump (the proof)**

Run:
```bash
node scripts/contract-check.mjs 0.1.0 0.2.0
```
Expected output (spec §8 acceptance 1–3):
```
OK: only allowed delta changed (apps/cms/package.json @press/cms + lockfile).
> build host
> boot smoke
OK: host builds and boots after update. CONTRACT HELD.
```
Then the manual admin re-check (acceptance 3): boot, open admin, confirm `Page` Dynamic Zone still renders `Hero` (engine) + `Callout` (adopter) and existing entries open.

- [ ] **Step 6: Documentary deploy check (spec §8.4, §10)**

Confirm `apps/cms/config/server.ts` and `config/database.ts` are still env-driven and valid (no executed deploy). Run:
```bash
pnpm --filter cms exec strapi ts:generate-types && echo "config types OK"
```
Expected: types generate without config errors. Record "deploy: documentary check — config valid, not executed".

- [ ] **Step 7: Commit the post-update lockfile/package change**

```bash
git add apps/cms/package.json pnpm-lock.yaml
git commit -m "chore(cms): bump @press/cms 0.1.0 -> 0.2.0 (allowed delta only — contract held)"
```

---

## Task 10: Definition of done — record results and finalize the skeleton

**Files:**
- Modify: `docs/superpowers/specs/2026-06-10-strapi-as-dependency-spike-design.md` (§13 Results — full evidence)
- Create: `README.md` (how to run the spike)

- [ ] **Step 1: Fill in the §13 Results with full acceptance evidence**

Replace the §13 stub written in Task 4 with the complete record:
```markdown
## 13. Results

- **Outcome:** <PASS on path A | PASS on path B | STOP signal C>.
- **Strapi pin:** `5.48.0`.
- **T1 / pivot:** Path <A|B|C>. Mechanism: <register-time strapi.components injection | createPressCms wrapper | both leaked>.
- **Acceptance (spec §8) across v0.1.0 → v0.2.0:**
  1. Allowed delta only — `scripts/contract-check.mjs` green (only `apps/cms/package.json` @press/cms range + `pnpm-lock.yaml` changed).
  2. Builds — yes.
  3. Boots — yes; admin shows engine `Page`, reference `Hero`, adopter `Callout`; Dynamic Zone renders all.
  4. Deploy — documentary check: config still env-driven and valid.
- **Contract test:** `scripts/contract-check.mjs` retained for hardening in spec 4.
- **Date:** 2026-06-10.
```
(If outcome is **C**, instead record: which of A1/A2/B were tried, the exact failure for each, and why reference blocks could not leave the host — the §12 negative-DoD evidence.)

- [ ] **Step 2: Write a short run README**

Create `README.md`:
```markdown
# press — Strapi-as-dependency spike

Monorepo proving `@press/cms` (the engine) ships as a versioned, updatable
dependency consumed by a thin owned host (`apps/cms`), without leaking into the
adopter's Project zone. See `docs/superpowers/specs/2026-06-10-strapi-as-dependency-spike-design.md`.

## Layout
- `packages/press-cms` — engine (Strapi plugin), published to local Verdaccio.
- `apps/cms` — thin host (adopter-owned). Extension points: `config/plugins.ts`,
  `src/components/custom/`, `press.config.ts`.

## Run the spike
1. `pnpm install`
2. Start the local registry: `npx verdaccio@6.7.2 --config verdaccio/config.yaml`
3. Publish engine: `pnpm --filter @press/cms build && (cd packages/press-cms && npm publish --registry http://localhost:4873)`
4. `pnpm --filter cms build && pnpm --filter cms start` → http://localhost:1337/admin
5. Prove non-breakage: `node scripts/contract-check.mjs 0.1.0 0.2.0`
```

- [ ] **Step 3: Final full-loop verification (clean machine simulation)**

Run, from a clean tree, the whole acceptance once more and capture output:
```bash
node scripts/assert-no-engine-in-host.mjs
node scripts/contract-check.mjs 0.1.0 0.2.0
```
Expected: both green. This is the evidence backing §12 Definition of Done.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-10-strapi-as-dependency-spike-design.md README.md
git commit -m "docs(spike): record results and definition-of-done evidence"
```

- [ ] **Step 5: Finish the branch**

Use `superpowers:finishing-a-development-branch` to decide merge/PR. The committed skeleton (`packages/press-cms/` + `apps/cms/` + `scripts/contract-check.mjs`) is the foundational deliverable that specs 1–5 build on.

---

## Self-review notes (run by the author)

- **Spec coverage:** every §-item maps to a task (table at top). The A/B/C decision tree (§5.3) is Task 4; stop-signal C has an explicit early-exit (Task 4 Step 8) so a negative result is still a clean DoD (§12).
- **Type/name consistency:** plugin id `press-cms` (Strapi) vs package `@press/cms` (npm) is used consistently; content-type uid `plugin::press-cms.page`; reference block `press.hero`; adopter block `custom.callout`; contract script `scripts/contract-check.mjs` and assertion `scripts/assert-no-engine-in-host.mjs` named identically wherever referenced.
- **Known soft spots (flagged honestly, not hidden):**
  1. The exact `strapi.components` injection shape (Task 4 Step 3) is the spike's genuine experiment — the docs confirm no declarative plugin-component API exists, so the injected object's required keys (`uid/category/modelName/globalId/__schema__`) may need adjustment against Strapi 5.48's loader. The pass/fail checks are concrete even though the incantation may need iteration; that is the nature of T1.
  2. Verdaccio auth-token capture (Task 5 Steps 3–4) varies by tool version; two routes are given.
  3. `strapi-server` entry/exports paths from `@strapi/sdk-plugin` may differ slightly by SDK version — verify the scaffold's actual `server/src/index.ts` and wire `register`/`contentTypes` through whatever the scaffold uses.
```
