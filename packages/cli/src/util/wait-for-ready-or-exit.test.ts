import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { waitForReadyOrExit } from './wait-for-ready-or-exit';

/** Minimal ChildProcess double: EventEmitter + the exitCode/signalCode reads. */
class FakeChild extends EventEmitter {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  exit(code: number | null, signal: NodeJS.Signals | null = null) {
    this.exitCode = code;
    this.signalCode = signal;
    this.emit('exit', code, signal);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('waitForReadyOrExit', () => {
  it('resolves ready when the url returns the ok status', async () => {
    const child = new FakeChild();
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 204 }) as Response));
    const res = await waitForReadyOrExit({
      url: 'http://x/_health', child: child as any, okStatus: 204, tries: 3, intervalMs: 1,
    });
    expect(res).toEqual({ status: 'ready' });
  });

  it('treats a 200 + res.ok as ready under the default okStatus', async () => {
    const child = new FakeChild();
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, ok: true }) as Response));
    const res = await waitForReadyOrExit({ url: 'http://x', child: child as any, tries: 3, intervalMs: 1 });
    expect(res).toEqual({ status: 'ready' });
  });

  it('resolves exited (with the real code/signal) when the child dies before becoming ready', async () => {
    const child = new FakeChild();
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      if (calls === 1) child.exit(137, 'SIGKILL'); // crash mid-wait
      throw new Error('ECONNREFUSED');
    }));
    const res = await waitForReadyOrExit({
      url: 'http://x/_health', child: child as any, okStatus: 204, tries: 5, intervalMs: 1,
    });
    expect(res).toEqual({ status: 'exited', code: 137, signal: 'SIGKILL' });
  });

  it('resolves exited immediately (no fetch) if the child already exited', async () => {
    const child = new FakeChild();
    child.exitCode = 2;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await waitForReadyOrExit({ url: 'http://x', child: child as any });
    expect(res).toEqual({ status: 'exited', code: 2, signal: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolves timeout when the url never becomes ready and the child stays up', async () => {
    const child = new FakeChild();
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 503, ok: false }) as Response));
    const res = await waitForReadyOrExit({ url: 'http://x', child: child as any, tries: 3, intervalMs: 1 });
    expect(res).toEqual({ status: 'timeout' });
  });
});
