import { describe, expect, it } from 'vitest';
import { buildProgram } from './cli';

describe('create-press buildProgram', () => {
  it('takes a <name> argument and exposes no dev/build subcommands', () => {
    const program = buildProgram();
    program.exitOverride();
    let out = '';
    program.configureOutput({ writeOut: (s) => (out += s), writeErr: (s) => (out += s) });
    expect(() => program.parse(['node', 'create-press', '--help'])).toThrow();
    expect(out).toContain('<name>');
    expect(out).not.toContain('dev');
    expect(out).not.toContain('build');
  });

  it('reports the package version', () => {
    const program = buildProgram();
    program.exitOverride();
    let out = '';
    program.configureOutput({ writeOut: (s) => (out += s) });
    expect(() => program.parse(['node', 'create-press', '--version'])).toThrow();
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
