#!/usr/bin/env node
// scripts/contract-guard.mjs — the standing contract guard (Spec 4).
// One real, both-package, render-deep update cycle vN -> vN+1 against an ephemeral
// Verdaccio, failing on any leak class (file / boot / behavioral). Runs identically
// on a laptop and in CI. Self-contained: starts and stops its own registry.
import { startRegistry, stopRegistry, buildAndPublish, readPackageVersion } from './lib/registry.mjs';
import { lastEngineTag, withWorktree, tagCommit, headCommit } from './lib/baseline.mjs';
import { hashZone, diffZones, findFileLeaks, manifestVersionOnlyViolation } from './lib/leak-snapshot.mjs';
import { sh, shInherit } from './lib/sh.mjs';
import { copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  pinAdopter, assertGreen, runUpdate, manifestTexts, restoreAdopter, stopCms, stopWeb, pregenerateTypes,
} from './lib/adopter-cycle.mjs';

const root = process.cwd();
const CMS = { filter: '@press/cms', pkgDir: `${root}/packages/press-cms` };
const WEB = { filter: '@press/web', pkgDir: `${root}/packages/press-web` };
const ADOPTER_ZONES = ['apps/cms', 'apps/web', 'pnpm-lock.yaml'];
const ALLOWED_DELTA = new Set(['apps/cms/package.json', 'apps/web/package.json', 'pnpm-lock.yaml']);

const log = (m) => console.log(`\n=== ${m} ===`);
const fail = (m) => { console.error(`\nCONTRACT GUARD FAILED — ${m}`); process.exitCode = 1; throw new Error(m); };

// Short content hash of the engine source under `dir`. Reflects working-tree edits
// (unlike the commit sha), so a content-addressed publish label changes whenever the
// engine code does — guaranteeing the guard publishes and consumes the exact code
// under test instead of reusing a stale registry tarball for a same-sha label.
function engineContentHash(dir) {
  // hashZone skips dist/build/node_modules (EXCLUDED_DIRS), so hashing each package
  // root captures the engine source regardless of its internal layout.
  const map = hashZone(['packages/press-cms', 'packages/press-web'], dir);
  const combined = [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([p, h]) => `${p}:${h}`)
    .join('\n');
  return createHash('sha256').update(combined).digest('hex').slice(0, 12);
}

async function main() {
  // 1. Ephemeral registry.
  log('start ephemeral Verdaccio');
  startRegistry(root);

  // 1b. Generate @press/web types ON DISK before any publish, so generated.ts ships
  // inside every tarball (press-web/.npmignore contract). Without this the first
  // publish bakes a tarball whose @press/web/types resolves to a missing module and
  // the GREEN baseline build fails on the absent CustomCallout export.
  log('pre-generate @press/web types (sync-types -> generated.ts on disk)');
  pregenerateTypes(root);

  // 2-4. Resolve baseline & candidate versions, publish BOTH for BOTH packages.
  const tag = lastEngineTag();
  const bootstrap = !tag;
  const headCmsV = readPackageVersion(CMS.pkgDir);
  const headWebV = readPackageVersion(WEB.pkgDir);

  // Content-addressed version labels for baseline and candidate. The suffix is a hash
  // of the engine SOURCE the tarball is built from, not the commit sha — so:
  //  (1) baseline `…-base.<hash>` and candidate `…-contract.<hash>` are distinct
  //      artifacts (different prefixes) that move through a real publish→install→update
  //      cycle even in bootstrap; and
  //  (2) the label changes whenever the engine source changes, INCLUDING uncommitted
  //      working-tree edits (the commit sha would not). The guard therefore publishes
  //      and consumes the EXACT code under test — a registry can never serve a stale
  //      tarball for a reused label, and the AC2 negative test's uncommitted regression
  //      is published as a genuinely new candidate instead of colliding with a prior
  //      clean tarball. In CI the registry is empty so this is moot.
  const candHash = engineContentHash(root);
  const baseLabel = (v, hash) => `${v}-base.${hash}`;
  const candLabel = (v) => `${v}-contract.${candHash}`;

  let baseCmsV, baseWebV;
  if (bootstrap) {
    console.log('BOOTSTRAP: no baseline tag, harness-only run (baseline code == candidate code)');
    baseCmsV = baseLabel(headCmsV, candHash);
    baseWebV = baseLabel(headWebV, candHash);
    buildAndPublish({ root, ...CMS, version: baseCmsV });
    buildAndPublish({ root, ...WEB, version: baseWebV });
  } else if (tagCommit(tag) === headCommit() && !sh('git status --porcelain -- packages', { cwd: root })) {
    // Fast path: tag points at HEAD AND the engine source (packages/) is clean, so the
    // working tree IS the tagged code — build the baseline from HEAD, skip the worktree.
    // A dirty packages/ tree (e.g. the AC2 negative test's uncommitted regression) must
    // NOT build the baseline from HEAD; it falls through to the clean tag worktree below
    // so the regression is tested as vN+1 against a pristine vN, not leaked into both.
    console.log(`baseline tag ${tag} == HEAD (clean engine tree); building baseline from HEAD`);
    baseCmsV = baseLabel(headCmsV, candHash);
    baseWebV = baseLabel(headWebV, candHash);
    buildAndPublish({ root, ...CMS, version: baseCmsV });
    buildAndPublish({ root, ...WEB, version: baseWebV });
  } else {
    // Build the baseline engine from its tag in a throwaway clean worktree (used when
    // the tag predates HEAD, or HEAD's engine tree is dirty). The candidate still builds
    // from the dirty HEAD tree below, so an uncommitted engine change is tested as vN+1.
    console.log(`building baseline engine from tag ${tag} (clean worktree)`);
    withWorktree(tag, (dir) => {
      // generated.ts is gitignored, so it's absent in the clean checkout. Reuse the
      // types pregenerated against the HEAD CMS (copied in BEFORE hashing/building):
      // the guard tests the render contract against ONE schema shared by both engine
      // versions, so the baseline ships the same generated.ts as the candidate.
      copyFileSync(
        `${root}/packages/press-web/src/types/generated.ts`,
        `${dir}/packages/press-web/src/types/generated.ts`,
      );
      const baseHash = engineContentHash(dir);
      baseCmsV = baseLabel(readPackageVersion(`${dir}/packages/press-cms`), baseHash);
      baseWebV = baseLabel(readPackageVersion(`${dir}/packages/press-web`), baseHash);
      buildAndPublish({ root: dir, filter: CMS.filter, pkgDir: `${dir}/packages/press-cms`, version: baseCmsV });
      buildAndPublish({ root: dir, filter: WEB.filter, pkgDir: `${dir}/packages/press-web`, version: baseWebV });
    });
  }

  // Candidate = HEAD working-tree code at a distinct content-addressed label.
  const candCmsV = candLabel(headCmsV);
  const candWebV = candLabel(headWebV);
  log(`publish candidate vN+1 (cms ${candCmsV}, web ${candWebV})`);
  buildAndPublish({ root, ...CMS, version: candCmsV });
  buildAndPublish({ root, ...WEB, version: candWebV });
  try {
    // Restore the engine package.json versions buildAndPublish mutated. MUST run
    // before pinAdopter: it puts the workspace versions back to their committed
    // values so they no longer match the synthetic version the adopter resolves,
    // forcing pnpm to fetch the registry tarball instead of linking the workspace
    // copy. Inside the try so a failure here still triggers the finally teardown.
    shInherit(`git checkout -- packages/press-cms/package.json packages/press-web/package.json`, { cwd: root });

    // 5. Stage adopter @ vN and assert GREEN baseline (project really works at vN).
    log(`stage adopter @ vN (cms ${baseCmsV}, web ${baseWebV})`);
    pinAdopter(root, { cms: baseCmsV, web: baseWebV });
    log('assert GREEN baseline (seed + boot + render @ vN)');
    assertGreen(root);

    // 6. Snapshot the Project zone, then run THE update path.
    const before = hashZone(ADOPTER_ZONES, root);
    const beforeManifests = manifestTexts(root);
    log(`pnpm update @press/* -> vN+1 (cms ${candCmsV}, web ${candWebV})`);
    try { runUpdate(root, { cms: candCmsV, web: candWebV }); }
    catch {
      // prerelease range fallback (see adopter-cycle soft spot).
      shInherit(`pnpm --filter cms add @press/cms@${candCmsV}`, { cwd: root });
      shInherit(`pnpm --filter web add @press/web@${candWebV}`, { cwd: root });
    }

    // 7. FILE leak: only the allowed delta moved.
    log('assert FILE leak: none');
    const diff = diffZones(before, hashZone(ADOPTER_ZONES, root));
    const leaks = findFileLeaks(diff, ALLOWED_DELTA);
    if (leaks.length) fail(`Project-zone files changed by the update:\n  - ${leaks.join('\n  - ')}`);
    const afterManifests = manifestTexts(root);
    for (const m of Object.keys(beforeManifests)) {
      const v = manifestVersionOnlyViolation(beforeManifests[m], afterManifests[m]);
      if (v) fail(`${m}: ${v}`);
    }
    console.log('OK: only allowed delta changed (both @press/* ranges + lockfile).');

    // 8-10. ENGINE-IN-HOST + BOOT + BEHAVIORAL leak, all via the green-render check.
    log('assert BOOT + BEHAVIORAL leak: none (rebuild, reseed, render @ vN+1)');
    assertGreen(root);

    log(`CONTRACT HELD${bootstrap ? ' (BOOTSTRAP harness-only run — no regression coverage yet)' : ''}`);
  } finally {
    // 11. Teardown.
    stopCms();
    stopWeb();
    restoreAdopter(root);
    // Belt-and-suspenders: re-restore the engine package.json versions in case a
    // failure left them at a synthetic label (idempotent on the happy path).
    try { shInherit(`git checkout -- packages/press-cms/package.json packages/press-web/package.json`, { cwd: root }); } catch {}
    stopRegistry(root);
  }
}

main().catch((e) => {
  console.error(e?.stack ?? String(e));
  process.exitCode = process.exitCode || 1;
});
