import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scaffold } from './scaffold';

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
  it('writes the three-zone adopter manifest (web/cms/core) and NO Next host', () => {
    const target = path.join(scratchParent(), 'my-site');
    scaffold({ target, name: 'my-site', registry: 'http://localhost:4873' });

    const has = (rel: string) => existsSync(path.join(target, rel));

    // web zone (config + blocks)
    expect(has('web/config.ts')).toBe(true);
    expect(has('web/blocks/custom/Callout.tsx')).toBe(true);
    expect(has('web/blocks/custom/index.ts')).toBe(true);
    // core zone (content-type contract)
    expect(has('core/package.json')).toBe(true);
    expect(has('core/types/index.ts')).toBe(true);
    // cms zone (schema stays auto-discovered by Strapi)
    expect(has('cms/config/plugins.ts')).toBe(true);
    expect(has('cms/src/components/custom/callout.json')).toBe(true);
    expect(has('cms/src/index.ts')).toBe(true);
    expect(has('cms/package.json')).toBe(true);
    expect(has('cms/.env')).toBe(true);
    // infra
    expect(has('content/seed.mjs')).toBe(true);
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
    expect(has('web/next.config.ts')).toBe(false);
    expect(has('app/layout.tsx')).toBe(false);
    expect(has('.press')).toBe(false);

    // The adopter block is wired to the project-scoped core package, not the engine.
    const callout = readFileSync(path.join(target, 'web/blocks/custom/Callout.tsx'), 'utf8');
    expect(callout).toContain("from 'my-site-core/types'");
    expect(callout).not.toContain('__CORE_PKG__');
    expect(readFileSync(path.join(target, 'core/package.json'), 'utf8')).toContain('"name": "my-site-core"');
    expect(readFileSync(path.join(target, 'pnpm-workspace.yaml'), 'utf8')).toContain('"core"');

    expect(readFileSync(path.join(target, 'package.json'), 'utf8')).toContain('"name": "my-site"');
    expect(readFileSync(path.join(target, '.npmrc'), 'utf8')).toContain('@press:registry=http://localhost:4873');
  });

  it('writes the self-hosted deploy kit', () => {
    const target = path.join(scratchParent(), 'my-site');
    scaffold({ target, name: 'my-site', registry: 'http://localhost:4873' });
    for (const f of [
      'deploy/docker-compose.yml',
      'deploy/Dockerfile.cms',
      'deploy/Dockerfile.web',
      'deploy/Caddyfile',
      'deploy/.env.deploy.example',
      'cms/.env.production.example',
      '.dockerignore',
    ]) {
      expect(existsSync(path.join(target, f)), `missing ${f}`).toBe(true);
    }
    // The inert package-side name must not ship into the project.
    expect(existsSync(path.join(target, 'deploy', '.dockerignore.template'))).toBe(false);
  });

  it('gitignores the filled-in deploy secrets but keeps the examples', () => {
    const target = path.join(scratchParent(), 'my-site');
    scaffold({ target, name: 'my-site', registry: 'http://localhost:4873' });
    const gi = readFileSync(path.join(target, '.gitignore'), 'utf8');
    expect(gi).toMatch(/deploy\/\.env\.deploy$/m);
    expect(gi).toMatch(/cms\/\.env\.production$/m);
  });

  it('generates unique Strapi secrets per project', () => {
    const a = path.join(scratchParent(), 'a');
    const b = path.join(scratchParent(), 'b');
    scaffold({ target: a, name: 'a', registry: 'http://localhost:4873' });
    scaffold({ target: b, name: 'b', registry: 'http://localhost:4873' });
    const envA = readFileSync(path.join(a, 'cms/.env'), 'utf8');
    const envB = readFileSync(path.join(b, 'cms/.env'), 'utf8');
    const keyA = /APP_KEYS=(.+)/.exec(envA)?.[1];
    const keyB = /APP_KEYS=(.+)/.exec(envB)?.[1];
    expect(keyA).toBeTruthy();
    expect(keyA).not.toEqual(keyB);
  });
});
