/**
 * Structural tree editor (Spec §4 v1): collapsible node cards, add/remove/reorder
 * via buttons, per-node forms — rendered with Strapi's design-system so the
 * builder reads as native admin UI. All mutations go through tree-ops, so the
 * structural invariants hold by construction.
 *
 * Card components are module-level (stable identity) on purpose: an editor whose
 * card components are declared inside render would remount on every keystroke and
 * lose each card's open/closed state. They receive a shared `ctx` and recurse
 * through `TreeForest` (mutual recursion: Row → Column → TreeForest → Row …).
 */
import { useMemo, useState } from 'react';
import type { JSX } from 'react'; // @types/react 19 removed the global JSX namespace
import {
  Box, Button, Divider, Field, Flex, IconButton, SingleSelect, SingleSelectOption, Typography,
} from '@strapi/design-system';
import {
  ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash,
} from '@strapi/icons';
import type {
  BlockNode, ColumnNode, ContainerAttrs, ContainerKey, LayoutDefaults, PressSchema, RowNode,
} from '@ogs-tech/press-shared';
import { CONTAINER_ENUMS } from '@ogs-tech/press-shared';
import { applicableContainerAttrs, layoutDefaultsOf, paletteGroups } from '../lib/form-model';
import {
  blockIcon, blockLabel, categoryLabel, COLUMN_ICON, containerFieldLabel, containerOptionLabel, ROW_ICON,
} from '../lib/palette-labels';
import {
  addColumn, effectiveSpan, insertNode, MAX_COLUMNS, moveNode, newBlockNode, newRowNode,
  removeNode, setBlockData, setColumnSpan, setContainerAttr, type Forest, type NodePath,
} from '../lib/tree-ops';
import { NodeForm } from './node-form';

const SPAN_VALUES = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const TIERS = ['base', 'md', 'lg'] as const;
type Tier = (typeof TIERS)[number];

type MediaFieldComponent = Parameters<typeof NodeForm>[0]['MediaField'];

/** Everything a card needs, threaded once through the tree instead of per prop. */
interface TreeCtx {
  forest: Forest;
  schema: PressSchema;
  /** Site layout defaults from the served schema — what every placeholder names. */
  layoutDefaults: LayoutDefaults;
  disabled?: boolean;
  onChange(forest: Forest): void;
  MediaField: MediaFieldComponent;
  /** Central open/collapsed set (keyed by node id) so "Collapse all" is one setState. */
  openIds: Set<string>;
  toggleOpen(id: string): void;
}

/** Every collapsible node id (blocks + rows) in document order — drives expand/collapse-all. */
function collectCollapsibleIds(nodes: Forest): string[] {
  const ids: string[] = [];
  const walk = (list: Forest): void => {
    for (const node of list) {
      if (node.type === 'block') ids.push(node.id);
      else if (node.type === 'row') {
        ids.push(node.id);
        for (const col of node.children) walk(col.children);
      }
    }
  };
  walk(nodes);
  return ids;
}

export interface TreeEditorProps {
  forest: Forest;
  schema: PressSchema;
  disabled?: boolean;
  onChange(forest: Forest): void;
  MediaField: MediaFieldComponent;
}

/** Up / down / remove — the reorder+delete cluster shared by block and row cards. */
function NodeControls({ label, disabled, onUp, onDown, onRemove }: {
  label: string;
  disabled?: boolean;
  onUp(): void;
  onDown(): void;
  onRemove(): void;
}) {
  return (
    <Flex gap={1} tag="span">
      <IconButton label={`Move ${label} up`} variant="ghost" size="S" disabled={disabled} onClick={onUp}><ArrowUp /></IconButton>
      <IconButton label={`Move ${label} down`} variant="ghost" size="S" disabled={disabled} onClick={onDown}><ArrowDown /></IconButton>
      <IconButton label={`Remove ${label}`} variant="ghost" size="S" disabled={disabled} onClick={onRemove}><Trash /></IconButton>
    </Flex>
  );
}

/**
 * Collapsible "Layout options" — the shared container attrs applicable to this
 * node. An unset select does NOT mean "unknown": its placeholder NAMES the value
 * that will be used (`Site default · Content width`), sourced from the CMS-owned
 * LayoutDefaults, and clearing is phrased as returning to that default. Exported
 * so builder-input can render the layout-root (page-level) section too.
 */
export function ContainerSection({ nodeType, topLevel, container, defaults, disabled, onSet }: {
  nodeType: 'layout' | 'row' | 'column';
  topLevel: boolean;
  container: ContainerAttrs | undefined;
  /** The site defaults for THIS level only — the subset the renderer actually reads. */
  defaults: Partial<ContainerAttrs>;
  disabled?: boolean;
  onSet(key: ContainerKey, value: string | undefined): void;
}) {
  const [open, setOpen] = useState(false);
  const attrs = applicableContainerAttrs(nodeType, topLevel);
  if (attrs.length === 0) return null;
  const activeCount = attrs.filter((k) => container?.[k] != null).length;
  return (
    <Box data-press-container="">
      <Flex gap={1} alignItems="center">
        <IconButton label={open ? 'Hide layout options' : 'Show layout options'} variant="ghost" size="S"
          data-press-container-toggle="" onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown /> : <ChevronRight />}
        </IconButton>
        <Typography variant="pi" fontWeight="bold" textColor="neutral600">
          Layout options{activeCount ? ` · ${activeCount}` : ''}
        </Typography>
      </Flex>
      {open ? (
        <Flex direction="column" alignItems="stretch" gap={2} marginTop={2} paddingLeft={6}>
          {attrs.map((key) => (
            <Field.Root key={key} name={key}>
              <Field.Label>{containerFieldLabel(nodeType, key)}</Field.Label>
              <SingleSelect
                placeholder={`Site default · ${containerOptionLabel(key, defaults[key])}`}
                disabled={disabled}
                value={container?.[key] ?? undefined}
                onClear={() => onSet(key, undefined)}
                clearLabel="Use site default"
                onChange={(v) => onSet(key, v ? String(v) : undefined)}
              >
                {CONTAINER_ENUMS[key].map((opt) => (
                  <SingleSelectOption key={opt} value={opt}>{containerOptionLabel(key, opt)}</SingleSelectOption>
                ))}
              </SingleSelect>
            </Field.Root>
          ))}
        </Flex>
      ) : null}
    </Box>
  );
}

/** The palette + "Row" entry, an inline panel toggled by one button (no duplicate adder). */
function AddMenu({ ctx, parentPath, index, allowRow }: {
  ctx: TreeCtx;
  parentPath: NodePath | null;
  index: number;
  allowRow: boolean;
}) {
  const [open, setOpen] = useState(false);
  // ctx.schema is referentially stable across edits — memoized so every AddMenu
  // instance (one per column, plus top level) doesn't re-filter/re-sort the
  // whole palette on every keystroke anywhere in the tree.
  const groups = useMemo(() => paletteGroups(ctx.schema), [ctx.schema]);
  const add = (kind: string): void => {
    const node = kind === 'row' ? newRowNode() : newBlockNode(kind);
    ctx.onChange(insertNode(ctx.forest, parentPath, index, node));
    setOpen(false);
  };
  return (
    <Box data-press-add="">
      <Button
        variant="secondary"
        size="S"
        startIcon={<Plus />}
        disabled={ctx.disabled}
        data-press-add-trigger=""
        onClick={() => setOpen((o) => !o)}
      >
        Add block
      </Button>
      {open ? (
        <Box marginTop={1} padding={2} hasRadius background="neutral0" borderColor="neutral200" borderStyle="solid" borderWidth="1px" shadow="filterShadow">
          <Flex direction="column" alignItems="stretch" gap={1}>
            {allowRow ? (
              <Button variant="ghost" size="S" fullWidth startIcon={<ROW_ICON />} disabled={ctx.disabled}
                data-press-add-kind="row" onClick={() => add('row')}>Row · columns layout</Button>
            ) : null}
            {groups.map((g) => (
              <Box key={g.category} paddingTop={2}>
                <Typography variant="sigma" textColor="neutral600">{categoryLabel(g.category)}</Typography>
                <Flex direction="column" alignItems="stretch" gap={1} marginTop={1}>
                  {g.uids.map((uid) => {
                    const Icon = blockIcon(uid);
                    return (
                      <Button key={uid} variant="ghost" size="S" fullWidth startIcon={<Icon />} disabled={ctx.disabled}
                        data-press-add-uid={uid} onClick={() => add(uid)}>{blockLabel(uid)}</Button>
                    );
                  })}
                </Flex>
              </Box>
            ))}
          </Flex>
        </Box>
      ) : null}
    </Box>
  );
}

function EmptyHint() {
  return (
    <Box padding={4} hasRadius background="neutral100" borderColor="neutral300" borderStyle="dashed" borderWidth="1px">
      <Typography variant="pi" textColor="neutral500">No blocks yet — use “Add block” to place one.</Typography>
    </Box>
  );
}

function BlockCard({ node, path, ctx }: { node: BlockNode; path: NodePath; ctx: TreeCtx }) {
  const open = ctx.openIds.has(node.id);
  const Icon = blockIcon(node.component);
  const label = blockLabel(node.component);
  return (
    <Box data-press-node="block" hasRadius background="neutral0" borderColor="neutral200" borderStyle="solid" borderWidth="1px" shadow="tableShadow">
      <Flex justifyContent="space-between" alignItems="center" padding={2} gap={2}>
        <Flex gap={2} alignItems="center" minWidth={0}>
          <IconButton label={open ? `Collapse ${label}` : `Expand ${label}`} variant="ghost" size="S" onClick={() => ctx.toggleOpen(node.id)}>
            {open ? <ChevronDown /> : <ChevronRight />}
          </IconButton>
          <Icon />
          <Typography fontWeight="semiBold" ellipsis>{label}</Typography>
        </Flex>
        <NodeControls
          label={label}
          disabled={ctx.disabled}
          onUp={() => ctx.onChange(moveNode(ctx.forest, path, -1))}
          onDown={() => ctx.onChange(moveNode(ctx.forest, path, 1))}
          onRemove={() => ctx.onChange(removeNode(ctx.forest, path))}
        />
      </Flex>
      {open ? (
        <>
          <Divider />
          <Box padding={3}>
            <NodeForm componentUid={node.component} schema={ctx.schema} data={node.data} disabled={ctx.disabled}
              onChange={(data) => ctx.onChange(setBlockData(ctx.forest, path, data))} MediaField={ctx.MediaField} />
          </Box>
        </>
      ) : null}
    </Box>
  );
}

/** Per-column base/md/lg span selects — base required 1..12, md/lg clearable (inherit). */
function SpanControls({ column, columnPath, ctx }: { column: ColumnNode; columnPath: NodePath; ctx: TreeCtx }) {
  const set = (tier: Tier, value: number | undefined): void =>
    ctx.onChange(setColumnSpan(ctx.forest, columnPath, tier, value));
  return (
    <Flex gap={2} alignItems="flex-end" wrap="wrap" data-press-span="">
      <Field.Root name="span-base">
        <Field.Label>Base</Field.Label>
        <SingleSelect size="S" disabled={ctx.disabled} value={String(column.span.base)}
          onChange={(v) => set('base', Number(v))}>
          {SPAN_VALUES.map((n) => <SingleSelectOption key={n} value={String(n)}>{n}</SingleSelectOption>)}
        </SingleSelect>
      </Field.Root>
      <Field.Root name="span-md">
        <Field.Label>md</Field.Label>
        <SingleSelect size="S" placeholder="inherit" disabled={ctx.disabled}
          value={column.span.md !== undefined ? String(column.span.md) : undefined}
          onClear={() => set('md', undefined)} clearLabel="Inherit from base"
          onChange={(v) => set('md', v ? Number(v) : undefined)}>
          {SPAN_VALUES.map((n) => <SingleSelectOption key={n} value={String(n)}>{n}</SingleSelectOption>)}
        </SingleSelect>
      </Field.Root>
      <Field.Root name="span-lg">
        <Field.Label>lg</Field.Label>
        <SingleSelect size="S" placeholder="inherit" disabled={ctx.disabled}
          value={column.span.lg !== undefined ? String(column.span.lg) : undefined}
          onClear={() => set('lg', undefined)} clearLabel="Inherit from md"
          onChange={(v) => set('lg', v ? Number(v) : undefined)}>
          {SPAN_VALUES.map((n) => <SingleSelectOption key={n} value={String(n)}>{n}</SingleSelectOption>)}
        </SingleSelect>
      </Field.Root>
    </Flex>
  );
}

/** Read-only 12-track bar of each column's EFFECTIVE span at the active tier. */
function GridPreview({ columns, tier }: { columns: ColumnNode[]; tier: Tier }) {
  const spans = columns.map((c) => effectiveSpan(c.span, tier));
  const total = spans.reduce((a, b) => a + b, 0);
  const trailing = total < 12 ? 12 - total : 0; // fill; overflow (>12) wraps naturally
  return (
    <div data-press-grid-preview="" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2px' }}>
      {spans.map((n, i) => (
        <div key={i} style={{
          gridColumn: `span ${Math.max(1, Math.min(n, 12))}`,
          background: '#4945ff', color: '#fff', fontSize: '11px', lineHeight: '18px',
          textAlign: 'center', borderRadius: '2px',
        }}>{n}</div>
      ))}
      {trailing > 0 ? <div style={{ gridColumn: `span ${trailing}`, background: '#dcdce4', borderRadius: '2px' }} /> : null}
    </div>
  );
}

function ColumnCard({ column, columnPath, index, ctx }: { column: ColumnNode; columnPath: NodePath; index: number; ctx: TreeCtx }) {
  return (
    <Box data-press-node="column" hasRadius background="neutral0" borderColor="neutral200" borderStyle="solid" borderWidth="1px" padding={2}>
      <Flex justifyContent="space-between" alignItems="center">
        <Flex gap={2} alignItems="center">
          <COLUMN_ICON />
          <Typography variant="pi" fontWeight="bold" textColor="neutral700">Column {index + 1}</Typography>
        </Flex>
        <IconButton label={`Remove column ${index + 1}`} variant="ghost" size="S" disabled={ctx.disabled}
          onClick={() => ctx.onChange(removeNode(ctx.forest, columnPath))}><Trash /></IconButton>
      </Flex>
      <Box marginTop={2}>
        <SpanControls column={column} columnPath={columnPath} ctx={ctx} />
      </Box>
      <Box marginTop={2}>
        <ContainerSection nodeType="column" topLevel={false} container={column.container}
          defaults={ctx.layoutDefaults.column} disabled={ctx.disabled}
          onSet={(k, v) => ctx.onChange(setContainerAttr(ctx.forest, columnPath, k, v))} />
      </Box>
      <Box marginTop={2}>
        <TreeForest nodes={column.children} parentPath={columnPath} topLevel={false} ctx={ctx} />
      </Box>
    </Box>
  );
}

function RowCard({ node, path, topLevel, ctx }: { node: RowNode; path: NodePath; topLevel: boolean; ctx: TreeCtx }) {
  const open = ctx.openIds.has(node.id);
  const [tier, setTier] = useState<Tier>('base');
  const columnCount = node.children.length;
  const total = node.children.reduce((sum, c) => sum + effectiveSpan(c.span, tier), 0);
  return (
    <Box data-press-node="row" hasRadius background="primary100" borderColor="primary200" borderStyle="solid" borderWidth="1px" padding={2}>
      <Flex justifyContent="space-between" alignItems="center" gap={2} wrap="wrap">
        <Flex gap={2} alignItems="center" minWidth={0}>
          <IconButton label={open ? 'Collapse row' : 'Expand row'} variant="ghost" size="S" onClick={() => ctx.toggleOpen(node.id)}>
            {open ? <ChevronDown /> : <ChevronRight />}
          </IconButton>
          <ROW_ICON />
          <Typography fontWeight="bold" textColor="primary600">Row</Typography>
          {!open ? (
            <Typography variant="pi" textColor="neutral600">· {columnCount} column{columnCount === 1 ? '' : 's'}</Typography>
          ) : null}
        </Flex>
        <NodeControls
          label="row"
          disabled={ctx.disabled}
          onUp={() => ctx.onChange(moveNode(ctx.forest, path, -1))}
          onDown={() => ctx.onChange(moveNode(ctx.forest, path, 1))}
          onRemove={() => ctx.onChange(removeNode(ctx.forest, path))}
        />
      </Flex>
      {open ? (
        <>
          <Box marginTop={2}>
            <ContainerSection nodeType="row" topLevel={topLevel} container={node.container}
              defaults={ctx.layoutDefaults.row} disabled={ctx.disabled}
              onSet={(k, v) => ctx.onChange(setContainerAttr(ctx.forest, path, k, v))} />
          </Box>
          <Box marginTop={2} data-press-preview="">
            <Flex justifyContent="space-between" alignItems="center" marginBottom={2}>
              <Flex gap={1} tag="span" data-press-tier-toggle="">
                {TIERS.map((t) => (
                  <Button key={t} size="S" variant={t === tier ? 'secondary' : 'tertiary'} disabled={ctx.disabled}
                    aria-pressed={t === tier} data-press-tier={t} onClick={() => setTier(t)}>
                    {t === 'base' ? 'Base' : t}
                  </Button>
                ))}
              </Flex>
              <Typography variant="pi" fontWeight="bold" data-press-span-total=""
                textColor={total > 12 ? 'danger600' : 'neutral600'}>
                {tier} {total}/12
              </Typography>
            </Flex>
            <GridPreview columns={node.children} tier={tier} />
          </Box>
          <Flex direction="column" alignItems="stretch" gap={2} marginTop={2} data-press-columns="">
            {node.children.map((column, ci) => (
              <ColumnCard key={column.id} column={column} columnPath={[...path, ci]} index={ci} ctx={ctx} />
            ))}
            {columnCount < MAX_COLUMNS ? (
              <Box>
                <Button variant="tertiary" size="S" startIcon={<Plus />} disabled={ctx.disabled}
                  onClick={() => ctx.onChange(addColumn(ctx.forest, path))}>Add column</Button>
              </Box>
            ) : null}
          </Flex>
        </>
      ) : null}
    </Box>
  );
}

/** One slot's Node[] as cards, with the trailing Add palette. Recursion point for nesting. */
function TreeForest({ nodes, parentPath, topLevel, ctx }: {
  nodes: Forest;
  parentPath: NodePath | null;
  topLevel: boolean;
  ctx: TreeCtx;
}): JSX.Element {
  return (
    <Flex direction="column" alignItems="stretch" gap={2} data-press-forest="">
      {nodes.map((node, i) => {
        const path = [...(parentPath ?? []), i];
        if (node.type === 'block') return <BlockCard key={node.id} node={node} path={path} ctx={ctx} />;
        // node.type === 'row' (columns render inside it; tree-ops never yields a stray column).
        if (node.type === 'row') return <RowCard key={node.id} node={node} path={path} topLevel={topLevel} ctx={ctx} />;
        return null;
      })}
      {nodes.length === 0 ? <EmptyHint /> : null}
      <AddMenu ctx={ctx} parentPath={parentPath} index={nodes.length} allowRow />
    </Flex>
  );
}

export function TreeEditor({ forest, schema, disabled, onChange, MediaField }: TreeEditorProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const toggleOpen = (id: string): void =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // schema/forest are referentially stable except when actually reloaded/edited
  // — both are memoized so a collapse-toggle (openIds-only state) or an edit
  // elsewhere in the tree doesn't re-derive the site's layout defaults or
  // re-walk the whole forest for collapsible ids.
  const layoutDefaults = useMemo(() => layoutDefaultsOf(schema), [schema]);
  const collapsibleIds = useMemo(() => collectCollapsibleIds(forest), [forest]);
  const ctx: TreeCtx = {
    forest, schema, disabled, onChange, MediaField, openIds, toggleOpen, layoutDefaults,
  };
  const anyOpen = collapsibleIds.some((id) => openIds.has(id));

  return (
    <Flex direction="column" alignItems="stretch" gap={2}>
      {collapsibleIds.length > 1 ? (
        <Flex justifyContent="flex-end">
          <Button
            variant="tertiary"
            size="S"
            disabled={disabled}
            startIcon={anyOpen ? <ChevronRight /> : <ChevronDown />}
            onClick={() => setOpenIds(anyOpen ? new Set() : new Set(collapsibleIds))}
          >
            {anyOpen ? 'Collapse all' : 'Expand all'}
          </Button>
        </Flex>
      ) : null}
      <TreeForest nodes={forest} parentPath={null} topLevel ctx={ctx} />
    </Flex>
  );
}
