import { describe, expect, it } from 'vitest';
import { seedDefaultTheme, THEME_UID } from './seed-default-theme';

/** Minimal Document-Service fake: a mutable count + a recording create(). */
function fakeStrapi(initialCount = 0) {
  let count = initialCount;
  const creates: Array<{ data: unknown }> = [];
  const strapi = {
    documents: (uid: string) => {
      expect(uid).toBe(THEME_UID); // helper must target the theme UID
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

describe('seedDefaultTheme', () => {
  it('seeds exactly one active "Default" on a fresh DB', async () => {
    const { strapi, creates, size } = fakeStrapi(0);
    await seedDefaultTheme(strapi);
    expect(creates).toEqual([{ data: { name: 'Default', active: true } }]);
    expect(size()).toBe(1);
  });

  it('does nothing when a theme already exists (idempotent)', async () => {
    const { strapi, creates, size } = fakeStrapi(1);
    await seedDefaultTheme(strapi);
    expect(creates).toEqual([]);
    expect(size()).toBe(1);
  });

  it('is idempotent across repeated runs — never creates a second theme', async () => {
    const { strapi, creates, size } = fakeStrapi(0);
    await seedDefaultTheme(strapi);
    await seedDefaultTheme(strapi);
    await seedDefaultTheme(strapi);
    expect(creates).toHaveLength(1);
    expect(size()).toBe(1);
  });
});
