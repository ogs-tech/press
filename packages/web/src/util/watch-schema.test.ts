import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchSchema } from './watch-schema';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const okText = (body: string) => ({ ok: true, text: async () => body }) as Response;

describe('watchSchema', () => {
  it('treats the first read as the baseline and fires onChange only on a changed body', async () => {
    const controller = new AbortController();
    const bodies = ['A', 'A', 'B', 'B', 'C'];
    let i = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      const body = bodies[Math.min(i, bodies.length - 1)];
      i += 1;
      if (i >= bodies.length) controller.abort(); // stop the loop after the sequence
      return okText(body);
    }));

    const onChange = vi.fn();
    await watchSchema({ url: 'http://x', signal: controller.signal, intervalMs: 1, onChange });

    // baseline A · A==A · A→B (fire) · B==B · B→C (fire) = 2
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('reports a failed poll via onError and keeps watching (cms mid-restart)', async () => {
    const controller = new AbortController();
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('ECONNREFUSED'); // cms restarting
      if (calls >= 3) controller.abort();
      return okText('A');
    }));

    const onError = vi.fn();
    const onChange = vi.fn();
    await watchSchema({ url: 'http://x', signal: controller.signal, intervalMs: 1, onChange, onError });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled(); // only a baseline read succeeded
  });

  it('retries the same change next tick when onChange throws (does not advance the baseline)', async () => {
    const controller = new AbortController();
    const bodies = ['A', 'B', 'B'];
    let i = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      const body = bodies[Math.min(i, bodies.length - 1)];
      i += 1;
      if (i >= bodies.length) controller.abort();
      return okText(body);
    }));

    // Fails the first re-sync, succeeds the retry.
    const onChange = vi.fn().mockRejectedValueOnce(new Error('sync-types exited 1')).mockResolvedValue(undefined);
    const onError = vi.fn();
    await watchSchema({ url: 'http://x', signal: controller.signal, intervalMs: 1, onChange, onError });

    // baseline A · A→B (throws, baseline stays A) · A→B again (succeeds) = 2 attempts
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await watchSchema({ url: 'http://x', signal: controller.signal, onChange: vi.fn() });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ignores a change confined to editable values (layoutDefaults) — types did not change', async () => {
    const controller = new AbortController();
    const payload = (gap: string) => JSON.stringify({
      tree: { version: 2 },
      contentTypes: { 'plugin::press-cms.page': {} },
      components: { 'preset-atom.paragraph': {} },
      layoutDefaults: { page: {}, row: { gap }, column: {} },
    });
    const bodies = [payload('normal'), payload('spacious'), payload('compact')];
    let i = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      const body = bodies[Math.min(i, bodies.length - 1)];
      i += 1;
      if (i >= bodies.length) controller.abort();
      return okText(body);
    }));

    const onChange = vi.fn();
    await watchSchema({ url: 'http://x', signal: controller.signal, intervalMs: 1, onChange });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('still fires when a component or content-type actually changes', async () => {
    const controller = new AbortController();
    const payload = (components: object) => JSON.stringify({
      tree: { version: 2 },
      contentTypes: {},
      components,
      layoutDefaults: { page: {}, row: {}, column: {} },
    });
    const bodies = [payload({}), payload({ 'custom-organism.callout': {} }), payload({ 'custom-organism.callout': {} })];
    let i = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      const body = bodies[Math.min(i, bodies.length - 1)];
      i += 1;
      if (i >= bodies.length) controller.abort();
      return okText(body);
    }));

    const onChange = vi.fn();
    await watchSchema({ url: 'http://x', signal: controller.signal, intervalMs: 1, onChange });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('falls back to raw-body comparison for a non-JSON body (cms mid-restart)', async () => {
    const controller = new AbortController();
    const bodies = ['<html>restarting</html>', 'still not json', 'still not json'];
    let i = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      const body = bodies[Math.min(i, bodies.length - 1)];
      i += 1;
      if (i >= bodies.length) controller.abort();
      return okText(body);
    }));

    const onChange = vi.fn();
    await watchSchema({ url: 'http://x', signal: controller.signal, intervalMs: 1, onChange });
    // baseline · changed raw body fires once · unchanged
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
