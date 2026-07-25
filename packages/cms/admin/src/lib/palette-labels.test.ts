import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { containerFieldLabel, containerOptionLabel } from './palette-labels';

// The six field-label strings are a THREE-copy contract: this admin-side map,
// plus the server-side `preset-config.layout-{page,row,column}` component JSON
// (metadatas edit label), plus each side's own test pinning its own literal.
// Nothing previously compared the two SOURCES to each other — a copy-edit of
// one JSON label could go green here and in inject-components.test.ts while
// silently breaking the builder's "Site default · …" traceability. Read the
// server JSON directly (node:fs, not an import) to sidestep the admin/server
// tsconfig rootDirs split.
const configDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'server', 'src', 'components', 'config');
const readComponent = (file: string) => JSON.parse(readFileSync(join(configDir, file), 'utf8'));

const LAYOUT_PAGE = readComponent('layout-page.json');
const LAYOUT_ROW = readComponent('layout-row.json');
const LAYOUT_COLUMN = readComponent('layout-column.json');

describe('containerFieldLabel', () => {
  it('names `gap` per LEVEL — two different physical axes, never one shared label', () => {
    expect(containerFieldLabel('row', 'gap')).toBe('Column gap');
    expect(containerFieldLabel('column', 'gap')).toBe('Vertical rhythm');
    expect(containerFieldLabel('layout', 'gap')).toBe('Vertical rhythm');
  });

  it('matches the Site Settings field labels verbatim (the traceability contract)', () => {
    expect(containerFieldLabel('row', 'width')).toBe('Width');
    expect(containerFieldLabel('row', 'verticalAlign')).toBe('Vertical align');
    expect(containerFieldLabel('column', 'verticalAlign')).toBe('Content align');
  });

  it('degrades to the generic field label for a level/key pair with no entry', () => {
    expect(containerFieldLabel('layout', 'verticalAlign')).toBe('Vertical Align');
  });

  it('matches the Site Settings `preset-config.layout-*` component labels — the two SOURCES, not a third copy', () => {
    expect(containerFieldLabel('layout', 'gap')).toBe(LAYOUT_PAGE.config.metadatas.gap.edit.label);
    expect(containerFieldLabel('row', 'width')).toBe(LAYOUT_ROW.config.metadatas.width.edit.label);
    expect(containerFieldLabel('row', 'gap')).toBe(LAYOUT_ROW.config.metadatas.gap.edit.label);
    expect(containerFieldLabel('row', 'verticalAlign')).toBe(LAYOUT_ROW.config.metadatas.verticalAlign.edit.label);
    expect(containerFieldLabel('column', 'gap')).toBe(LAYOUT_COLUMN.config.metadatas.gap.edit.label);
    expect(containerFieldLabel('column', 'verticalAlign')).toBe(LAYOUT_COLUMN.config.metadatas.verticalAlign.edit.label);
  });
});

describe('containerOptionLabel', () => {
  it('humanizes the wire tokens an editor cannot read', () => {
    expect(containerOptionLabel('width', 'prose')).toBe('Reading width');
    expect(containerOptionLabel('width', 'lg')).toBe('Content width');
    expect(containerOptionLabel('width', 'full')).toBe('Full bleed');
  });

  it('title-cases the gap and alignment tokens', () => {
    expect(containerOptionLabel('gap', 'compact')).toBe('Compact');
    expect(containerOptionLabel('gap', 'normal')).toBe('Normal');
    expect(containerOptionLabel('gap', 'spacious')).toBe('Spacious');
    expect(containerOptionLabel('verticalAlign', 'top')).toBe('Top');
    expect(containerOptionLabel('verticalAlign', 'bottom')).toBe('Bottom');
  });

  it('names the ABSENT state — a real, nameable default on page/column gap', () => {
    expect(containerOptionLabel('gap', undefined)).toBe('per-block spacing');
    expect(containerOptionLabel('width', undefined)).toBe('per-block spacing');
  });

  it('degrades to a title-cased token for an unmapped value', () => {
    expect(containerOptionLabel('gap', 'roomy')).toBe('Roomy');
  });
});
