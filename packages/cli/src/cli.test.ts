import { describe, expect, it } from 'vitest';
import { buildProgram } from './cli';

describe('buildProgram', () => {
  it('exposes the three subcommands in --help', () => {
    const program = buildProgram();
    program.exitOverride();
    let out = '';
    program.configureOutput({ writeOut: (s) => (out += s), writeErr: (s) => (out += s) });
    expect(() => program.parse(['node', 'press', '--help'])).toThrow();
    for (const cmd of ['create', 'dev', 'build']) {
      expect(out).toContain(cmd);
    }
  });

  it('reports the package version', () => {
    const program = buildProgram();
    program.exitOverride();
    let out = '';
    program.configureOutput({ writeOut: (s) => (out += s) });
    expect(() => program.parse(['node', 'press', '--version'])).toThrow();
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
