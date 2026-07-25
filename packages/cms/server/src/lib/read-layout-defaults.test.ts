import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAYOUT } from '@ogs-tech/press-shared';
import { readLayoutDefaults } from './read-layout-defaults';

const strapiWith = (record: unknown, opts: { throws?: boolean } = {}) => {
  // Typed with an (ignored) params arg — not a no-arg thunk — so `Parameters<T>`
  // isn't inferred as `[]`, which would make `findFirst.mock.calls[0][0]` (used
  // below) a TS2493 out-of-bounds index on an empty tuple.
  const findFirst = vi.fn(async (_params: unknown) => {
    if (opts.throws) throw new Error('db unavailable');
    return record;
  });
  return { strapi: { documents: vi.fn(() => ({ findFirst })) } as any, findFirst };
};

describe('readLayoutDefaults', () => {
  it('resolves the stored layout group through the shared resolver', async () => {
    const { strapi } = strapiWith({ layout: { row: { width: 'full' }, page: { gap: 'spacious' } } });
    const layout = await readLayoutDefaults(strapi);
    expect(layout.row).toEqual({ width: 'full', gap: 'normal', verticalAlign: 'top' });
    expect(layout.page).toEqual({ gap: 'spacious' });
  });

  it('returns DEFAULT_LAYOUT when the single type is missing (pre-bootstrap / wiped db)', async () => {
    const { strapi } = strapiWith(null);
    expect(await readLayoutDefaults(strapi)).toEqual(DEFAULT_LAYOUT);
  });

  it('returns DEFAULT_LAYOUT when the record carries no layout group', async () => {
    const { strapi } = strapiWith({ name: 'Acme' });
    expect(await readLayoutDefaults(strapi)).toEqual(DEFAULT_LAYOUT);
  });

  it('never throws — a failed read still yields a complete payload', async () => {
    const { strapi } = strapiWith(null, { throws: true });
    expect(await readLayoutDefaults(strapi)).toEqual(DEFAULT_LAYOUT);
  });

  it('deep-populates the three level components (a shallow populate stops at the group)', async () => {
    const { strapi, findFirst } = strapiWith({});
    await readLayoutDefaults(strapi);
    expect(findFirst.mock.calls[0][0]).toEqual({
      populate: { layout: { populate: { page: true, row: true, column: true } } },
    });
  });
});
