import { afterEach, describe, expect, it, vi } from 'vitest';
import { quietSchemaHttpLog } from './quiet-schema-log';

/** Minimal logger fake: records every message that reaches the real http level. */
function fakeStrapi() {
  const lines: unknown[][] = [];
  const log = {
    http: (...args: unknown[]) => {
      lines.push(args);
      return log;
    },
  };
  return { strapi: { log } as any, lines };
}

describe('quietSchemaHttpLog', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('drops the schema-poll line in development, passes everything else through', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { strapi, lines } = fakeStrapi();
    quietSchemaHttpLog(strapi);

    strapi.log.http('GET /api/press/schema (2 ms) 200');
    strapi.log.http('GET /api/pages?populate=deep (14 ms) 200');
    strapi.log.http('POST /admin/login (32 ms) 200');

    expect(lines).toEqual([
      ['GET /api/pages?populate=deep (14 ms) 200'],
      ['POST /admin/login (32 ms) 200'],
    ]);
  });

  it('leaves the logger untouched outside development (stray schema hits stay visible)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { strapi, lines } = fakeStrapi();
    const before = strapi.log.http;
    quietSchemaHttpLog(strapi);

    expect(strapi.log.http).toBe(before);
    strapi.log.http('GET /api/press/schema (2 ms) 200');
    expect(lines).toEqual([['GET /api/press/schema (2 ms) 200']]);
  });

  it('forwards non-string and multi-arg calls unchanged', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { strapi, lines } = fakeStrapi();
    quietSchemaHttpLog(strapi);

    const meta = { requestId: 'r1' };
    strapi.log.http('GET /api/pages (3 ms) 200', meta);
    strapi.log.http({ raw: true } as any);

    expect(lines).toEqual([['GET /api/pages (3 ms) 200', meta], [{ raw: true }]]);
  });
});
