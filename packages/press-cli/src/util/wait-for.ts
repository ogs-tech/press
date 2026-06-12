export interface WaitForOptions {
  /** HTTP status that counts as healthy (Strapi health is 204; web is 200). */
  okStatus?: number;
  tries?: number;
  intervalMs?: number;
}

/**
 * Polls a URL until it returns the healthy status. Reuses the Spec 1 ordering
 * lesson: gate each boot step on the prior one being actually ready, not on a
 * fixed sleep (spec §11, concurrency-race row).
 */
export async function waitFor(url: string, opts: WaitForOptions = {}): Promise<boolean> {
  const ok = opts.okStatus ?? 200;
  const tries = opts.tries ?? 60;
  const intervalMs = opts.intervalMs ?? 2000;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === ok || (ok === 200 && res.ok)) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
