import type { Core } from '@strapi/strapi';

/** Path of the engine schema endpoint as logged by `strapi::logger` (`ctx.url`). */
const SCHEMA_PATH = '/api/press/schema';

/**
 * Silences the http log line for the engine schema endpoint in development.
 *
 * `press dev` polls GET /api/press/schema every ~2s (the type-sync watcher) and
 * Strapi's `strapi::logger` middleware logs every request unconditionally — the
 * poll would drown the dev log in noise. That middleware has no exclusion
 * config, and an inner middleware cannot stop it (it logs after `next()`
 * resolves), so the plugin wraps `strapi.log.http` and drops the one
 * engine-owned line. Development only: in production the watcher never runs,
 * and a stray hit on the schema endpoint should stay visible.
 */
export function quietSchemaHttpLog(strapi: Core.Strapi): void {
  if (process.env.NODE_ENV !== 'development') return;
  const httpLog = strapi.log.http.bind(strapi.log) as (...args: unknown[]) => unknown;
  strapi.log.http = ((...args: unknown[]) => {
    const [message] = args;
    if (typeof message === 'string' && message.includes(SCHEMA_PATH)) return strapi.log;
    return httpLog(...args);
  }) as typeof strapi.log.http;
}
