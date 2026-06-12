import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateDeployPrereqs } from './deploy';

const made: string[] = [];
function scratch(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'press-deploy-'));
  made.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('validateDeployPrereqs', () => {
  it('fails when no build is present', () => {
    const root = scratch();
    const r = validateDeployPrereqs(root);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/build/i);
  });

  it('passes when a web build and cms/.env are present', () => {
    const root = scratch();
    mkdirSync(path.join(root, '.press', 'web', '.next'), { recursive: true });
    mkdirSync(path.join(root, 'cms'), { recursive: true });
    writeFileSync(path.join(root, 'cms', '.env'), 'PORT=1337\n');
    const r = validateDeployPrereqs(root);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('fails when cms/.env is missing even if a build exists', () => {
    const root = scratch();
    mkdirSync(path.join(root, '.press', 'web', '.next'), { recursive: true });
    const r = validateDeployPrereqs(root);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/\.env/);
  });
});
