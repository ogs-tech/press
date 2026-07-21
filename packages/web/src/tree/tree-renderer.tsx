/**
 * TreeRenderer — renders a PressTree as <header>/<main>/<footer> (Spec §5).
 * Layout-by-components: the App Router `children` slot is the outlet; the tree
 * owns the page shell. Read-side tolerance (Spec §7): a malformed body renders
 * EMPTY (dev warning) but chrome still resolves from pageDefaults; unknown
 * block components are skipped (BlockRenderer precedent); container attrs were
 * already sanitized by the shared validator.
 */
import type { ComponentType, CSSProperties } from 'react';
import type { ColumnNode, Node, Ratio, RowNode } from '@ogs-tech/press-shared';
import { validatePressTree } from '@ogs-tech/press-shared';
import { atomBlocks } from '../atom-blocks';
import { organismBlocks } from '../organism-blocks';
import { componentUrn } from '../urn';
import type { ResolvedPressConfig } from '../config/types';
import { Column } from '../layout/column';
import { Container } from '../layout/container';
import { Grid } from '../layout/grid';
import { cellAlign, rowAlign, rowGap, rowWidth, spanFor, stackGap } from './container-attrs';
import { hydrateEngineBlocks, resolveTree, type ResolvedTree } from './resolve-slots';

type Registry = Record<string, ComponentType<any>>;

interface TreeRendererProps {
  /** The raw page body (PressTree on the wire) — validated here, never trusted. */
  body: unknown;
  site: ResolvedPressConfig;
  /** Adopter custom blocks, passed EXPLICITLY (no global registry — BlockRenderer contract kept). */
  components?: Registry;
}

function BlockView({ node, registry }: { node: Node & { type: 'block' }; registry: Registry }) {
  const Component = registry[node.component];
  if (!Component) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[press/web] no component registered for ${componentUrn(node.component)} — skipping`);
    }
    return null;
  }
  return <Component {...node.data} />;
}

function ColumnView({ column, ratio, index, registry }: { column: ColumnNode; ratio: Ratio; index: number; registry: Registry }) {
  const gap = stackGap(column.container);
  const align = cellAlign(column.container);
  const style = gap ? ({ ['--press-cell-gap' as string]: gap } as CSSProperties) : undefined;
  return (
    <Column span={spanFor(ratio, index)}>
      <div data-press-cell="" data-cell-align={align} style={style}>
        <NodeList nodes={column.children} registry={registry} top={false} />
      </div>
    </Column>
  );
}

function RowView({ row, registry, top }: { row: RowNode; registry: Registry; top: boolean }) {
  const grid = (
    <Grid gap={rowGap(row.container)} alignItems={rowAlign(row.container)}>
      {row.children.map((column, i) => (
        <ColumnView key={column.id} column={column} ratio={row.ratio} index={i} registry={registry} />
      ))}
    </Grid>
  );
  // width applies to top-level rows only (Spec §3); nested rows fill their cell.
  if (!top) return grid;
  return (
    <Container as="section" maxWidth={rowWidth(row.container)}>
      {grid}
    </Container>
  );
}

function NodeList({ nodes, registry, top }: { nodes: Node[]; registry: Registry; top: boolean }) {
  return (
    <>
      {nodes.map((node) => {
        if (node.type === 'block') return <BlockView key={node.id} node={node} registry={registry} />;
        if (node.type === 'row') return <RowView key={node.id} row={node} registry={registry} top={top} />;
        // A stray column never survives the validator; belt-and-braces skip.
        return null;
      })}
    </>
  );
}

export function TreeRenderer({ body, site, components = {} }: TreeRendererProps) {
  const registry: Registry = { ...atomBlocks, ...organismBlocks, ...components };
  const { value: tree, errors } = validatePressTree(body);
  if (!tree && process.env.NODE_ENV !== 'production') {
    console.warn('[press/web] malformed composition tree — rendering empty body', errors);
  }
  const brand = { name: site.brand.name, logo: site.brand.logo };
  const resolved: ResolvedTree = tree
    ? resolveTree(tree, site)
    : {
        // Malformed body (Spec §7): body fails to empty, chrome still inherits.
        header: hydrateEngineBlocks(site.pageDefaults.header, brand, site.routes.home),
        children: [],
        footer: hydrateEngineBlocks(site.pageDefaults.footer, brand, site.routes.home),
        rootContainer: undefined,
      };
  const gap = stackGap(resolved.rootContainer);
  return (
    <>
      <header>
        <NodeList nodes={resolved.header} registry={registry} top />
      </header>
      <main
        data-press-stack={gap ? '' : undefined}
        style={gap ? ({ ['--press-tree-gap' as string]: gap } as CSSProperties) : undefined}
      >
        <NodeList nodes={resolved.children} registry={registry} top />
      </main>
      <footer>
        <NodeList nodes={resolved.footer} registry={registry} top />
      </footer>
    </>
  );
}
