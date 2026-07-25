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
 * The TYPE-relevant slice of the schema payload. `/api/press/schema` also serves
 * EDITABLE values (`layoutDefaults`, layout-defaults spec §8a), so comparing the
 * raw text would make an editorial change look like a schema change and re-sync
 * types on every layout edit — a no-op for the generator (it walks
 * `contentTypes`/`components` only), but churn and a misleading log line. This
 * preserves the invariant "type-sync runs when TYPES change".
 *
 * A body that does not parse as a JSON OBJECT (a cms mid-restart returns HTML)
 * falls back to the raw text, so that path behaves exactly as it did before:
 * compare, retry, never tear down.
 */
function typeFingerprint(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null) return body;
    const { contentTypes, components, tree } = parsed as Record<string, unknown>;
    return JSON.stringify({ contentTypes, components, tree });
  } catch {
    return body;
  }
}

/**
 * Polls the engine schema endpoint and invokes `onChange` whenever the TYPE-relevant
 * slice of the served body differs from the last successful read (see `typeFingerprint`).
 * Decoupled from HOW the schema changed (a Strapi restart after the adopter edits a
 * custom.* component, an admin edit, ...): it re-reads what Strapi actually serves,
 * so a re-sync can never run against a stale schema. The first successful read is the
 * baseline (no onChange). Transient failures (cms mid-restart, a 500 from a momentarily
 * invalid schema) go to onError and are retried — the watcher never tears the stack down.
 */
export async function watchSchema(opts: WatchSchemaOptions): Promise<void> {
  const { url, signal, onChange, onError } = opts;
  const intervalMs = opts.intervalMs ?? 2000;
  let last: string | undefined;

  while (!signal.aborted) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = typeFingerprint(await res.text());
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
