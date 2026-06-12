// scripts/lib/leak-snapshot.mjs
// Pure helpers for the contract guard's FILE-LEAK class (spec §5).
// hashZone() fingerprints the adopter Project zone on disk; diffZones() isolates
// what an update changed; findFileLeaks() enforces the generalized allowed delta
// (both adopter manifests + the lockfile, spec §4.4); manifestVersionOnlyViolation()
// proves the only meaningful manifest change is the @press/* version range.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

// Build/output/VCS dirs that are not Project-zone source — never part of the leak
// surface. Mirrors .gitignore's generated paths plus per-app build output.
// Note: tsconfig.tsbuildinfo is a file name, matched by name before the dir/file split.
export const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', '.turbo', '.next', '.strapi', '.cache',
  'dist', 'build', '.tmp', 'tsconfig.tsbuildinfo',
]);

const EXCLUDED_FILE = (name) =>
  name === '.env' || name.startsWith('.env.') || name.endsWith('.db') || name.endsWith('.sqlite') || name.endsWith('.log');

/**
 * Fingerprint every source file under `roots` (paths relative to `repoRoot`).
 * @returns Map<relPath, sha256>
 */
export function hashZone(roots, repoRoot = process.cwd()) {
  const out = new Map();
  const walk = (abs) => {
    for (const entry of readdirSync(abs)) {
      if (EXCLUDED_DIRS.has(entry) || EXCLUDED_FILE(entry)) continue;
      const child = join(abs, entry);
      const st = statSync(child);
      if (st.isDirectory()) walk(child);
      else out.set(relative(repoRoot, child), createHash('sha256').update(readFileSync(child)).digest('hex'));
    }
  };
  for (const r of roots) {
    const abs = join(repoRoot, r);
    // A guard root must exist. statSync throws on a typo'd/missing root and we
    // let it propagate rather than swallow it: a silently-skipped root would make
    // the guard pass forever for a zone it never actually checked (spec §5).
    let st;
    try {
      st = statSync(abs);
    } catch {
      throw new Error(`hashZone: root not found: ${r} (${abs})`);
    }
    if (st.isDirectory()) walk(abs);
    else out.set(r, createHash('sha256').update(readFileSync(abs)).digest('hex'));
  }
  return out;
}

/** Diff two hashZone() maps into changed / added / removed (+ a combined, unordered `all`). */
export function diffZones(before, after) {
  const changed = [], added = [], removed = [];
  for (const [p, h] of after) {
    if (!before.has(p)) added.push(p);
    else if (before.get(p) !== h) changed.push(p);
  }
  for (const p of before.keys()) if (!after.has(p)) removed.push(p);
  return { changed, added, removed, all: [...changed, ...added, ...removed] };
}

/** Every changed path must be in `allowed`; return those that are not (the leaks). */
export function findFileLeaks(diff, allowed) {
  return diff.all.filter((p) => !allowed.has(p));
}

/**
 * Given before/after text of a manifest, assert the ONLY changed dependency line
 * mentions an @press/* package. Returns a violation message, or null if clean.
 *
 * Scope: this is a line-set diff tuned to the guard's actual update path
 * (`pnpm update @press/*`, which only rewrites the matched version range). It does
 * not attempt to detect structural moves between dependency sections — that class
 * of change cannot arise from the guarded update, and the content-hash file-leak
 * check (findFileLeaks) is the catch-all backstop for any other manifest mutation.
 */
export function manifestVersionOnlyViolation(beforeText, afterText) {
  const lineSet = (t) => new Set(t.split('\n').map((l) => l.trim()).filter(Boolean));
  const b = lineSet(beforeText), a = lineSet(afterText);
  const changedLines = [...a].filter((l) => !b.has(l)).concat([...b].filter((l) => !a.has(l)));
  const offending = changedLines.filter((l) => !/@press\//.test(l));
  return offending.length ? `non-@press change in manifest:\n  ${offending.join('\n  ')}` : null;
}
