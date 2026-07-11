import { describe, expect, it } from 'vitest';
import { run, SubprocessError } from './run';

describe('run', () => {
  it('resolves when the command exits 0', async () => {
    await expect(run('node', ['-e', 'process.exit(0)'])).resolves.toBeUndefined();
  });

  it('rejects with a SubprocessError that carries the REAL exit code', async () => {
    // The whole point of press build/dev "truthful failures": a non-zero
    // subprocess must surface ITS code, never a generic 1.
    const err = await run('node', ['-e', 'process.exit(3)']).catch((e) => e);
    expect(err).toBeInstanceOf(SubprocessError);
    expect((err as SubprocessError).code).toBe(3);
  });

  it('rejects (not resolves) when the command cannot be spawned', async () => {
    const err = await run('this-binary-does-not-exist-press', []).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
  });
});
