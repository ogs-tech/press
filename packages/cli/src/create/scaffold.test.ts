import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scaffold } from './scaffold';
import { VERSIONS } from './versions.generated';

const made: string[] = [];
function scratchParent(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'press-create-'));
  made.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('scaffold', () => {
  it('writes the three-zone adopter manifest (packages/web|cms|shared) and NO Next host', () => {
    const target = path.join(scratchParent(), 'my-site');
    scaffold({ target, name: 'my-site' });

    const has = (rel: string) => existsSync(path.join(target, rel));

    // web zone (config + blocks)
    expect(has('packages/web/config.ts')).toBe(true);
    expect(has('packages/web/blocks/custom/Callout.tsx')).toBe(true);
    expect(has('packages/web/blocks/custom/index.ts')).toBe(true);
    // shared zone (content-type contract)
    expect(has('packages/shared/package.json')).toBe(true);
    expect(has('packages/shared/types/index.ts')).toBe(true);
    // committed baseline so the project typechecks before the first `press dev`
    expect(has('packages/shared/types/generated.ts')).toBe(true);
    // cms zone (schema stays auto-discovered by Strapi)
    expect(has('packages/cms/config/plugins.ts')).toBe(true);
    expect(has('packages/cms/src/components/custom/callout.json')).toBe(true);
    expect(has('packages/cms/src/index.ts')).toBe(true);
    expect(has('packages/cms/package.json')).toBe(true);
    expect(has('packages/cms/.env')).toBe(true);
    expect(has('packages/cms/scripts/seed.mjs')).toBe(true);
    // infra
    expect(has('package.json')).toBe(true);
    expect(has('.gitignore')).toBe(true);
    expect(has('.nvmrc')).toBe(true);
    expect(has('pnpm-workspace.yaml')).toBe(true);
    expect(has('.npmrc')).toBe(true);

    expect(has('templates')).toBe(false);
    expect(has('gitignore')).toBe(false);

    // The Next host is materialized on dev/build, never at create time.
    expect(has('app')).toBe(false);
    expect(has('next.config.ts')).toBe(false);
    expect(has('packages/web/next.config.ts')).toBe(false);
    expect(has('app/layout.tsx')).toBe(false);
    expect(has('.press')).toBe(false);

    // The adopter block is wired to the project-scoped shared package, not the engine.
    const callout = readFileSync(path.join(target, 'packages/web/blocks/custom/Callout.tsx'), 'utf8');
    expect(callout).toContain("from 'my-site-shared/types'");
    expect(callout).not.toContain('__SHARED_PKG__');
    expect(readFileSync(path.join(target, 'packages/shared/package.json'), 'utf8')).toContain('"name": "my-site-shared"');
    // workspace members are globbed (packages/*); web (no package.json) is ignored by pnpm.
    expect(readFileSync(path.join(target, 'pnpm-workspace.yaml'), 'utf8')).toContain('packages/*');

    const rootPkg = JSON.parse(readFileSync(path.join(target, 'package.json'), 'utf8'));
    expect(rootPkg.name).toBe('my-site');
    expect(rootPkg.scripts.dev).toBe('press dev');
    expect(rootPkg.scripts.build).toBe('press build');
    expect(rootPkg.scripts.upgrade).toBe('press upgrade');
    // The STANDALONE root keeps pnpm.onlyBuiltDependencies (it IS the workspace root
    // here, so the field takes effect); play:create strips this copy for the dogfood.
    expect(rootPkg.pnpm.onlyBuiltDependencies).toContain('better-sqlite3');
    // The generated .npmrc pins the Strapi-shaped pnpm settings and does NOT route
    // @ogs-tech to any registry — they resolve from the default (npm).
    const npmrcContents = readFileSync(path.join(target, '.npmrc'), 'utf8');
    expect(npmrcContents).toContain('node-linker=hoisted');
    expect(npmrcContents).not.toContain('@ogs-tech:registry');
  });

  it('pins @ogs-tech/press-* from the generated VERSIONS (no drift from the engine manifests)', () => {
    const target = path.join(scratchParent(), 'my-site');
    scaffold({ target, name: 'my-site' });

    const root = JSON.parse(readFileSync(path.join(target, 'package.json'), 'utf8'));
    expect(root.dependencies['@ogs-tech/press-cli']).toBeUndefined();
    expect(root.dependencies['@ogs-tech/create-press']).toBeUndefined();
    expect(root.dependencies['@ogs-tech/press-web']).toBe(VERSIONS.pressWeb);
    // @ogs-tech/press-* are pinned EXACT (no caret), so a generated project always resolves
    // the engine that produced it.
    expect(root.dependencies['@ogs-tech/press-web']).not.toMatch(/[\^~]/);

    const cms = JSON.parse(readFileSync(path.join(target, 'packages/cms/package.json'), 'utf8'));
    expect(cms.dependencies['@ogs-tech/press-cms']).toBe(VERSIONS.pressCms);
    expect(cms.dependencies['@strapi/strapi']).toBe(VERSIONS.strapi);
  });

  it('ships a committed baseline generated.ts so the project typechecks before the first `press dev`', () => {
    const target = path.join(scratchParent(), 'my-site');
    scaffold({ target, name: 'my-site' });

    // The adopter's Callout block imports CustomCallout from shared/types — that
    // chain resolves through generated.ts, which `press dev` only writes on the
    // first sync. Without a committed baseline, a fresh `tsc`/`press build` breaks.
    const generated = readFileSync(path.join(target, 'packages/shared/types/generated.ts'), 'utf8');
    expect(generated).toContain('export interface CustomCallout');
    expect(generated).toMatch(/'info' \| 'warning' \| 'success'/);

    // It is COMMITTED (not gitignored), so CI and teammate clones typecheck with
    // no live CMS. Guard the generated .gitignore against re-ignoring it.
    const gitignore = readFileSync(path.join(target, '.gitignore'), 'utf8');
    expect(gitignore).not.toContain('packages/shared/types/generated.ts');
  });

  it('ships no deploy kit', () => {
    const target = path.join(scratchParent(), 'my-site');
    scaffold({ target, name: 'my-site' });
    for (const f of ['deploy', '.dockerignore', 'packages/cms/.env.production.example']) {
      expect(existsSync(path.join(target, f)), `unexpected ${f}`).toBe(false);
    }
  });

  it('generates unique Strapi secrets per project', () => {
    const a = path.join(scratchParent(), 'a');
    const b = path.join(scratchParent(), 'b');
    scaffold({ target: a, name: 'a' });
    scaffold({ target: b, name: 'b' });
    const envA = readFileSync(path.join(a, 'packages/cms/.env'), 'utf8');
    const envB = readFileSync(path.join(b, 'packages/cms/.env'), 'utf8');
    const keyA = /APP_KEYS=(.+)/.exec(envA)?.[1];
    const keyB = /APP_KEYS=(.+)/.exec(envB)?.[1];
    expect(keyA).toBeTruthy();
    expect(keyA).not.toEqual(keyB);
  });
});
