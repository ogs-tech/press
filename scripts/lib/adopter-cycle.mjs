// scripts/lib/adopter-cycle.mjs — the adopter side of the update cycle (spec §4.2).
// Stages the REAL host (apps/cms + apps/web) at a version set, proves it green,
// runs the update, and surfaces disk state for the orchestrator's leak asserts.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sh, shInherit, bash } from './sh.mjs';

const ADOPTER_MANIFESTS = ['apps/cms/package.json', 'apps/web/package.json'];

/** Rewrite the @press/* dependency ranges in both adopter manifests to exact versions. */
export function pinAdopter(root, { cms, web }) {
  setDep(join(root, 'apps/cms/package.json'), '@press/cms', cms);
  setDep(join(root, 'apps/web/package.json'), '@press/web', web);
  shInherit(`pnpm install --no-frozen-lockfile`, { cwd: root });
}

function setDep(file, name, version) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  // Fail loud and named: a guard that can't find the dep it pins must not crash
  // with a cryptic "Cannot set properties of undefined" — the message must say
  // which package and which manifest, so a refactor that moves the dep is obvious.
  if (!pkg.dependencies?.[name]) throw new Error(`setDep: '${name}' not found in dependencies of ${file}`);
  pkg.dependencies[name] = version;
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
}

/** Boot the CMS detached; resolve when /_health returns 204 (spec §4.2 boot-leak). */
export function startCms(root) {
  const out = bash(
    `( pnpm --filter cms start > /tmp/guard-cms.log 2>&1 & echo $! > /tmp/guard-cms.pid; ` +
    `for i in $(seq 1 90); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health||true); ` +
    `[ "$c" = "204" ] && { echo BOOTOK; break; }; sleep 2; done )`,
    { cwd: root },
  );
  if (!out.includes('BOOTOK')) throw new Error('BOOT LEAK: CMS did not reach /_health 204 — see /tmp/guard-cms.log');
}

export function stopCms() {
  try { bash(`[ -f /tmp/guard-cms.pid ] && kill "$(cat /tmp/guard-cms.pid)" 2>/dev/null; pkill -f "strapi start" 2>/dev/null; true`); } catch {}
}

/**
 * Prove the staged project really works (spec §4.2 step 5 / step 10): seed a page
 * with press.hero + custom.callout, boot the CMS, sync types, then run the seeded
 * e2e render (blocks + whitelabel <head>). Throws on any failure.
 */
export function assertGreen(root) {
  stopCms(); // seed boots Strapi in-process; the port must be free first.
  shInherit(`node ../../scripts/seed-e2e.mjs`, { cwd: join(root, 'apps/cms') });
  startCms(root);
  try {
    shInherit(`pnpm --filter @press/web sync-types`, { cwd: root });
    // e2e-check builds + starts apps/web itself and asserts both blocks + <head>.
    shInherit(`node scripts/e2e-check.mjs`, { cwd: root });
    // Host-thinness invariant (engine-in-host leak class).
    shInherit(`node scripts/assert-no-engine-in-host.mjs`, { cwd: root });
  } finally {
    stopCms();
  }
}

/** THE update path the real adopter runs (spec §2.1): bump both @press/* to vN+1. */
export function runUpdate(root, { cms, web }) {
  shInherit(`pnpm --filter cms update @press/cms@${cms}`, { cwd: root });
  shInherit(`pnpm --filter web update @press/web@${web}`, { cwd: root });
}

/**
 * Original on-disk text of both manifests (for the version-only diff). Must be
 * called AFTER pinAdopter (pnpm may reformat package.json during install): the
 * orchestrator uses this post-install snapshot as the before-baseline, so the
 * after-update snapshot is compared like-for-like and pnpm reformatting cannot
 * masquerade as a leak.
 */
export function manifestTexts(root) {
  return Object.fromEntries(ADOPTER_MANIFESTS.map((m) => [m, readFileSync(join(root, m), 'utf8')]));
}

/** Restore the adopter to its committed state (manifests + lockfile + web workspace:*). */
export function restoreAdopter(root) {
  try {
    shInherit(`git checkout -- apps/cms/package.json apps/web/package.json pnpm-lock.yaml`, { cwd: root });
    shInherit(`pnpm install --no-frozen-lockfile`, { cwd: root });
  } catch (e) {
    console.warn('[guard] adopter restore failed:', e.message);
  }
}
