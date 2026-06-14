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
  it('writes the three-zone adopter manifest (web/cms/shared) and NO Next host', () => {
    const target = path.join(scratchParent(), 'my-site');
    scaffold({ target, name: 'my-site' });

    const has = (rel: string) => existsSync(path.join(target, rel));

    // web zone (config + blocks)
    expect(has('web/config.ts')).toBe(true);
    expect(has('web/blocks/custom/Callout.tsx')).toBe(true);
    expect(has('web/blocks/custom/index.ts')).toBe(true);
    // shared zone (content-type contract)
    expect(has('shared/package.json')).toBe(true);
    expect(has('shared/types/index.ts')).toBe(true);
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

    // The adopter block is wired to the project-scoped shared package, not the engine.
    const callout = readFileSync(path.join(target, 'web/blocks/custom/Callout.tsx'), 'utf8');
    expect(callout).toContain("from 'my-site-shared/types'");
    expect(callout).not.toContain('__SHARED_PKG__');
    expect(readFileSync(path.join(target, 'shared/package.json'), 'utf8')).toContain('"name": "my-site-shared"');
    expect(readFileSync(path.join(target, 'pnpm-workspace.yaml'), 'utf8')).toContain('"shared"');

    expect(readFileSync(path.join(target, 'package.json'), 'utf8')).toContain('"name": "my-site"');
    // The generated .npmrc pins the Strapi-shaped pnpm settings and does NOT route
    // @press to any registry — they resolve from the default (npm).
    const npmrcContents = readFileSync(path.join(target, '.npmrc'), 'utf8');
    expect(npmrcContents).toContain('node-linker=hoisted');
    expect(npmrcContents).not.toContain('@press:registry');
  });

  it('ships no deploy kit', () => {
    const target = path.join(scratchParent(), 'my-site');
    scaffold({ target, name: 'my-site' });
    for (const f of ['deploy', '.dockerignore', 'cms/.env.production.example']) {
      expect(existsSync(path.join(target, f)), `unexpected ${f}`).toBe(false);
    }
  });

  it('generates unique Strapi secrets per project', () => {
    const a = path.join(scratchParent(), 'a');
    const b = path.join(scratchParent(), 'b');
    scaffold({ target: a, name: 'a' });
    scaffold({ target: b, name: 'b' });
    const envA = readFileSync(path.join(a, 'cms/.env'), 'utf8');
    const envB = readFileSync(path.join(b, 'cms/.env'), 'utf8');
    const keyA = /APP_KEYS=(.+)/.exec(envA)?.[1];
    const keyB = /APP_KEYS=(.+)/.exec(envB)?.[1];
    expect(keyA).toBeTruthy();
    expect(keyA).not.toEqual(keyB);
  });
});
