import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PresetMoleculeColumn } from '../types/base';
import { Columns } from './columns';

// Mirrors the hero contract tests: renderers are called as functions and resolve
// media absolute against CMS_URL (unset here → engine default).
const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(Columns({ __component: 'preset-organism.columns', id: 1, ...(props as any) }));

const text = (t: string): PresetMoleculeColumn['content'] => [
  { type: 'paragraph', children: [{ type: 'text', text: t }] },
];

const col = (overrides: Partial<PresetMoleculeColumn> = {}, id = 1): PresetMoleculeColumn =>
  ({ id, ...overrides }) as PresetMoleculeColumn;

describe('Columns renderer', () => {
  it('renders nothing when columns is missing or empty (tolerant draft)', () => {
    expect(render({})).toBe('');
    expect(render({ columns: [] })).toBe('');
  });

  it('wraps output in a <section> Container carrying data-block (the Hero shell pattern)', () => {
    const html = render({ columns: [col({ content: text('a') }, 1), col({ content: text('b') }, 2)] });
    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain('data-press-layout="container"');
    expect(html).toContain('data-max-width="lg"');
    expect(html).toContain('data-block="preset-organism.columns"');
    expect(html).toContain('data-press-layout="grid"');
  });

  it('defaults ratio to 50-50: both cells span 12 at base and 6 on md', () => {
    const html = render({ columns: [col({}, 1), col({}, 2)] });
    expect(html.match(/--press-col-span:12/g)).toHaveLength(2);
    expect(html.match(/--press-col-span-md:6/g)).toHaveLength(2);
  });

  it('maps 33-67 / 67-33 to asymmetric md spans', () => {
    const narrowWide = render({ ratio: '33-67', columns: [col({}, 1), col({}, 2)] });
    expect(narrowWide).toContain('--press-col-span-md:4');
    expect(narrowWide).toContain('--press-col-span-md:8');
    const wideNarrow = render({ ratio: '67-33', columns: [col({}, 1), col({}, 2)] });
    expect(wideNarrow.indexOf('--press-col-span-md:8')).toBeLessThan(wideNarrow.indexOf('--press-col-span-md:4'));
  });

  it('maps 33-33-33 to three md:4 cells', () => {
    const html = render({ ratio: '33-33-33', columns: [col({}, 1), col({}, 2), col({}, 3)] });
    expect(html.match(/--press-col-span-md:4/g)).toHaveLength(3);
  });

  it('25-25-25-25 goes 2×2 on md (span 6) before 4-up on lg (span 3)', () => {
    const html = render({
      ratio: '25-25-25-25',
      columns: [col({}, 1), col({}, 2), col({}, 3), col({}, 4)],
    });
    expect(html.match(/--press-col-span-md:6/g)).toHaveLength(4);
    expect(html.match(/--press-col-span-lg:3/g)).toHaveLength(4);
  });

  it('renders FEWER columns than the ratio has slots without phantom cells', () => {
    const html = render({ ratio: '33-33-33', columns: [col({}, 1), col({}, 2)] });
    expect(html.match(/data-column="cell"/g)).toHaveLength(2);
  });

  it('a column beyond the ratio slots reuses the last span instead of being dropped', () => {
    const html = render({ ratio: '50-50', columns: [col({}, 1), col({}, 2), col({}, 3)] });
    expect(html.match(/data-column="cell"/g)).toHaveLength(3);
    expect(html.match(/--press-col-span-md:6/g)).toHaveLength(3);
  });

  it('defaults gap to "normal" (md at every tier) and maps compact/spacious', () => {
    const two = [col({}, 1), col({}, 2)];
    expect(render({ columns: two })).toContain('--press-grid-gap-current:var(--press-grid-gap-md)');
    expect(render({ gap: 'compact', columns: two })).toContain('--press-grid-gap-current:var(--press-grid-gap-sm)');
    const spacious = render({ gap: 'spacious', columns: two });
    // Tier-scaled like the Hero: md at base (11-gap floor stays phone-safe), lg from lg up.
    expect(spacious).toContain('--press-grid-gap-current:var(--press-grid-gap-md)');
    expect(spacious).toContain('--press-grid-gap-current-lg:var(--press-grid-gap-lg)');
  });

  it('maps verticalAlign editorial vocabulary to Grid alignItems (default top → start)', () => {
    const two = [col({}, 1), col({}, 2)];
    expect(render({ columns: two })).toContain('data-align-items="start"');
    expect(render({ verticalAlign: 'center', columns: two })).toContain('data-align-items="center"');
    expect(render({ verticalAlign: 'bottom', columns: two })).toContain('data-align-items="end"');
  });

  it('renders rich text content via the shared blocks renderer', () => {
    const html = render({ columns: [col({ content: text('Server-rendered') }, 1), col({}, 2)] });
    expect(html).toContain('data-column="content"');
    expect(html).toContain('<p>Server-rendered</p>');
  });

  it('resolves the column image absolute against CMS_URL', () => {
    const html = render({ columns: [col({ image: { url: '/uploads/c.png', alternativeText: 'Chart' } }, 1), col({}, 2)] });
    expect(html).toContain('src="http://localhost:1337/uploads/c.png"');
    expect(html).toContain('alt="Chart"');
  });

  it('renders the button only when BOTH label and href are present, defaulting variant to primary', () => {
    const withButton = render({
      columns: [col({ button: { label: 'Go', href: '/go' } as any }, 1), col({}, 2)],
    });
    expect(withButton).toContain('data-column="button"');
    expect(withButton).toContain('data-variant="primary"');
    expect(withButton).toContain('href="/go"');
    expect(render({ columns: [col({ button: { label: 'Go' } as any }, 1), col({}, 2)] })).not.toContain('data-column="button"');
    expect(render({ columns: [col({ button: { href: '/go' } as any }, 1), col({}, 2)] })).not.toContain('data-column="button"');
  });

  it('an EMPTY column still renders its cell — it holds the track, siblings must not reflow', () => {
    const html = render({ columns: [col({ content: text('a') }, 1), col({}, 2)] });
    expect(html.match(/data-column="cell"/g)).toHaveLength(2);
    expect(html.match(/data-column="content"/g)).toHaveLength(1);
  });

  it('never renders atom components inside cells (no nested data-block="preset-atom.*")', () => {
    // The prose-width rule matches `main [data-block^="preset-atom."]` at any
    // depth — an atom component inside a cell would fight the cell's own width.
    const html = render({
      columns: [
        col({ content: text('a'), image: { url: '/uploads/c.png' }, button: { label: 'Go', href: '/go' } as any }, 1),
        col({}, 2),
      ],
    });
    expect(html).not.toContain('data-block="preset-atom.');
  });
});
