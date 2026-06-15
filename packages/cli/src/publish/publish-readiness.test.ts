import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PUBLISHABLE_PACKAGES, checkPublishReadiness, type Manifest } from './publish-readiness';

// This test reaches across the workspace on purpose: publish-readiness is a
// repo-wide invariant and the CLI is the package that ships the create/publish
// flow, so it owns the guard. packagesDir resolves to <repo>/packages.
const packagesDir = path.join(__dirname, '..', '..', '..');
const DIR_BY_NAME: Record<string, string> = {
  '@press/cli': 'cli',
  '@press/web': 'web',
  '@press/cms': 'cms',
  '@press/shared': 'shared',
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

  it('keeps @press/shared private (internal dev-only contract, never published)', () => {
    // web/cms consume it via `import type` only — erased at transpile time, so the
    // adopter never resolves it. Publishing it would leak an internal package.
    expect(manifestOf('@press/shared').private).toBe(true);
  });

  it('flags a manifest missing publishConfig and version', () => {
    const violations = checkPublishReadiness({ name: '@press/x' });
    expect(violations).toContain('missing publishConfig.access="public" (scoped packages default to restricted)');
    expect(violations).toContain('missing a version');
  });

  it('flags a surviving workspace: protocol in a published dependency field', () => {
    const violations = checkPublishReadiness({
      publishConfig: { access: 'public' },
      version: '1.0.0',
      dependencies: { '@press/shared': 'workspace:*' },
    });
    expect(violations).toContain('dependencies.@press/shared still uses the workspace: protocol');
  });
});
