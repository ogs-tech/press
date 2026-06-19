import type { ChildProcess } from 'node:child_process';

export interface WaitForReadyOptions {
  url: string;
  /** The process whose early exit aborts the wait (crash detection). */
  child: ChildProcess;
  /** HTTP status that counts as ready (Strapi health is 204; web is 200). */
  okStatus?: number;
  tries?: number;
  intervalMs?: number;
}

export type ReadyResult =
  | { status: 'ready' }
  | { status: 'exited'; code: number | null; signal: NodeJS.Signals | null }
  | { status: 'timeout' };

/**
 * Polls `url` until it returns the ready status — but resolves immediately as
 * `exited` if `child` dies first. This is the orchestration fix (spec §11): a
 * crashed cms/web is surfaced the moment the process exits, instead of after the
 * full poll budget (~tries × intervalMs) elapses against a dead port. The caller
 * decides what a non-`ready` result means (abort boot, tear down, etc.).
 */
export async function waitForReadyOrExit(opts: WaitForReadyOptions): Promise<ReadyResult> {
  const { url, child } = opts;
  const okStatus = opts.okStatus ?? 200;
  const tries = opts.tries ?? 60;
  const intervalMs = opts.intervalMs ?? 2000;

  // The child may have already exited between spawn and this call.
  if (child.exitCode !== null) {
    return { status: 'exited', code: child.exitCode, signal: child.signalCode ?? null };
  }

  let exitResult: ReadyResult | undefined;
  const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
    exitResult = { status: 'exited', code, signal };
  };
  child.once('exit', onExit);

  try {
    for (let i = 0; i < tries; i++) {
      if (exitResult) return exitResult;
      try {
        const res = await fetch(url);
        if (res.status === okStatus || (okStatus === 200 && res.ok)) return { status: 'ready' };
      } catch {
        /* not up yet */
      }
      if (exitResult) return exitResult;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return exitResult ?? { status: 'timeout' };
  } finally {
    child.off('exit', onExit);
  }
}
