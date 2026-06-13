// scripts/deploy-smoke.mjs — Spec 5 proof: the self-hosted Docker path actually
// deploys and renders, in PRODUCTION mode against Postgres. Steps:
//   1. local Verdaccio + publish @press/cms, @press/web, @press/cli (reuse Spec 4 lib)
//   2. `press create` a throwaway project (installs against Verdaccio)
//   3. `press build` — materialize .press/web + strapi build + next build
//   4. write deploy/.env.deploy with real secrets + CMS_URL = host.docker.internal origin
//   5. docker compose up --build (postgres + seed + cms + web + caddy)
//   6. assert the seeded /home renders hero + callout + whitelabel <head> through Caddy
//   7. tear everything down (compose down -v, registry, temp dir)
// Exit 0 = "DEPLOY SMOKE PASS"; any failed assertion = non-zero with a clear message.
//
// HOST CONSTRAINT: this is build-then-ship — the images copy the host-installed
// node_modules (incl. native deps like sharp). It is therefore SAME-ARCH only: run
// it on Linux (CI: deploy-smoke.yml) or a Linux build host. On macOS the copied
// darwin native binaries cannot load inside the Linux containers (sharp/seed will
// fail) — that is the documented build-then-ship limitation, not a harness bug.
//
// NEGATIVE TEST (manual, per plan): set CMS_URL below to 'http://cms:1337' (the
// internal hostname). The container-to-container API fetch still works, but the
// image-src assertion fails ("image src not absolute against the public CMS
// origin: http://cms:1337/uploads/..."), proving the harness guards the
// runtime-CMS_URL contract. Revert to restore green.
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { startRegistry, stopRegistry, publishedVersions, REGISTRY_URL } from './lib/registry.mjs';

const ROOT = process.cwd();
const NPMRC = path.join(ROOT, '.npmrc');
const PRESS_BIN = path.join(ROOT, 'packages/press-cli/bin/press.js');
const ORIGIN = 'http://localhost:8080';
const CMS_URL_INTERNAL = 'http://host.docker.internal:8080';
const b64 = () => randomBytes(16).toString('base64');
const fail = (msg) => { console.error('DEPLOY SMOKE FAIL:', msg); process.exit(1); };
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });

function requireDocker() {
  const r = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' });
  if (r.status !== 0) fail('docker compose is required to run the deploy smoke.');
}

// Build (when a build script exists) + publish a workspace package to Verdaccio at
// its CURRENT version — mirrors scripts/cli-e2e.mjs. Unlike registry.mjs's
// buildAndPublish this does NOT bump package.json (no working-tree mutation); a
// re-published existing version is tolerated so local re-runs are idempotent.
function publish(filter, dir) {
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  if (pkg.scripts?.build) sh(`pnpm --filter "${filter}" build`, { cwd: ROOT });
  try {
    sh(`npm publish --registry ${REGISTRY_URL} --userconfig "${NPMRC}"`, { cwd: dir });
  } catch (e) {
    if (publishedVersions(filter).includes(pkg.version)) {
      console.warn(`[smoke] ${filter}@${pkg.version} already published — reusing`);
    } else {
      throw e;
    }
  }
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
    sh(`docker compose -f "${composeFile}" --env-file "${envFile}" ${args}`, { cwd: project });

  startRegistry(ROOT);
  try {
    // 1. publish the engine + cli to the local registry. @press/cli's build also
    //    produces packages/press-cli/dist so the local bin below is runnable.
    publish('@press/cms', path.join(ROOT, 'packages/press-cms'));
    publish('@press/web', path.join(ROOT, 'packages/press-web'));
    publish('@press/cli', path.join(ROOT, 'packages/press-cli'));

    // 2. scaffold + install the throwaway project against Verdaccio (`press
    //    create` runs `pnpm install` itself).
    sh(`node "${PRESS_BIN}" create "${project}" --registry ${REGISTRY_URL}`, { cwd: ROOT });

    // 3. production build of both halves.
    sh(`node "${PRESS_BIN}" build`, { cwd: project });
    if (!existsSync(path.join(project, '.press', 'web', '.next'))) {
      fail('press build did not produce .press/web/.next');
    }

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
