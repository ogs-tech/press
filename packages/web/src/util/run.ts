import { spawn } from 'node:child_process';

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
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
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`)),
    );
  });
}
