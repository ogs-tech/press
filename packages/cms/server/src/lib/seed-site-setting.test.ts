import { describe, expect, it } from 'vitest';
import { seedSiteSetting, SITE_SETTING_UID } from './seed-site-setting';

/** Minimal Document-Service fake: a mutable count + a recording create(). */
function fakeStrapi(initialCount = 0) {
  let count = initialCount;
  const creates: Array<{ data: unknown }> = [];
  const strapi = {
    documents: (uid: string) => {
      expect(uid).toBe(SITE_SETTING_UID); // helper must target the single-type UID
      return {
        count: async () => count,
        create: async (params: { data: unknown }) => {
          count += 1;
          creates.push(params);
          return params.data;
        },
      };
    },
  } as any;
  return { strapi, creates, size: () => count };
}

describe('seedSiteSetting', () => {
  it('seeds exactly one EMPTY record on a fresh DB', async () => {
    const { strapi, creates, size } = fakeStrapi(0);
    await seedSiteSetting(strapi);
    expect(creates).toEqual([{ data: {} }]); // empty: no defaults duplicated in the CMS
    expect(size()).toBe(1);
  });

  it('does nothing when a record already exists (idempotent)', async () => {
    const { strapi, creates, size } = fakeStrapi(1);
    await seedSiteSetting(strapi);
    expect(creates).toEqual([]);
    expect(size()).toBe(1);
  });

  it('is idempotent across repeated runs — never creates a second record', async () => {
    const { strapi, creates, size } = fakeStrapi(0);
    await seedSiteSetting(strapi);
    await seedSiteSetting(strapi);
    await seedSiteSetting(strapi);
    expect(creates).toHaveLength(1);
    expect(size()).toBe(1);
  });
});
