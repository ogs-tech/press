// scripts/cli-e2e.mjs — Spec 3 acceptance gate (AC1–AC4).
// Publishes @press/web + @press/cli to Verdaccio, runs `press create` into a
// scratch dir, installs, then exercises dev/build and asserts:
//   AC1 create → §6 manifest (web host ABSENT) + green install
//   AC2 dev → cms+web boot, seeded page server-renders (hero + custom callout)
//   AC3 build → built web reflects press.config.ts (<title>, canonical, og)
//   AC4 purity → git status clean (no engine/host file is committed)
//
// Prereqs: scripts/registry.sh start; @press/cms@0.3.2 already published.
// Usage: node scripts/cli-e2e.mjs
import { execSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const REGISTRY = 'http://localhost:4873';
const REPO = process.cwd();
const NPMRC = path.join(REPO, '.npmrc');
const CMS_URL = 'http://localhost:1337';
const WEB = 'http://localhost:3000/home';

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const shOut = (cmd, opts = {}) =>
  (execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts }) ?? '').trim();
const fail = (msg) => {
  console.error('CLI-E2E FAIL:', msg);
  process.exit(1);
};

async function waitFor(url, okStatus, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === okStatus || (okStatus === 200 && res.ok)) return await res.text();
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

function publish(filterPkg, dir) {
  console.log(`> build + publish ${filterPkg}`);
  // @press/web ships TS source (Next transpiles it via transpilePackages) and has
  // no build script; @press/cli compiles to dist/. Build only when a build script
  // exists so the publish step is uniform across both shapes.
  const hasBuild = !!JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).scripts?.build;
  if (hasBuild) sh(`pnpm --filter ${filterPkg} build`);
  // --userconfig points npm at the repo .npmrc (registry route + token).
  sh(`npm publish --registry ${REGISTRY} --userconfig "${NPMRC}"`, { cwd: dir });
}

async function main() {
  // Registry must be up.
  if (!shOut(`curl -s -o /dev/null -w "%{http_code}" ${REGISTRY}/ || true`).includes('200')) {
    fail('Verdaccio not running — run: scripts/registry.sh start');
  }

  // 0. Publish the engine + cli (real tarballs, real semver).
  publish('@press/web', path.join(REPO, 'packages/web'));
  publish('@press/cli', path.join(REPO, 'packages/cli'));

  // 1. press create into a scratch dir (AC1).
  const parent = mkdtempSync(path.join(tmpdir(), 'press-cli-e2e-'));
  const project = path.join(parent, 'my-site');
  const pressBin = path.join(REPO, 'packages/cli/bin/press.js');
  console.log('> press create my-site');
  sh(`node ${pressBin} create my-site --registry ${REGISTRY}`, { cwd: parent });

  const has = (rel) => existsSync(path.join(project, rel));
  // Three-zone adopter files present (web/cms/shared).
  for (const f of [
    'web/config.ts',
    'web/blocks/custom/Callout.tsx',
    'web/blocks/custom/index.ts',
    'shared/package.json',
    'shared/types/index.ts',
    'content/seed.mjs',
    'cms/config/plugins.ts',
    'cms/package.json',
    'cms/.env',
    'package.json',
    '.gitignore',
  ]) {
    if (!has(f)) fail(`AC1: expected adopter file missing: ${f}`);
  }
  // Next host ABSENT — the ultra-thin guarantee (materialized only on dev/build).
  for (const f of ['app', 'next.config.ts', 'web/next.config.ts', 'app/layout.tsx', '.press']) {
    if (has(f)) fail(`AC1: Next host leaked into create output: ${f}`);
  }
  // pnpm install ran during create — node_modules + @press/* resolved.
  if (!has('node_modules/@press/web/package.json')) fail('AC1: @press/web not installed');
  if (!has('node_modules/@press/cli/package.json')) fail('AC1: @press/cli not installed');
  console.log('AC1 PASS: §6 manifest written, no web host, install green.');

  // 2. Commit the created project so AC4 can diff against a clean tree.
  sh('git init -q', { cwd: project });
  sh('git add -A', { cwd: project });
  sh('git -c user.email=e2e@press -c user.name=e2e commit -q -m "scaffold"', { cwd: project });

  // 3. press dev → assert the seeded page server-renders (AC2).
  console.log('> press dev (backgrounded)');
  const dev = spawn('node', [pressBin, 'dev'], { cwd: project, stdio: 'inherit' });
  try {
    const html = await waitFor(WEB, 200, 90);
    if (html === null) fail('AC2: web did not serve /home under press dev');
    if (!html.includes('Hello from press')) fail('AC2: hero heading missing');
    if (!html.includes('Adopter callout renders via the Project-zone block map'))
      fail('AC2: custom callout missing');
    console.log('AC2 PASS: dev boots the stack; hero + custom callout server-render.');
  } finally {
    dev.kill('SIGINT');
    // Give children time to die before the build phase reclaims the ports.
    await new Promise((r) => setTimeout(r, 4000));
  }

  // 4. press build → start the built web → assert config in <head> (AC3).
  console.log('> press build');
  sh(`node ${pressBin} build`, { cwd: project });
  // Boot cms (built start) so the dynamic route can fetch at request time.
  const cms = spawn('pnpm', ['-C', 'cms', 'start'], { cwd: project, stdio: 'inherit' });
  const web = spawn('pnpm', ['exec', 'next', 'start', '.press/web', '-p', '3000'], {
    cwd: project,
    stdio: 'inherit',
    env: { ...process.env, CMS_URL },
  });
  try {
    // _health returns 204 with an EMPTY body — compare against null (the timeout
    // sentinel), not truthiness, or the empty success string reads as a failure.
    if ((await waitFor(`${CMS_URL}/_health`, 204)) === null)
      fail('AC3: cms did not boot for build render');
    const html = await waitFor(WEB, 200, 90);
    if (html === null) fail('AC3: built web did not serve /home');
    // Spec 2 surfaces from press.config.ts, now in the PRODUCTION render.
    if (!html.includes('<title>E2E Home | Acme</title>'))
      fail('AC3: <title> not templated from config');
    if (!/<link rel="canonical" href="https:\/\/acme\.test"/.test(html))
      fail('AC3: canonical not from site.url');
    if (!/<meta property="og:image"[^>]*content="https:\/\/acme\.test\/og\.png"/.test(html))
      fail('AC3: og:image not absolute against site.url');
    console.log('AC3 PASS: built web reflects press.config.ts (title/canonical/og).');
  } finally {
    web.kill();
    cms.kill();
    await new Promise((r) => setTimeout(r, 2000));
  }

  // 5. Project-zone purity — git status clean after dev+build (AC4).
  const dirty = shOut('git status --porcelain', { cwd: project });
  if (dirty) fail(`AC4: working tree not clean after dev/build — leaked:\n${dirty}`);
  console.log('AC4 PASS: git status clean — no engine/host file committed; artifacts gitignored.');

  console.log('\nCLI-E2E PASS: AC1–AC4 green.');
  rmSync(parent, { recursive: true, force: true });
}

main().catch((e) => fail(e?.message ?? String(e)));
