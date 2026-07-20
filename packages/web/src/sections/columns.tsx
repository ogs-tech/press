import type { Responsive } from '../layout/breakpoints';
import type { Span } from '../layout/column';
import type { GridAlignItems, GridGap } from '../layout/grid';
import type { PresetMoleculeColumn, PresetOrganismColumns } from '../types/base';
import { Container } from '../layout/container';
import { Grid } from '../layout/grid';
import { Column } from '../layout/column';
import { renderBlocks } from '../blocks/blocks-content';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

type Ratio = NonNullable<PresetOrganismColumns['ratio']>;
type Gap = NonNullable<PresetOrganismColumns['gap']>;
type VerticalAlign = NonNullable<PresetOrganismColumns['verticalAlign']>;

/**
 * CMS ratio → per-slot spans. The editor's vocabulary is a CLOSED enum key the
 * renderer owns the meaning of — spans can evolve (e.g. better tablet behavior)
 * without touching stored content. Every layout stacks at base; `25-25-25-25`
 * goes 2×2 on md before 4-up on lg (4 × span-3 is too tight at 768px).
 */
const RATIO_SPANS: Record<Ratio, Responsive<Span>[]> = {
  '50-50': [{ base: 12, md: 6 }, { base: 12, md: 6 }],
  '33-67': [{ base: 12, md: 4 }, { base: 12, md: 8 }],
  '67-33': [{ base: 12, md: 8 }, { base: 12, md: 4 }],
  '33-33-33': [{ base: 12, md: 4 }, { base: 12, md: 4 }, { base: 12, md: 4 }],
  '25-25-25-25': [
    { base: 12, md: 6, lg: 3 },
    { base: 12, md: 6, lg: 3 },
    { base: 12, md: 6, lg: 3 },
    { base: 12, md: 6, lg: 3 },
  ],
};

/**
 * Semantic gap → GridGap tiers. The raw GridGap scale is never exposed to the
 * CMS: a 12-track grid always carries 11 interior column-gaps, so a flat 'lg'
 * (48px) means a 528px floor that overflows phones — 'spacious' therefore uses
 * the Hero's tier-scaled pattern ('md' at base, 'lg' from lg up).
 */
const GAP_TIERS: Record<Gap, Responsive<GridGap>> = {
  compact: 'sm',
  normal: 'md',
  spacious: { base: 'md', lg: 'lg' },
};

/** CMS editorial vocabulary (top/center/bottom) → Grid's technical axis values. */
const ALIGN_ITEMS: Record<VerticalAlign, GridAlignItems> = {
  top: 'start',
  center: 'center',
  bottom: 'end',
};

function ColumnCell({ column, span }: { column: PresetMoleculeColumn; span: Responsive<Span> }) {
  const hasImage = Boolean(column.image?.url);
  const hasButton = Boolean(column.button?.label && column.button?.href);
  return (
    <Column span={span} data-column="cell">
      {/* renderBlocks + raw <img>/<a> on purpose — NOT the Paragraph/Image/Button
          atom components: those emit data-block="preset-atom.*", which the
          prose-width rule (`main [data-block^="preset-atom."]` in theme.css)
          matches at ANY depth and would fight the cell's own span/width. Same
          reason the navbar inlines its cta anchor. */}
      {column.content?.length ? <div data-column="content">{renderBlocks(column.content)}</div> : null}
      {hasImage ? (
        <img
          data-column="image"
          src={new URL(column.image!.url, CMS_URL).toString()}
          alt={column.image!.alternativeText ?? ''}
        />
      ) : null}
      {hasButton ? (
        <a data-column="button" data-variant={column.button!.variant ?? 'primary'} href={column.button!.href}>
          {column.button!.label}
        </a>
      ) : null}
    </Column>
  );
}

/**
 * Engine organism `preset-organism.columns` — an editor-composed 2–4 column
 * section built on Container/Grid/Column, mirroring the Hero pattern. The
 * layout controls (`ratio`/`gap`/`verticalAlign`) are closed CMS enums mapped
 * to primitive props above.
 *
 * Tolerant, mirroring hero/cta: no columns renders nothing; an EMPTY column
 * still renders its cell (it holds the ratio's track — dropping it would
 * reflow siblings); a column beyond the ratio's slots reuses the last slot's
 * span and wraps to the next row rather than being discarded.
 */
export function Columns({ ratio, gap, verticalAlign, columns }: PresetOrganismColumns) {
  if (!columns?.length) return null;
  const spans = RATIO_SPANS[ratio ?? '50-50'] ?? RATIO_SPANS['50-50'];
  return (
    <Container as="section" maxWidth="lg" data-block="preset-organism.columns">
      <Grid gap={GAP_TIERS[gap ?? 'normal'] ?? GAP_TIERS.normal} alignItems={ALIGN_ITEMS[verticalAlign ?? 'top'] ?? 'start'}>
        {columns.map((col, i) => (
          <ColumnCell key={col.id ?? i} column={col} span={spans[Math.min(i, spans.length - 1)]} />
        ))}
      </Grid>
    </Container>
  );
}
