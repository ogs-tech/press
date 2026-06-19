import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { rewritePin, upgradeCommand } from './upgrade';

describe('rewritePin', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

  function tmpManifest(deps: Record<string, string>): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'press-upgrade-'));
    dirs.push(dir);
    const file = path.join(dir, 'package.json');
    writeFileSync(file, JSON.stringify({ name: 'x', dependencies: deps }, null, 2) + '\n');
    return file;
  }

  it('rewrites the dep to the target and returns the previous version', () => {
    const file = tmpManifest({ '@ogs-tech/press-web': '0.3.1', next: '^15.1.0' });
    const prev = rewritePin(file, '@ogs-tech/press-web', '0.4.0');
    expect(prev).toBe('0.3.1');
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    expect(pkg.dependencies['@ogs-tech/press-web']).toBe('0.4.0');
    expect(pkg.dependencies.next).toBe('^15.1.0'); // sibling pins untouched
  });

  it('preserves 2-space JSON + trailing newline (clean diff)', () => {
    const file = tmpManifest({ '@ogs-tech/press-web': '0.3.1' });
    rewritePin(file, '@ogs-tech/press-web', '0.4.0');
    const raw = readFileSync(file, 'utf8');
    expect(raw.endsWith('}\n')).toBe(true);
    expect(raw).toContain('\n  "dependencies": {');
  });

  it('returns null and writes nothing when the dep is absent', () => {
    const file = tmpManifest({ next: '^15.1.0' });
    const before = readFileSync(file, 'utf8');
    const prev = rewritePin(file, '@ogs-tech/press-web', '0.4.0');
    expect(prev).toBeNull();
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('throws with the manifest path when the file is not valid JSON', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'press-upgrade-'));
    dirs.push(dir);
    const file = path.join(dir, 'package.json');
    writeFileSync(file, '{ not valid json');
    expect(() => rewritePin(file, '@ogs-tech/press-web', '0.4.0')).toThrow(/cannot read\/parse.*package\.json/);
  });
});

describe('upgradeCommand', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

  it('throws when neither manifest carries an @ogs-tech/press-* pin', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'press-upgrade-'));
    dirs.push(root);

    // Root manifest: no press pins
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'x', dependencies: { next: '^15.1.0' } }, null, 2) + '\n',
    );

    // packages/cms/package.json must exist so rewritePin doesn't throw ENOENT
    mkdirSync(path.join(root, 'packages', 'cms'), { recursive: true });
    writeFileSync(
      path.join(root, 'packages', 'cms', 'package.json'),
      JSON.stringify({ name: 'x-cms', dependencies: {} }, null, 2) + '\n',
    );

    await expect(upgradeCommand({ cwd: root, target: '0.4.0' })).rejects.toThrow(
      /no @ogs-tech\/press-\* pins found/,
    );
  });
});
