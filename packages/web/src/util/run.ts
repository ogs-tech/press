import { spawn } from 'node:child_process';

export interface RunOptions {
  cwd?: string;
  // Record<string, string | undefined> instead of NodeJS.ProcessEnv (the type the
  // CLI's copy of run.ts uses): Next.js augments ProcessEnv to require NODE_ENV
  // (next/types/global.d.ts, in scope for this ESM package but not the CJS CLI),
  // and callers pass partial override maps. This is why the two run.ts copies diverge.
  env?: Record<string, string | undefined>;
}

/**
 * A subprocess that exited non-zero, carrying the REAL exit code (and signal, if
 * killed). bin/press.ts re-exits with this code so `press build` surfaces the
 * failing tool's own code instead of a generic 1 — the same "truthful failure"
 * guarantee dev.ts already gives via waitForReadyOrExit.
 */
export class SubprocessError extends Error {
  constructor(
    readonly command: string,
    readonly code: number | null,
    readonly signal: NodeJS.Signals | null = null,
  ) {
    super(`${command} exited ${code ?? `(signal ${signal})`}`);
    this.name = 'SubprocessError';
  }
}

/** Runs a command, inheriting stdio, and resolves on exit 0 (rejects otherwise). */
export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) =>
      code === 0
        ? resolve()
        : reject(new SubprocessError(`${cmd} ${args.join(' ')}`, code, signal)),
    );
  });
}
