// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DesignSystemProvider } from '@strapi/design-system';
import type { PressSchema } from '@ogs-tech/press-shared';
import { TreeEditor } from './tree-editor';
import { newBlockNode, newRowNode, type Forest } from '../lib/tree-ops';

const SCHEMA = { tree: { version: 2 }, contentTypes: {}, components: {} } as unknown as PressSchema;
const MediaField = () => <></>; // no-op stub; prop type requires a JSX.Element, not null

let container: HTMLDivElement;
let root: Root;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const stubBrowserApis = (): void => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
    })) as any;
  }
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
};

const render = (ui: ReactElement) => root.render(<DesignSystemProvider>{ui}</DesignSystemProvider>);

beforeEach(() => {
  stubBrowserApis();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const buttonByText = (scope: ParentNode, text: string): HTMLButtonElement => {
  const btn = [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  if (!btn) throw new Error(`button "${text}" not found`);
  return btn as HTMLButtonElement;
};

describe('TreeEditor span controls', () => {
  // hero + a 2-column row → collapsibleIds.length === 2 → the "Expand all" button appears.
  const forest = (): Forest => [newBlockNode('preset-organism.hero'), newRowNode()];

  it('renders per-column span selects, a tier toggle, and a per-tier total badge', async () => {
    await act(async () => {
      render(<TreeEditor forest={forest()} schema={SCHEMA} onChange={() => {}} MediaField={MediaField} />);
    });
    // open the row (and the hero) so the row body renders its span UI
    await act(async () => { buttonByText(container, 'Expand all').click(); });

    // three tier-toggle buttons on the row
    expect(container.querySelectorAll('[data-press-tier]')).toHaveLength(3);
    // each column card exposes a span control group
    expect(container.querySelectorAll('[data-press-span]').length).toBeGreaterThanOrEqual(2);

    // default tier is base: two columns at base 12 → 24/12 total
    const badge = () => container.querySelector('[data-press-span-total]')!.textContent ?? '';
    expect(badge()).toContain('24/12');

    // switch the toggle to md: two columns at md 6 → 12/12
    await act(async () => { (container.querySelector('[data-press-tier="md"]') as HTMLButtonElement).click(); });
    expect(badge()).toContain('12/12');
  });
});

/** Opens every collapsed "Layout options" section currently in the DOM. */
const openLayoutOptions = async (): Promise<void> => {
  const toggles = [...container.querySelectorAll('[data-press-container-toggle]')] as HTMLButtonElement[];
  for (const toggle of toggles) await act(async () => { toggle.click(); });
};

describe('TreeEditor container sections', () => {
  const forest = (): Forest => [newBlockNode('preset-organism.hero'), newRowNode()];

  it('names the SITE default in every placeholder and never says "engine default"', async () => {
    await act(async () => {
      render(<TreeEditor forest={forest()} schema={SCHEMA} onChange={() => {}} MediaField={MediaField} />);
    });
    await act(async () => { buttonByText(container, 'Expand all').click(); });
    await openLayoutOptions();

    const text = container.textContent ?? '';
    expect(text).not.toContain('engine default');
    expect(text).toContain('Site default · Content width');     // row width  ← DEFAULT_LAYOUT lg
    expect(text).toContain('Site default · Normal');             // row gap    ← DEFAULT_LAYOUT normal
    expect(text).toContain('Site default · Top');                // vertical alignment ← top
    expect(text).toContain('Site default · per-block spacing');  // column gap ← absent by default
  });

  it('labels the same `gap` key per level — "Column gap" on a row, "Vertical rhythm" in a column', async () => {
    await act(async () => {
      render(<TreeEditor forest={forest()} schema={SCHEMA} onChange={() => {}} MediaField={MediaField} />);
    });
    await act(async () => { buttonByText(container, 'Expand all').click(); });
    await openLayoutOptions();

    const text = container.textContent ?? '';
    expect(text).toContain('Column gap');
    expect(text).toContain('Vertical rhythm');
    expect(text).toContain('Vertical align');
    expect(text).toContain('Content align');
    expect(text).toContain('Width');
  });

  it('reflects the CMS-served layoutDefaults, so the placeholder traces to the field an editor set', async () => {
    const schema = {
      ...SCHEMA,
      layoutDefaults: {
        page: {},
        row: { width: 'full', gap: 'spacious', verticalAlign: 'center' },
        column: { gap: 'compact', verticalAlign: 'bottom' },
      },
    } as unknown as PressSchema;
    await act(async () => {
      render(<TreeEditor forest={forest()} schema={schema} onChange={() => {}} MediaField={MediaField} />);
    });
    await act(async () => { buttonByText(container, 'Expand all').click(); });
    await openLayoutOptions();

    const text = container.textContent ?? '';
    expect(text).toContain('Site default · Full bleed');
    expect(text).toContain('Site default · Spacious');
    expect(text).toContain('Site default · Compact');
    expect(text).toContain('Site default · Bottom');
  });
});
