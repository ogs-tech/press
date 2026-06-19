import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { materialize } from '../materialize';
import { run } from '../util/run';

export interface UpgradeOptions {
  /** Project root (the adopter's cwd). */
  cwd: string;
  /**
   * Explicit target version to pin the whole engine to across all manifests.
   * Omit it to resolve EACH engine package to its own latest published version
   * (web and cms may sit at different patch levels, so one version must not be
   * forced onto both — that yields an uninstallable manifest).
   */
  target?: string;
}

/** The exact engine pins a generated project carries, and the manifest each lives in. */
const ENGINE_PINS = [
  { manifest: 'package.json', dep: '@ogs-tech/press-web' },
  { manifest: path.join('packages', 'cms', 'package.json'), dep: '@ogs-tech/press-cms' },
] as const;

/** Resolves the latest published version of one package from the registry. */
export function resolveLatest(dep: string): string {
  const out = execFileSync('npm', ['view', dep, 'version'], { encoding: 'utf8' });
  return out.trim();
}

/**
 * Rewrites one manifest's exact pin for `dep` to `version`, in place, preserving
 * 2-space JSON + trailing newline. Returns the previous version, or null if the
 * dep is absent. Pure file I/O — no install, no network.
 */
export function rewritePin(manifestPath: string, dep: string, version: string): string | null {
  let pkg: { dependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(readFileSync(manifestPath, 'utf8')) as { dependencies?: Record<string, string> };
  } catch (err) {
    throw new Error(`press upgrade: cannot read/parse ${manifestPath}: ${(err as Error).message}`);
  }
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
 * Default resolves each engine package to its own latest; an explicit target pins
 * all to that version.
 */
export async function upgradeCommand(opts: UpgradeOptions): Promise<void> {
  const root = opts.cwd;
  // Explicit target pins the whole trio to that one version; default resolves
  // EACH engine package to its own latest (the trio can sit at different patch
  // levels, so a single web-derived version must not be forced onto cms).
  const explicit = opts.target;
  console.log(explicit ? `> press upgrade → ${explicit}` : '> press upgrade → latest per engine package');

  const changes: Array<{ dep: string; from: string; to: string }> = [];
  for (const { manifest, dep } of ENGINE_PINS) {
    const to = explicit ?? resolveLatest(dep);
    const from = rewritePin(path.join(root, manifest), dep, to);
    if (from === null) {
      console.warn(`  (skip ${dep}: not pinned in ${manifest})`);
      continue;
    }
    changes.push({ dep, from, to });
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
