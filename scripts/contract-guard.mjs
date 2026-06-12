#!/usr/bin/env node
// scripts/contract-guard.mjs — the standing contract guard (Spec 4).
// One real, both-package, render-deep update cycle vN -> vN+1 against an ephemeral
// Verdaccio, failing on any leak class (file / boot / behavioral). Runs identically
// on a laptop and in CI. Self-contained: starts and stops its own registry.
import { startRegistry, stopRegistry, buildAndPublish, readPackageVersion } from './lib/registry.mjs';
import { lastEngineTag, withWorktree, tagCommit, headCommit, shortSha } from './lib/baseline.mjs';
import { hashZone, diffZones, findFileLeaks, manifestVersionOnlyViolation } from './lib/leak-snapshot.mjs';
import { shInherit } from './lib/sh.mjs';
import {
  pinAdopter, assertGreen, runUpdate, manifestTexts, restoreAdopter, stopCms, pregenerateTypes,
} from './lib/adopter-cycle.mjs';

const root = process.cwd();
const CMS = { filter: '@press/cms', pkgDir: `${root}/packages/press-cms` };
const WEB = { filter: '@press/web', pkgDir: `${root}/packages/press-web` };
const ADOPTER_ZONES = ['apps/cms', 'apps/web', 'pnpm-lock.yaml'];
const ALLOWED_DELTA = new Set(['apps/cms/package.json', 'apps/web/package.json', 'pnpm-lock.yaml']);

const log = (m) => console.log(`\n=== ${m} ===`);
const fail = (m) => { console.error(`\nCONTRACT GUARD FAILED — ${m}`); process.exitCode = 1; throw new Error(m); };

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

  // Run-scoped synthetic version labels for BOTH baseline and candidate. Two reasons:
  //  (1) Distinct artifacts by construction — baseline `…-base.<sha>` and candidate
  //      `…-contract.<sha>` are always two different published tarballs, so the update
  //      path moves through a real publish→install→update cycle even in bootstrap.
  //  (2) The guard always controls the EXACT tarball content it tests: a fresh label is
  //      republished cleanly every run, so a shared/non-ephemeral registry can never
  //      serve a stale tarball for a reused version string (npm publish refuses to
  //      overwrite an existing version; a stale one would otherwise silently win). In
  //      CI the registry is empty so this is a no-op; locally it makes re-runs robust.
  const sha = shortSha();
  const baseLabel = (v) => `${v}-base.${sha}`;
  const candLabel = (v) => `${v}-contract.${sha}`;

  let baseCmsV, baseWebV;
  if (bootstrap) {
    console.log('BOOTSTRAP: no baseline tag, harness-only run (baseline code == candidate code)');
    baseCmsV = baseLabel(headCmsV);
    baseWebV = baseLabel(headWebV);
    buildAndPublish({ root, ...CMS, version: baseCmsV });
    buildAndPublish({ root, ...WEB, version: baseWebV });
  } else if (tagCommit(tag) === headCommit()) {
    // Fast path: tag points at HEAD — baseline code == HEAD code, skip the worktree.
    console.log(`baseline tag ${tag} == HEAD; building baseline from HEAD`);
    baseCmsV = baseLabel(headCmsV);
    baseWebV = baseLabel(headWebV);
    buildAndPublish({ root, ...CMS, version: baseCmsV });
    buildAndPublish({ root, ...WEB, version: baseWebV });
  } else {
    // Build the baseline engine from its tag in a throwaway worktree.
    console.log(`building baseline engine from tag ${tag}`);
    withWorktree(tag, (dir) => {
      baseCmsV = baseLabel(readPackageVersion(`${dir}/packages/press-cms`));
      baseWebV = baseLabel(readPackageVersion(`${dir}/packages/press-web`));
      buildAndPublish({ root: dir, filter: CMS.filter, pkgDir: `${dir}/packages/press-cms`, version: baseCmsV });
      buildAndPublish({ root: dir, filter: WEB.filter, pkgDir: `${dir}/packages/press-web`, version: baseWebV });
    });
  }

  // Candidate = HEAD code at a distinct run-scoped label.
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
