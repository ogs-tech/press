// scripts/lib/leak-snapshot.test.mjs
import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { diffZones, findFileLeaks, manifestVersionOnlyViolation, hashZone } from './leak-snapshot.mjs';

describe('diffZones', () => {
  it('reports changed, added, and removed paths', () => {
    const before = new Map([['a', 'h1'], ['b', 'h2'], ['gone', 'h3']]);
    const after = new Map([['a', 'h1'], ['b', 'CHANGED'], ['new', 'h4']]);
    const d = diffZones(before, after);
    expect(d.changed).toEqual(['b']);
    expect(d.added).toEqual(['new']);
    expect(d.removed).toEqual(['gone']);
    expect(d.all.sort()).toEqual(['b', 'gone', 'new']);
  });
});

describe('findFileLeaks', () => {
  const allowed = new Set(['apps/cms/package.json', 'apps/web/package.json', 'pnpm-lock.yaml']);
  it('passes when every changed path is allowed', () => {
    const d = { all: ['apps/cms/package.json', 'pnpm-lock.yaml'] };
    expect(findFileLeaks(d, allowed)).toEqual([]);
  });
  it('flags any path outside the allowed set', () => {
    const d = { all: ['apps/web/press-config.ts', 'pnpm-lock.yaml'] };
    expect(findFileLeaks(d, allowed)).toEqual(['apps/web/press-config.ts']);
  });
});

describe('manifestVersionOnlyViolation', () => {
  it('returns null when only the @press/* version line changed', () => {
    const before = '{\n  "dependencies": {\n    "@press/cms": "0.3.2",\n    "next": "^15.1.0"\n  }\n}\n';
    const after  = '{\n  "dependencies": {\n    "@press/cms": "0.4.0",\n    "next": "^15.1.0"\n  }\n}\n';
    expect(manifestVersionOnlyViolation(before, after)).toBeNull();
  });
  it('flags a non-@press change to the manifest', () => {
    const before = '{\n  "dependencies": {\n    "@press/cms": "0.3.2",\n    "next": "^15.1.0"\n  }\n}\n';
    const after  = '{\n  "dependencies": {\n    "@press/cms": "0.3.2",\n    "next": "^15.9.9"\n  }\n}\n';
    expect(manifestVersionOnlyViolation(before, after)).toMatch(/next/);
  });
});

describe('hashZone', () => {
  let tmpRoot;

  afterEach(() => {
    if (tmpRoot) {
      rmSync(tmpRoot, { recursive: true, force: true });
      tmpRoot = undefined;
    }
  });

  it('includes source files, excludes node_modules and excluded file patterns', () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'leak-snapshot-test-'));

    // Create the source file
    mkdirSync(join(tmpRoot, 'apps', 'web'), { recursive: true });
    writeFileSync(join(tmpRoot, 'apps', 'web', 'press.config.ts'), 'export default {}');

    // Create a file inside an excluded dir
    mkdirSync(join(tmpRoot, 'apps', 'web', 'node_modules'), { recursive: true });
    writeFileSync(join(tmpRoot, 'apps', 'web', 'node_modules', 'foo.js'), 'module.exports = 1');

    // Create an excluded file (by pattern)
    writeFileSync(join(tmpRoot, 'apps', 'web', 'dev.db'), 'sqlite');

    const result = hashZone(['apps/web'], tmpRoot);

    expect(result.has('apps/web/press.config.ts')).toBe(true);
    expect(result.has('apps/web/node_modules/foo.js')).toBe(false);
    expect(result.has('apps/web/dev.db')).toBe(false);
  });

  it('handles a single-file root', () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'leak-snapshot-test-'));
    writeFileSync(join(tmpRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');

    const result = hashZone(['pnpm-lock.yaml'], tmpRoot);

    expect(result.has('pnpm-lock.yaml')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('throws on a missing root', () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'leak-snapshot-test-'));

    expect(() => hashZone(['does-not-exist'], tmpRoot)).toThrow(/root not found/);
  });
});
