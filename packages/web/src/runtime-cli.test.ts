import { describe, expect, it } from 'vitest';
import { buildProgram } from './runtime-cli';

describe('runtime buildProgram', () => {
  it('exposes dev, build, and upgrade in --help', () => {
    const program = buildProgram();
    program.exitOverride();
    let out = '';
    program.configureOutput({ writeOut: (s) => (out += s), writeErr: (s) => (out += s) });
    expect(() => program.parse(['node', 'press', '--help'])).toThrow();
    for (const cmd of ['dev', 'build', 'upgrade']) {
      expect(out).toContain(cmd);
    }
  });
});
