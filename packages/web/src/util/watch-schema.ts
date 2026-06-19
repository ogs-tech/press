export interface WatchSchemaOptions {
  /** Engine schema endpoint to poll (e.g. `${CMS_URL}/api/press/schema`). */
  url: string;
  /** Abort to stop the loop — wired to `press dev` shutdown. */
  signal: AbortSignal;
  intervalMs?: number;
  /** Invoked when the served schema differs from the last successful read. */
  onChange: () => Promise<void> | void;
  /** Invoked on a failed poll or a failed onChange — loud, but non-fatal. */
  onError?: (err: unknown) => void;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Polls the engine schema endpoint and invokes `onChange` whenever the served
 * body differs from the last successful read. Decoupled from HOW the schema
 * changed (a Strapi restart after the adopter edits a custom.* component, an admin
 * edit, ...): it re-reads what Strapi actually serves, so a re-sync can never run
 * against a stale schema. The first successful read is the baseline (no onChange).
 * Transient failures (cms mid-restart, a 500 from a momentarily invalid schema)
 * go to onError and are retried — the watcher never tears the stack down.
 */
export async function watchSchema(opts: WatchSchemaOptions): Promise<void> {
  const { url, signal, onChange, onError } = opts;
  const intervalMs = opts.intervalMs ?? 2000;
  let last: string | undefined;

  while (!signal.aborted) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.text();
        if (last !== undefined && body !== last) await onChange();
        // Only advance the baseline on success: if onChange threw, the same change
        // is retried next tick (auto-recovers once the schema is valid again).
        last = body;
      }
    } catch (err) {
      onError?.(err);
    }
    await delay(intervalMs, signal);
  }
}
