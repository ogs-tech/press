# press Deploy Guide (Spec 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a verified deploy story for press — a self-hosted Docker Compose path (primary) plus a documented managed path (Strapi Cloud + Vercel) — proven by an executable production-mode smoke harness, so an external adopter reaches first deploy unaided (PRD Q1).

**Architecture:** A press project has two deployable halves with different ownership. The **cms host** (`cms/`) is committed and ships like any Strapi 5 app (`strapi build` → `strapi start`), defaulting to sqlite but driving Postgres in production via env (`DATABASE_CLIENT=postgres` + `DATABASE_URL`). The **web host** is engine-owned and **gitignored** — `press build` materializes it to `.press/web/` from `@press/web/host-template`, then `next build .press/web`; there is no committed Next app to "connect to a platform." Because the web host reads `CMS_URL` at **runtime** (`get-page.ts` server fetch with `cache: 'no-store'`, and `hero.tsx` resolves the hero image `src` absolutely against `CMS_URL`), `CMS_URL` must be the **public** CMS origin, set at `next start` time. The self-hosted path packages both halves plus Postgres and a Caddy reverse proxy as a single public origin; the smoke harness brings that whole stack up against Postgres in production mode and asserts the seeded page renders end-to-end. The managed path documents the same production shape on Strapi Cloud + Vercel (cost flagged; not automatable without paid accounts).

**Tech Stack:** Node 20 / pnpm 10 monorepo (Turborepo); Strapi 5 (cms host); Next 15 RSC (materialized web host); Docker Compose + Postgres 16 + Caddy 2 (self-hosted); Verdaccio (local private registry, reused from the Spec 4 harness via `scripts/lib/registry.mjs`).

**Decisions locked (product/scope, confirmed with the user 2026-06-12):**
- **Primary path = self-hosted Docker Compose** (zero/low recurring cost). Managed (Strapi Cloud + Vercel) is documented as an optional path with its ~US$38/mo cost called out. AWS is a future non-blocking note, out of scope.
- **Verification = guide + deploy smoke harness** (production-mode, Compose-based), matching the house style where every prior spec shipped a runnable check.

---

## Deployment model (read before Task 1)

The technical crux Spec 5 must solve, and why each artifact exists:

1. **The web host doesn't exist in the repo.** It is materialized to a gitignored `.press/web/` on every `press build`. So you cannot "point a platform at the repo and let it build Next." Strategy: **build-then-ship** — `press build` produces `.press/web/.next` on the build machine; the Docker image copies the already-installed `node_modules` + built artifacts and only *runs* `next start .press/web`. (Trade-off: the image is build-arch-coupled — fine for a same-arch VPS; the guide notes this and the registry-install alternative for managed.)

2. **`CMS_URL` is runtime and dual-purpose.** `@press/web` reads `process.env.CMS_URL` at request time for both the API fetch (`get-page.ts:3`) and the hero image `src` (`hero.tsx:3` → `new URL(image.url, CMS_URL)`). The `src` is embedded in HTML the **browser** loads, so `CMS_URL` must be a **publicly reachable** CMS origin, not an internal Docker hostname. The self-hosted topology therefore routes web and cms through **one Caddy origin** so a single `CMS_URL` works for both the server-side fetch and the browser-loaded media.

3. **Deploy order is fixed:** cms first (it owns the public origin + DB + secrets), then web wired with `CMS_URL` pointing at the live cms origin.

4. **`@press/*` is private.** Any environment that installs (managed CI, or a registry-install Docker build) needs registry auth via `.npmrc` + a token. The self-hosted build-then-ship path sidesteps in-container install by copying host-installed `node_modules`.

**Smoke topology (what Task 4 stands up):** Caddy listens on `:8080` and is published `8080:8080`. It routes `/api/* /admin* /uploads/* /content-manager/* /content-type-builder/* /upload/*` → `cms:1337`, everything else → `web:3000`. The web container is given `CMS_URL=http://host.docker.internal:8080` (+ `extra_hosts: ["host.docker.internal:host-gateway"]` for Linux CI), so its server-side fetch and the image `src` it emits both resolve to the one public origin the host browser also uses (`http://localhost:8080`). The harness asserts the HTML string (hero + callout + whitelabel `<head>` + absolute image `src`), exactly like `scripts/e2e-check.mjs`, but against the full Postgres-backed, production-mode Compose stack.

## File Structure

**Adopter-facing artifacts (shipped by `press create`):**
- `packages/press-cli/templates/cms/.env.production.example` — production cms env (Postgres + all Strapi secrets, documented).
- `packages/press-cli/templates/project/deploy/docker-compose.yml` — postgres + cms + web + caddy + one-shot seed.
- `packages/press-cli/templates/project/deploy/Dockerfile.cms` — build-then-ship Strapi runtime image.
- `packages/press-cli/templates/project/deploy/Dockerfile.web` — build-then-ship Next runtime image for the materialized host.
- `packages/press-cli/templates/project/deploy/Caddyfile` — single-origin reverse proxy.
- `packages/press-cli/templates/project/deploy/.env.deploy.example` — Compose env (public origin, Postgres creds, cms secrets).

**Engine / repo changes:**
- `packages/press-cli/src/create/scaffold.ts` — copy the `deploy/` kit + env examples; extend the project `.gitignore`.
- `packages/press-cli/src/create/scaffold.test.ts` — assert the deploy kit lands.
- `packages/press-cli/src/commands/deploy.ts` — finalize the command from the Spec-3 "preview" stub into real, guide-pointing guidance (keep prereq validation).
- `packages/press-cli/src/commands/deploy.test.ts` — cover the finalized message + a new prereq.
- `scripts/deploy-smoke.mjs` — the production-mode Compose smoke harness.
- `package.json` — add `"deploy:smoke"` script.
- `.github/workflows/deploy-smoke.yml` — CI gate (workflow_dispatch + `deploy/**` changes), mirroring `contract-guard.yml`.

**Docs:**
- `docs/beta/deploy.md` — the guide (self-hosted primary, managed documented).
- `README.md` — a "Run the deploy (Spec 5)" section.
- `docs/beta/roadmap.md` — flip Spec 5 status + add the outcome paragraph.

---

### Task 1: Production cms env contract

**Files:**
- Create: `packages/press-cli/templates/cms/.env.production.example`
- Test: `packages/press-cli/src/create/scaffold.test.ts` (extended in Task 3)

This is a static template file; its presence/shape is asserted via scaffold in Task 3. Author it now so Task 3 can copy it.

- [ ] **Step 1: Write the production env example**

Create `packages/press-cli/templates/cms/.env.production.example`:

```bash
# cms/.env.production.example — copy to cms/.env on the server and fill in.
# Generate each secret with:  openssl rand -base64 16
# NEVER commit the filled-in file (cms/.env is gitignored).

HOST=0.0.0.0
PORT=1337

# Strapi secrets — all REQUIRED in production. APP_KEYS is a CSV of >=2 keys.
APP_KEYS=REPLACE_ME_KEY_1,REPLACE_ME_KEY_2
API_TOKEN_SALT=REPLACE_ME
ADMIN_JWT_SECRET=REPLACE_ME
TRANSFER_TOKEN_SALT=REPLACE_ME
JWT_SECRET=REPLACE_ME
ENCRYPTION_KEY=REPLACE_ME

# Database — Postgres in production (sqlite is dev-only and ephemeral on managed
# hosts). Either set DATABASE_URL, or the discrete DATABASE_* fields.
DATABASE_CLIENT=postgres
DATABASE_URL=postgres://strapi:strapi@db:5432/strapi
DATABASE_SSL=false

# Public origin the BROWSER uses to reach this CMS (media URLs, admin). Must match
# the CMS_URL given to the web host. Example: https://cms.example.com
PUBLIC_URL=https://cms.example.com
```

- [ ] **Step 2: Commit**

```bash
git add packages/press-cli/templates/cms/.env.production.example
git commit -m "feat(deploy): add production cms env example (Postgres + secrets)"
```

---

### Task 2: Self-hosted deploy kit (Compose + Dockerfiles + Caddy)

**Files:**
- Create: `packages/press-cli/templates/project/deploy/docker-compose.yml`
- Create: `packages/press-cli/templates/project/deploy/Dockerfile.cms`
- Create: `packages/press-cli/templates/project/deploy/Dockerfile.web`
- Create: `packages/press-cli/templates/project/deploy/Caddyfile`
- Create: `packages/press-cli/templates/project/deploy/.env.deploy.example`

Static templates; validated end-to-end by the smoke harness (Task 4) and for presence by scaffold (Task 3). Author all five now.

- [ ] **Step 1: Write the Compose file**

Create `packages/press-cli/templates/project/deploy/docker-compose.yml`:

```yaml
# deploy/docker-compose.yml — self-hosted press stack: Postgres + Strapi cms +
# Next web + Caddy single-origin proxy. Run from the PROJECT ROOT after `press build`:
#   docker compose -f deploy/docker-compose.yml --env-file deploy/.env.deploy up -d --build
# The build context is the project root (..), so images copy the host-installed
# node_modules and the materialized .press/web — build-then-ship (see docs/beta/deploy.md).
name: press

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DATABASE_USERNAME:-strapi}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD:-strapi}
      POSTGRES_DB: ${DATABASE_NAME:-strapi}
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DATABASE_USERNAME:-strapi}"]
      interval: 3s
      timeout: 3s
      retries: 20

  # One-shot: boots Strapi programmatically against Postgres, writes the sample
  # page, exits. Runs before cms serves traffic (the seed needs the server DOWN).
  seed:
    build:
      context: ..
      dockerfile: deploy/Dockerfile.cms
    command: ["node", "content/seed.mjs"]
    working_dir: /app/cms
    env_file: [.env.deploy]
    environment:
      DATABASE_URL: postgres://${DATABASE_USERNAME:-strapi}:${DATABASE_PASSWORD:-strapi}@db:5432/${DATABASE_NAME:-strapi}
    depends_on:
      db:
        condition: service_healthy
    restart: "no"

  cms:
    build:
      context: ..
      dockerfile: deploy/Dockerfile.cms
    restart: unless-stopped
    env_file: [.env.deploy]
    environment:
      DATABASE_URL: postgres://${DATABASE_USERNAME:-strapi}:${DATABASE_PASSWORD:-strapi}@db:5432/${DATABASE_NAME:-strapi}
    depends_on:
      db:
        condition: service_healthy
      seed:
        condition: service_completed_successfully
    expose: ["1337"]

  web:
    build:
      context: ..
      dockerfile: deploy/Dockerfile.web
    restart: unless-stopped
    environment:
      CMS_URL: ${CMS_URL}
    extra_hosts:
      # Lets the web container reach the host-published Caddy origin (Linux CI).
      - "host.docker.internal:host-gateway"
    depends_on: [cms]
    expose: ["3000"]

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    ports:
      - "${PUBLISH_PORT:-8080}:8080"
    depends_on: [web, cms]

volumes:
  db-data:
```

- [ ] **Step 2: Write the cms Dockerfile**

Create `packages/press-cli/templates/project/deploy/Dockerfile.cms`:

```dockerfile
# deploy/Dockerfile.cms — build-then-ship Strapi runtime. Context = project root.
# Assumes `press build` (strapi build) already ran on the build host, so cms/ holds
# the built admin and node_modules has the deps. The image only RUNS the host.
FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

# Copy the installed workspace (node_modules + cms host + adopter layer). .next and
# other web artifacts are harmless dead weight here; .dockerignore trims the worst.
COPY . .

WORKDIR /app/cms
EXPOSE 1337
# strapi start serves the prebuilt admin against the env-configured Postgres.
CMD ["npx", "strapi", "start"]
```

- [ ] **Step 3: Write the web Dockerfile**

Create `packages/press-cli/templates/project/deploy/Dockerfile.web`:

```dockerfile
# deploy/Dockerfile.web — build-then-ship Next runtime for the MATERIALIZED host.
# Context = project root. Assumes `press build` already produced .press/web/.next on
# the build host. The image only RUNS `next start` against that build; CMS_URL is
# injected at runtime (the web host reads it per-request).
FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

COPY . .

EXPOSE 3000
# next start serves .press/web/.next. CMS_URL comes from the environment at runtime.
CMD ["npx", "next", "start", ".press/web", "-p", "3000", "-H", "0.0.0.0"]
```

- [ ] **Step 4: Write the Caddyfile**

Create `packages/press-cli/templates/project/deploy/Caddyfile`:

```caddy
# deploy/Caddyfile — single public origin. The browser and the web host both reach
# the CMS through THIS origin, so one CMS_URL works for the API fetch AND the media
# <img src> the browser loads. For a real domain, replace :8080 with your hostname
# (Caddy then auto-provisions HTTPS).
:8080 {
	# CMS surfaces — everything the browser or the web host needs from Strapi.
	@cms path /api/* /admin* /uploads/* /content-manager/* /content-type-builder/* /upload/* /i18n/* /users-permissions/*
	handle @cms {
		reverse_proxy cms:1337
	}

	# Everything else is the Next web host.
	handle {
		reverse_proxy web:3000
	}
}
```

- [ ] **Step 5: Write the Compose env example**

Create `packages/press-cli/templates/project/deploy/.env.deploy.example`:

```bash
# deploy/.env.deploy.example — copy to deploy/.env.deploy and fill in.
# Used by docker compose --env-file. NEVER commit the filled-in file.

# Public origin Caddy serves on. For a real deploy use your domain, e.g.
# CMS_URL=https://example.com and PUBLISH_PORT=80 (or 443 with a hostname Caddyfile).
PUBLISH_PORT=8080
CMS_URL=http://localhost:8080

# Postgres
DATABASE_CLIENT=postgres
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=change-me-strong
DATABASE_NAME=strapi
DATABASE_SSL=false

# Strapi secrets — generate each with: openssl rand -base64 16
APP_KEYS=REPLACE_ME_KEY_1,REPLACE_ME_KEY_2
API_TOKEN_SALT=REPLACE_ME
ADMIN_JWT_SECRET=REPLACE_ME
TRANSFER_TOKEN_SALT=REPLACE_ME
JWT_SECRET=REPLACE_ME
ENCRYPTION_KEY=REPLACE_ME
```

- [ ] **Step 6: Write a .dockerignore to trim build context**

Create `packages/press-cli/templates/project/deploy/.dockerignore.template` (copied to project-root `.dockerignore` by scaffold in Task 3 — named `.template` so it is not interpreted while sitting in the CLI package):

```
.git
cms/.tmp
cms/.cache
**/*.log
```

- [ ] **Step 7: Commit**

```bash
git add packages/press-cli/templates/project/deploy/
git commit -m "feat(deploy): add self-hosted Docker Compose kit (cms+web+postgres+caddy)"
```

---

### Task 3: Scaffold writes the deploy kit

**Files:**
- Modify: `packages/press-cli/src/create/scaffold.ts`
- Modify: `packages/press-cli/src/create/scaffold.test.ts`
- Reference: `packages/press-cli/templates/project/gitignore` (the project `.gitignore` source)

First, read `packages/press-cli/src/create/scaffold.ts` end-to-end to see how existing templates are copied (it renders `package.json`/`cms` programmatically and copies `templates/project/*`). Mirror that copy mechanism for `deploy/`.

- [ ] **Step 1: Write the failing test**

Add to `packages/press-cli/src/create/scaffold.test.ts` (place beside the existing scaffold assertions; reuse the test's existing scaffold-into-temp helper — match the names already in the file):

```typescript
it('writes the self-hosted deploy kit', () => {
  const dir = scaffoldProject(); // existing helper in this file
  for (const f of [
    'deploy/docker-compose.yml',
    'deploy/Dockerfile.cms',
    'deploy/Dockerfile.web',
    'deploy/Caddyfile',
    'deploy/.env.deploy.example',
    'cms/.env.production.example',
    '.dockerignore',
  ]) {
    expect(existsSync(path.join(dir, f)), `missing ${f}`).toBe(true);
  }
});

it('gitignores the filled-in deploy secrets but keeps the examples', () => {
  const dir = scaffoldProject();
  const gi = readFileSync(path.join(dir, '.gitignore'), 'utf8');
  expect(gi).toMatch(/deploy\/\.env\.deploy$/m);
  expect(gi).toMatch(/cms\/\.env\.production$/m);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @press/cli exec vitest run src/create/scaffold.test.ts -t "deploy kit"`
Expected: FAIL — `missing deploy/docker-compose.yml`.

- [ ] **Step 3: Copy the deploy kit in scaffold.ts**

In `packages/press-cli/src/create/scaffold.ts`, in the function that materializes the project templates (after the existing `templates/project` copy and the `templates/cms` copy), add:

```typescript
// Self-hosted deploy kit (Spec 5). Copied verbatim; the adopter fills the *.example
// files and runs `docker compose -f deploy/docker-compose.yml`.
const deploySrc = path.join(templatesDir, 'project', 'deploy');
cpSync(deploySrc, path.join(dest, 'deploy'), { recursive: true });

// .dockerignore ships as `.dockerignore.template` in the package (so it is inert
// there); land it at the project root under its real name.
renameSync(
  path.join(dest, 'deploy', '.dockerignore.template'),
  path.join(dest, '.dockerignore'),
);

// Production cms env example lives under cms/.
cpSync(
  path.join(templatesDir, 'cms', '.env.production.example'),
  path.join(dest, 'cms', '.env.production.example'),
);
```

Ensure `cpSync`, `renameSync` are imported from `node:fs` at the top of the file (add whichever is missing to the existing import).

- [ ] **Step 4: Extend the project .gitignore template**

In `packages/press-cli/templates/project/gitignore`, under the `# env + secrets` block (which already lists `.env` and `cms/.env`), add:

```
cms/.env.production
deploy/.env.deploy
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @press/cli exec vitest run src/create/scaffold.test.ts`
Expected: PASS (all scaffold tests, including the two new ones).

- [ ] **Step 6: Commit**

```bash
git add packages/press-cli/src/create/scaffold.ts packages/press-cli/src/create/scaffold.test.ts packages/press-cli/templates/project/gitignore
git commit -m "feat(deploy): scaffold writes the deploy kit + gitignores filled secrets"
```

---

### Task 4: Production-mode deploy smoke harness

**Files:**
- Create: `scripts/deploy-smoke.mjs`
- Modify: `package.json` (add `deploy:smoke` script)
- Reuse: `scripts/lib/registry.mjs` (`startRegistry`, `stopRegistry`, `buildAndPublish`, `REGISTRY_URL`), `scripts/lib/sh.mjs` (`sh`, `shInherit`)

Before writing, read `scripts/cli-e2e.mjs` (it already scaffolds a fresh project against Verdaccio and installs it) and `scripts/lib/registry.mjs` to reuse the exact publish/scaffold idiom rather than reinventing it. The smoke is an integration script — like `scripts/contract-guard.mjs`, the script *is* the test; there is no unit around it.

- [ ] **Step 1: Write the smoke harness**

Create `scripts/deploy-smoke.mjs`:

```javascript
// scripts/deploy-smoke.mjs — Spec 5 proof: the self-hosted Docker path actually
// deploys and renders, in PRODUCTION mode against Postgres. Steps:
//   1. local Verdaccio + publish @press/cms, @press/web, @press/cli (reuse Spec 4 lib)
//   2. `press create` a throwaway project + install it (build-then-ship needs deps on disk)
//   3. `press build` — materialize .press/web + strapi build + next build
//   4. write deploy/.env.deploy with real secrets + CMS_URL = host.docker.internal origin
//   5. docker compose up --build (postgres + seed + cms + web + caddy)
//   6. assert the seeded /home renders hero + callout + whitelabel <head> through Caddy
//   7. tear everything down (compose down -v, registry, temp dir)
// Exit 0 = "DEPLOY SMOKE PASS"; any failed assertion = non-zero with a clear message.
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { startRegistry, stopRegistry, buildAndPublish, REGISTRY_URL } from './lib/registry.mjs';

const ROOT = process.cwd();
const ORIGIN = 'http://localhost:8080';
const CMS_URL_INTERNAL = 'http://host.docker.internal:8080';
const b64 = () => randomBytes(16).toString('base64');
const fail = (msg) => { console.error('DEPLOY SMOKE FAIL:', msg); process.exit(1); };
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });

function requireDocker() {
  const r = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' });
  if (r.status !== 0) fail('docker compose is required to run the deploy smoke.');
}

async function waitFor(url, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try { const res = await fetch(url); if (res.ok) return await res.text(); } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

async function main() {
  requireDocker();
  const tmp = mkdtempSync(path.join(tmpdir(), 'press-deploy-smoke-'));
  const project = path.join(tmp, 'site');
  let composeUp = false;
  const composeFile = path.join(project, 'deploy', 'docker-compose.yml');
  const envFile = path.join(project, 'deploy', '.env.deploy');
  const compose = (args) =>
    sh(`docker compose -f ${composeFile} --env-file ${envFile} ${args}`, { cwd: project });

  startRegistry(ROOT);
  try {
    // 1. publish the engine + cli to the local registry.
    for (const [filter, pkgDir, name] of [
      ['@press/cms', 'packages/press-cms', '@press/cms'],
      ['@press/web', 'packages/press-web', '@press/web'],
      ['@press/cli', 'packages/press-cli', '@press/cli'],
    ]) {
      buildAndPublish({ root: ROOT, filter, pkgDir: path.join(ROOT, pkgDir) });
    }

    // 2. scaffold + install the throwaway project against Verdaccio.
    sh(`node packages/press-cli/bin/press.js create ${project} --registry ${REGISTRY_URL}`, { cwd: ROOT });
    sh('pnpm install', { cwd: project });

    // 3. production build of both halves.
    sh('pnpm exec press build', { cwd: project });
    if (!existsSync(path.join(project, '.press', 'web', '.next'))) fail('press build did not produce .press/web/.next');

    // 4. real deploy env. CMS_URL points at the host-published Caddy origin so the
    //    web container's API fetch AND the image src it emits both resolve there.
    writeFileSync(envFile, [
      'PUBLISH_PORT=8080',
      `CMS_URL=${CMS_URL_INTERNAL}`,
      'DATABASE_CLIENT=postgres',
      'DATABASE_USERNAME=strapi',
      `DATABASE_PASSWORD=${b64()}`,
      'DATABASE_NAME=strapi',
      'DATABASE_SSL=false',
      `APP_KEYS=${b64()},${b64()}`,
      `API_TOKEN_SALT=${b64()}`,
      `ADMIN_JWT_SECRET=${b64()}`,
      `TRANSFER_TOKEN_SALT=${b64()}`,
      `JWT_SECRET=${b64()}`,
      `ENCRYPTION_KEY=${b64()}`,
      '',
    ].join('\n'));

    // 5. bring the stack up (seed runs to completion first via depends_on).
    composeUp = true;
    compose('up -d --build');

    // 6. assert the rendered page through Caddy.
    const html = await waitFor(`${ORIGIN}/home`);
    if (html === null) fail('stack did not serve /home through Caddy');
    if (!html.includes('Hello from press')) fail('hero heading missing from production HTML');
    if (!html.includes('Adopter callout renders via the Project-zone block map')) fail('custom callout missing from production HTML');
    if (!/<title>[^<]*\| /.test(html)) fail('whitelabel <title> template missing from production HTML');
    const m = html.match(/<img[^>]*src="([^"]+)"/);
    if (!m) fail('hero <img> not rendered');
    if (!m[1].startsWith(`${CMS_URL_INTERNAL}/uploads/`)) fail(`image src not absolute against the public CMS origin: ${m[1]}`);

    console.log('\nDEPLOY SMOKE PASS: Postgres-backed cms + production Next web rendered hero + callout + whitelabel head through Caddy.');
  } finally {
    if (composeUp) { try { compose('down -v'); } catch {} }
    stopRegistry(ROOT);
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((e) => fail(e?.message ?? String(e)));
```

- [ ] **Step 2: Add the package.json script**

In root `package.json`, under `scripts`, add (after `"guard"`):

```json
    "deploy:smoke": "node scripts/deploy-smoke.mjs"
```

- [ ] **Step 3: Run the smoke and verify it passes**

Run: `pnpm deploy:smoke`
Expected (final line): `DEPLOY SMOKE PASS: Postgres-backed cms + production Next web rendered hero + callout + whitelabel head through Caddy.` and exit 0.

If `press create` doesn't accept `--registry`, check `packages/press-cli/src/commands/create.ts` for the actual flag name and adjust Step 1's invocation to match (do not change the CLI to fit the script).

- [ ] **Step 4: Prove the smoke catches a real break (negative test)**

Temporarily set `CMS_URL=http://cms:1337` (the internal hostname) in the harness's env block instead of `CMS_URL_INTERNAL`, then `pnpm deploy:smoke`: the API fetch still works container-to-container, but the image-src assertion fails with `image src not absolute against the public CMS origin: http://cms:1337/uploads/...` and a non-zero exit — proving the harness actually guards the runtime-`CMS_URL` contract. Revert the edit to restore green.

- [ ] **Step 5: Commit**

```bash
git add scripts/deploy-smoke.mjs package.json
git commit -m "feat(deploy): add production-mode Compose deploy smoke harness"
```

---

### Task 5: Finalize the `press deploy` command

**Files:**
- Modify: `packages/press-cli/src/commands/deploy.ts`
- Modify: `packages/press-cli/src/commands/deploy.test.ts`

`deploy.ts` currently prints a Spec-3 "preview" blurb (`SPEC5_PATH`). Finalize it: keep `validateDeployPrereqs`, but emit the real two-path guidance that points at the shipped guide and the `deploy/` kit, and verify the self-hosted kit is present.

- [ ] **Step 1: Write the failing test**

Replace the message-related expectation in `packages/press-cli/src/commands/deploy.test.ts` and add a kit-presence prereq test. Append:

```typescript
import { mkdirSync as _mkdir, writeFileSync as _write } from 'node:fs';

describe('validateDeployPrereqs — deploy kit', () => {
  it('fails when the self-hosted deploy kit is missing', () => {
    const root = scratch();
    mkdirSync(path.join(root, '.press', 'web', '.next'), { recursive: true });
    mkdirSync(path.join(root, 'cms'), { recursive: true });
    writeFileSync(path.join(root, 'cms', '.env'), 'PORT=1337\n');
    const r = validateDeployPrereqs(root);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/deploy kit|docker-compose/i);
  });

  it('passes when build, cms/.env, and the deploy kit are all present', () => {
    const root = scratch();
    mkdirSync(path.join(root, '.press', 'web', '.next'), { recursive: true });
    mkdirSync(path.join(root, 'cms'), { recursive: true });
    writeFileSync(path.join(root, 'cms', '.env'), 'PORT=1337\n');
    mkdirSync(path.join(root, 'deploy'), { recursive: true });
    writeFileSync(path.join(root, 'deploy', 'docker-compose.yml'), 'name: press\n');
    const r = validateDeployPrereqs(root);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @press/cli exec vitest run src/commands/deploy.test.ts -t "deploy kit"`
Expected: FAIL — the current `validateDeployPrereqs` does not check for `deploy/docker-compose.yml`, so the "fails when missing" case wrongly passes validation.

- [ ] **Step 3: Finalize deploy.ts**

Rewrite `packages/press-cli/src/commands/deploy.ts`:

```typescript
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface DeployOptions {
  cwd: string;
}

export interface PrereqResult {
  ok: boolean;
  errors: string[];
}

/**
 * Checks a deploy is launchable: a production web build exists (.press/web/.next),
 * the cms host has its infra env (cms/.env), and the self-hosted deploy kit is
 * present (deploy/docker-compose.yml). Pure fs existence — unit-testable without
 * booting anything.
 */
export function validateDeployPrereqs(root: string): PrereqResult {
  const errors: string[] = [];
  if (!existsSync(path.join(root, '.press', 'web', '.next'))) {
    errors.push('no web build found — run `press build` first (.press/web/.next missing).');
  }
  if (!existsSync(path.join(root, 'cms', '.env'))) {
    errors.push('cms/.env missing — required infra/secrets are not set.');
  }
  if (!existsSync(path.join(root, 'deploy', 'docker-compose.yml'))) {
    errors.push('deploy kit missing — deploy/docker-compose.yml not found (expected from `press create`).');
  }
  return { ok: errors.length === 0, errors };
}

const GUIDE_PATH = `
press deploy — two documented paths (full guide: docs/beta/deploy.md).

  Recommended — SELF-HOSTED (Docker Compose, low/no recurring cost):
    1. cp deploy/.env.deploy.example deploy/.env.deploy   # then fill the secrets
    2. docker compose -f deploy/docker-compose.yml --env-file deploy/.env.deploy up -d --build
    3. open http://localhost:8080  (point PUBLISH_PORT/CMS_URL at your domain for prod)

  Optional — MANAGED (Strapi Cloud + Vercel, ~US$38/mo for a real site):
    Deploy cms to Strapi Cloud, then web to Vercel with CMS_URL set to the live
    cms origin. Steps + caveats in docs/beta/deploy.md.

  Deploy order is always cms first (it owns the public origin + DB), then web wired
  to the live CMS_URL.
`;

/**
 * Finalized command surface (Spec 5): validates prereqs and emits the documented
 * self-hosted + managed paths. press does not orchestrate the provider for the
 * adopter — it hands them a verified, copy-pasteable path.
 */
export async function deployCommand(opts: DeployOptions): Promise<void> {
  const r = validateDeployPrereqs(opts.cwd);
  if (!r.ok) {
    for (const e of r.errors) console.error(`deploy: ${e}`);
    throw new Error('deploy prerequisites not met');
  }
  console.log(GUIDE_PATH);
}
```

- [ ] **Step 4: Run the deploy tests**

Run: `pnpm --filter @press/cli exec vitest run src/commands/deploy.test.ts`
Expected: PASS (existing prereq tests + the two new kit tests).

- [ ] **Step 5: Run the full CLI test suite (no regressions)**

Run: `pnpm --filter @press/cli test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/press-cli/src/commands/deploy.ts packages/press-cli/src/commands/deploy.test.ts
git commit -m "feat(deploy): finalize press deploy — real two-path guidance + kit prereq"
```

---

### Task 6: Write the deploy guide

**Files:**
- Create: `docs/beta/deploy.md`
- Modify: `README.md`

Prose deliverable; its correctness is enforced by Task 4's harness (self-hosted) and a manual doc-follow pass (managed). No TDD step.

- [ ] **Step 1: Write `docs/beta/deploy.md`**

Create `docs/beta/deploy.md` with these sections (write full prose, not an outline):

1. **TL;DR + deploy order.** cms first (public origin + DB + secrets), then web wired to the live `CMS_URL`. Both halves are needed; the web host is materialized by `press build`, never committed.
2. **Prerequisites.** Node 20, pnpm 10, Docker (self-hosted) or Strapi Cloud + Vercel accounts (managed); private `@press/*` registry access; a domain for production.
3. **Self-hosted (recommended).** Exact, copy-pasteable steps:
   - `press build`
   - `cp deploy/.env.deploy.example deploy/.env.deploy`, generate every secret with `openssl rand -base64 16`, set `PUBLISH_PORT`/`CMS_URL` to your domain (or `:8080`/`localhost` to try locally).
   - `docker compose -f deploy/docker-compose.yml --env-file deploy/.env.deploy up -d --build`
   - Explain the single-origin topology and **why `CMS_URL` must be the public origin** (the hero image `src` is browser-loaded). Explain build-then-ship (the image copies host-built artifacts) and the same-arch caveat.
   - Persistence caveat: Postgres is on a named volume; uploaded media lives on the cms container's disk — mount a volume for `cms/public/uploads` (or an upload provider) so media survives a redeploy.
   - Verify: `pnpm deploy:smoke` reproduces this exact path end-to-end.
4. **Managed (Strapi Cloud + Vercel).** Cost up front (~US$18/mo Strapi Cloud Essential + ~US$20/mo Vercel Pro for commercial). Steps: deploy `cms/` to Strapi Cloud (Postgres provisioned by the platform; set the same secrets); note the **materialized-host wrinkle** for Vercel — there is no committed Next app, so set the Vercel **Build Command** to `pnpm press build`, **Output Directory** to `.press/web/.next`, add the `@press/*` registry token via `.npmrc` + `NPM_TOKEN`, and set `CMS_URL` to the live Strapi Cloud origin. Call out that this path is documented but not covered by the smoke harness (no paid accounts in CI).
5. **AWS / other clouds.** One paragraph: the self-hosted Compose stack runs unchanged on any VM (EC2/Lightsail/Hetzner); a first-class AWS-native path (ECS + RDS + Amplify) is future work, out of beta scope.
6. **Troubleshooting.** CMS_URL/media 404s, missing secrets, registry-auth failures, sqlite-in-production gotcha.

- [ ] **Step 2: Add the README run section**

In `README.md`, after the "Update path + contract guard (Spec 4)" section, add a "Run the deploy (Spec 5)" section: summarize the two paths, point to `docs/beta/deploy.md`, and document the harness:

````markdown
## Run the deploy (Spec 5)

press ships two deploy paths; the full guide is `docs/beta/deploy.md`.

- **Self-hosted (recommended)** — `deploy/docker-compose.yml` brings up Postgres +
  cms + web + a Caddy single-origin proxy. From a created project root:

  ```bash
  press build
  cp deploy/.env.deploy.example deploy/.env.deploy   # fill secrets + CMS_URL
  docker compose -f deploy/docker-compose.yml --env-file deploy/.env.deploy up -d --build
  ```

- **Managed** — Strapi Cloud (cms) + Vercel (web); steps + cost in the guide.

The self-hosted path is proven end-to-end in production mode (Postgres, `strapi start`,
`next start`) by the deploy smoke harness:

```bash
pnpm deploy:smoke
#  → "DEPLOY SMOKE PASS: ... rendered hero + callout + whitelabel head through Caddy."
```
````

- [ ] **Step 3: Commit**

```bash
git add docs/beta/deploy.md README.md
git commit -m "docs(deploy): add Spec 5 deploy guide (self-hosted primary + managed)"
```

---

### Task 7: CI gate for the deploy smoke

**Files:**
- Create: `.github/workflows/deploy-smoke.yml`
- Reference: `.github/workflows/contract-guard.yml` (mirror its Node/pnpm setup)

- [ ] **Step 1: Read the existing workflow**

Read `.github/workflows/contract-guard.yml` to copy its Node 20 / pnpm 10 setup, Verdaccio handling, and trigger style.

- [ ] **Step 2: Write the workflow**

Create `.github/workflows/deploy-smoke.yml` mirroring the contract-guard setup, triggered on `workflow_dispatch` and on PRs touching `packages/press-cli/templates/project/deploy/**`, `scripts/deploy-smoke.mjs`, or `packages/press-web/host-template/**`. Steps: checkout, setup pnpm + Node 20, `pnpm install`, then `pnpm deploy:smoke`. GitHub-hosted Ubuntu runners include Docker + Compose, so no extra Docker setup is needed; do NOT add a `host.docker.internal` step (the Compose `extra_hosts` already handles Linux). Job name `deploy-smoke` so it can later be flipped to a required check.

- [ ] **Step 3: Validate the workflow YAML locally**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/deploy-smoke.yml','utf8'); if(!/deploy:smoke|deploy-smoke\.mjs/.test(y)) throw new Error('workflow does not run the smoke'); console.log('workflow OK')"`
Expected: `workflow OK`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-smoke.yml
git commit -m "ci(deploy): gate the deploy smoke on deploy-kit changes + manual dispatch"
```

---

### Task 8: Mark Spec 5 done in the roadmap

**Files:**
- Modify: `docs/beta/roadmap.md`

- [ ] **Step 1: Flip the status row**

In `docs/beta/roadmap.md`, change the Spec 5 table row status from `Planned` to `✅ Done`.

- [ ] **Step 2: Add the outcome paragraph**

After the "## Spec 4 — outcome (done)" section, add a "## Spec 5 — outcome (done)" section summarizing: two paths shipped (self-hosted Docker Compose primary; Strapi Cloud + Vercel documented, cost flagged); the runtime-`CMS_URL`/single-origin media insight; build-then-ship for the materialized host; and that `scripts/deploy-smoke.mjs` (`pnpm deploy:smoke`) proves the self-hosted path end-to-end in production mode against Postgres, gated in CI by `deploy-smoke.yml`.

- [ ] **Step 3: Commit**

```bash
git add docs/beta/roadmap.md
git commit -m "docs(roadmap): mark Spec 5 (deploy guide) done"
```

---

## Self-Review

**1. Spec coverage (PRD §6 "Deploy guide for at least one managed and one self-hosted path", Q1 "first deploy unaided"):**
- Self-hosted path → Tasks 2, 3, 6 (kit + scaffold + guide), proven by Task 4. ✓
- Managed path → Task 6 §4 (documented). ✓
- "Unaided / following only docs" → the guide (Task 6) + the harness that proves the guide's self-hosted steps actually work (Task 4). ✓
- `press deploy` finalized from the Spec-3 stub → Task 5. ✓

**2. Placeholder scan:** The `*.example`/`.template` files contain literal `REPLACE_ME` tokens **by design** (they are env templates the adopter fills) — these are not plan placeholders. The only non-literal step is Task 6's prose guide, which is itemized section-by-section. No `TODO`/`implement later`/uncoded steps remain.

**3. Type/name consistency:**
- `validateDeployPrereqs(root)` returns `{ ok, errors }` — same signature in Task 5's code and tests. ✓
- Env var names align across artifacts: `CMS_URL`, `PUBLISH_PORT`, `DATABASE_URL`/`DATABASE_USERNAME`/`DATABASE_PASSWORD`/`DATABASE_NAME` match `templates/cms/config/database.ts` (`DATABASE_URL`, `DATABASE_*`) and `server.ts`. ✓
- Compose service names (`db`, `seed`, `cms`, `web`, `caddy`) referenced consistently in `docker-compose.yml`, `Caddyfile` (`cms:1337`, `web:3000`), and the harness. ✓
- `CMS_URL=http://host.docker.internal:8080` is used identically in the harness env block and asserted against in the image-src check. ✓
- Render assertions (`Hello from press`, `Adopter callout renders via the Project-zone block map`) match the strings `scripts/e2e-check.mjs` already asserts against the same seed. ✓

**Risk to watch at execution:** the `press create --registry` flag name and the scaffold test's helper names (`scaffoldProject`, imports of `existsSync`/`readFileSync`) are assumed from the Spec-3 code — verify against the actual `create.ts` / `scaffold.test.ts` at execution and adjust the invocation/imports to match (noted inline in Tasks 3 and 4). The smoke requires Docker; it self-checks and fails with a clear message if absent.
