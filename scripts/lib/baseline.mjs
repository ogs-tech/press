// scripts/lib/baseline.mjs — baseline resolution + synthetic versions (spec §4.1, §4.3).
import { sh, shInherit } from './sh.mjs';
import { rmSync } from 'node:fs';

/** Newest engine release tag (engine-vX.Y.Z), or null in bootstrap. */
export function lastEngineTag() {
  const tags = sh(`git tag --list 'engine-v*' --sort=-v:refname`).split('\n').filter(Boolean);
  return tags[0] ?? null;
}

export const shortSha = () => sh('git rev-parse --short HEAD');
export const headCommit = () => sh('git rev-parse HEAD');

/** Commit a tag points at (for the "tag == HEAD" fast path). */
export function tagCommit(tag) {
  return sh(`git rev-list -n 1 ${tag}`);
}

/**
 * Candidate version for the vN+1 publish. Returns HEAD's version when it differs
 * from the baseline; otherwise a synthetic `<version>-contract.<sha>` prerelease so
 * the candidate is always a DISTINCT published artifact from the baseline even when
 * nobody bumped the version (spec §4.1). Note the synthetic tag is a prerelease, so
 * it sorts *below* the base version in semver — the guard does not rely on ordering;
 * the orchestrator pins the adopter to this exact version (with an `add` fallback if
 * `pnpm update` refuses the prerelease range).
 */
export function candidateVersion(headVersion, baselineVersion) {
  if (headVersion !== baselineVersion) return headVersion;
  return `${headVersion}-contract.${shortSha()}`;
}

/**
 * Check out `ref` into a detached worktree, install + run `fn(dir)`, always remove
 * the worktree. Used to build the baseline engine from its release tag.
 */
export function withWorktree(ref, fn) {
  const dir = `/tmp/press-baseline-${process.pid}`;
  rmSync(dir, { recursive: true, force: true });
  // Drop registrations whose dir was removed by a crashed prior run (CI SIGKILL):
  // rmSync clears the disk but not git's worktree registry, so a re-add to the
  // same path would otherwise fail "already registered". prune only removes
  // entries whose working dir is gone — it never touches a live worktree.
  sh('git worktree prune');
  shInherit(`git worktree add --detach "${dir}" "${ref}"`);
  try {
    shInherit(`pnpm install`, { cwd: dir });
    return fn(dir);
  } finally {
    try { shInherit(`git worktree remove --force "${dir}"`); }
    catch (e) { console.warn(`[guard] worktree cleanup failed for ${dir}: ${e.message}`); }
    rmSync(dir, { recursive: true, force: true });
  }
}
