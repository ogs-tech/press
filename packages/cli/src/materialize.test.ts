import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { materialize } from './materialize';

const made: string[] = [];
function scratch(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'press-mat-'));
  made.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
}, 20_000);

describe('materialize', () => {
  it('copies the @press/web host template into .press/web/', () => {
    const project = scratch();
    // Resolve @press/web from THIS repo (workspace) for the test.
    materialize(project, { resolveFrom: __dirname });

    const web = path.join(project, '.press', 'web');
    expect(existsSync(path.join(web, 'app', 'layout.tsx'))).toBe(true);
    expect(existsSync(path.join(web, 'app', '[[...slug]]', 'page.tsx'))).toBe(true);
    expect(existsSync(path.join(web, 'next.config.ts'))).toBe(true);
    expect(existsSync(path.join(web, 'tsconfig.json'))).toBe(true);
    expect(existsSync(path.join(web, 'press-config.ts'))).toBe(true);
    expect(existsSync(path.join(web, 'press.blocks.ts'))).toBe(true);

    // The resolution site points at the web zone (two levels up → root → web/).
    const cfg = readFileSync(path.join(web, 'press-config.ts'), 'utf8');
    expect(cfg).toContain("from '../../web/config'");
  });

  it('regenerates a clean tree — stale files are removed', () => {
    const project = scratch();
    const web = path.join(project, '.press', 'web');
    mkdirSync(web, { recursive: true });
    writeFileSync(path.join(web, 'STALE.txt'), 'left over');

    materialize(project, { resolveFrom: __dirname });

    expect(existsSync(path.join(web, 'STALE.txt'))).toBe(false);
    expect(existsSync(path.join(web, 'app', 'layout.tsx'))).toBe(true);
  });
});
