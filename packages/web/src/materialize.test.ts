import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { materialize } from './materialize';

describe('materialize', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

  it('writes .press/web from this package host template', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'press-mat-'));
    dirs.push(root);
    materialize(root);
    // The host template ships an app/ dir and next.config.ts (see templates/host).
    expect(existsSync(path.join(root, '.press', 'web', 'next.config.ts'))).toBe(true);
    expect(existsSync(path.join(root, '.press', 'web', 'app'))).toBe(true);
  });

  it('is idempotent — a second run replaces the host cleanly', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'press-mat-'));
    dirs.push(root);
    materialize(root);
    materialize(root);
    expect(existsSync(path.join(root, '.press', 'web', 'next.config.ts'))).toBe(true);
  });
});
