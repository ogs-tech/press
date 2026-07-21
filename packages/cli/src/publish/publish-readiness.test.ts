import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PUBLISHABLE_PACKAGES, checkPublishReadiness, type Manifest } from './publish-readiness';

// This test reaches across the workspace on purpose: publish-readiness is a
// repo-wide invariant and the CLI is the package that ships the create/publish
// flow, so it owns the guard. packagesDir resolves to <repo>/packages.
const packagesDir = path.join(__dirname, '..', '..', '..');
const DIR_BY_NAME: Record<string, string> = {
  '@ogs-tech/create-press': 'cli',
  '@ogs-tech/press-web': 'web',
  '@ogs-tech/press-cms': 'cms',
  '@ogs-tech/press-shared': 'shared',
};

function dirOf(name: string): string {
  return path.join(packagesDir, DIR_BY_NAME[name]);
}
function manifestOf(name: string): Manifest {
  return JSON.parse(readFileSync(path.join(dirOf(name), 'package.json'), 'utf8'));
}

describe('publish-readiness', () => {
  it.each(PUBLISHABLE_PACKAGES)('%s is ready to publish to the public npm registry', (name) => {
    const violations = checkPublishReadiness(manifestOf(name));
    expect(violations, `${name}: ${violations.join('; ')}`).toEqual([]);
  });

  it.each(PUBLISHABLE_PACKAGES)('%s controls its tarball surface (files allowlist or .npmignore)', (name) => {
    // With neither, npm falls back to .gitignore and can dump node_modules or drop
    // wanted files. cli/cms use a `files` allowlist; web uses `.npmignore` (under a
    // files allowlist npm stops honoring .npmignore, which would re-ship its tests).
    const manifest = manifestOf(name);
    const controlled = (manifest.files?.length ?? 0) > 0 || existsSync(path.join(dirOf(name), '.npmignore'));
    expect(controlled, `${name} has neither a files allowlist nor an .npmignore`).toBe(true);
  });

  it('publishes @ogs-tech/press-shared as a public runtime contract package', () => {
    // press-web now imports its validator at runtime (composition-builder Decision 3),
    // so press-shared is a co-published runtime dependency, not a private, dev-only,
    // never-published package.
    const manifest = manifestOf('@ogs-tech/press-shared');
    expect(manifest.private).not.toBe(true);
    expect(manifest.publishConfig?.access).toBe('public');
  });

  it('flags a manifest missing publishConfig and version', () => {
    const violations = checkPublishReadiness({ name: '@ogs-tech/press-x' });
    expect(violations).toContain('missing publishConfig.access="public" (scoped packages default to restricted)');
    expect(violations).toContain('missing a version');
  });

  it('flags a surviving workspace: protocol in a published dependency field', () => {
    const violations = checkPublishReadiness({
      publishConfig: { access: 'public' },
      version: '1.0.0',
      dependencies: { 'some-external-pkg': 'workspace:*' },
    });
    expect(violations).toContain('dependencies.some-external-pkg still uses the workspace: protocol');
  });

  it('allows a workspace: protocol dependency on a co-published PUBLISHABLE_PACKAGES target', () => {
    // press-web's "@ogs-tech/press-shared": "workspace:*" is exactly this case: both
    // packages are co-published via changesets, which rewrites the spec to press-shared's
    // real published version at publish time — no unresolvable protocol ships.
    const violations = checkPublishReadiness({
      publishConfig: { access: 'public' },
      version: '1.0.0',
      dependencies: { '@ogs-tech/press-shared': 'workspace:*' },
    });
    expect(violations).not.toContain('dependencies.@ogs-tech/press-shared still uses the workspace: protocol');
  });
});
