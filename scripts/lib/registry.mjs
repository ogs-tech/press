// scripts/lib/registry.mjs — ephemeral Verdaccio + engine publish (spec §3, §4.1).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sh, shInherit } from './sh.mjs';

export const REGISTRY_URL = 'http://localhost:4873';

export function startRegistry(root) {
  shInherit(`"${join(root, 'scripts/registry.sh')}" start`, { shell: '/bin/bash' });
}
export function stopRegistry(root) {
  try { shInherit(`"${join(root, 'scripts/registry.sh')}" stop`, { shell: '/bin/bash' }); } catch {}
}

export function readPackageVersion(pkgDir) {
  return JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).version;
}

export function setPackageVersion(pkgDir, version) {
  const file = join(pkgDir, 'package.json');
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  pkg.version = version;
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
}

/** Versions of a scoped package already on Verdaccio (empty array if unknown). */
export function publishedVersions(pkgName) {
  const url = `${REGISTRY_URL}/${pkgName.replace(/\//g, '%2f')}`;
  try {
    const body = sh(`curl -s "${url}"`);
    const json = JSON.parse(body);
    return Object.keys(json.versions ?? {});
  } catch { return []; }
}

/**
 * Build a workspace package and publish it at `version` to Verdaccio.
 * `filter` is the pnpm --filter name (e.g. "@press/cms"); `pkgDir` is its dir.
 * Idempotent against re-publish: a duplicate version is tolerated (warn, continue).
 */
export function buildAndPublish({ root, filter, pkgDir, version }) {
  setPackageVersion(pkgDir, version);
  shInherit(`pnpm --filter "${filter}" build`, { cwd: root });
  try {
    shInherit(`npm publish --registry ${REGISTRY_URL} --userconfig "${join(root, '.npmrc')}"`, { cwd: pkgDir });
  } catch (e) {
    const existing = publishedVersions(filter);
    if (existing.includes(version)) console.warn(`[guard] ${filter}@${version} already published — reusing`);
    else throw e;
  }
}
