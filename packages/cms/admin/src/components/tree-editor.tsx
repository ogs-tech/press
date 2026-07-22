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
import { useState } from 'react';
import type { JSX } from 'react'; // @types/react 19 removed the global JSX namespace
import {
  Box, Button, Divider, Field, Flex, IconButton, SingleSelect, SingleSelectOption, Typography,
} from '@strapi/design-system';
import {
  ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash,
} from '@strapi/icons';
import type {
  BlockNode, ColumnNode, PressSchema, Ratio, RowNode,
} from '@ogs-tech/press-shared';
import { applicableContainerAttrs, paletteGroups } from '../lib/form-model';
import {
  blockIcon, blockLabel, categoryLabel, COLUMN_ICON, fieldLabel, ROW_ICON,
} from '../lib/palette-labels';
import {
  addColumn, insertNode, MAX_COLUMNS, moveNode, newBlockNode, newRowNode,
  removeNode, setBlockData, setContainerAttr, setRowRatio, type Forest, type NodePath,
} from '../lib/tree-ops';
import { NodeForm } from './node-form';

const RATIOS: Ratio[] = ['50-50', '33-67', '67-33', '33-33-33', '25-25-25-25'];
const CONTAINER_OPTIONS: Record<'width' | 'gap' | 'verticalAlign', string[]> = {
  width: ['prose', 'lg', 'full'],
  gap: ['compact', 'normal', 'spacious'],
  verticalAlign: ['top', 'center', 'bottom'],
};

type MediaFieldComponent = Parameters<typeof NodeForm>[0]['MediaField'];

/** Everything a card needs, threaded once through the tree instead of per prop. */
interface TreeCtx {
  forest: Forest;
  schema: PressSchema;
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

/** Collapsible "Layout options" — the shared container attrs applicable to this node. */
function ContainerSection({ nodeType, topLevel, container, disabled, onSet }: {
  nodeType: 'row' | 'column';
  topLevel: boolean;
  container: Record<string, unknown> | undefined;
  disabled?: boolean;
  onSet(key: 'width' | 'gap' | 'verticalAlign', value: string | undefined): void;
}) {
  const [open, setOpen] = useState(false);
  const attrs = applicableContainerAttrs(nodeType, topLevel);
  if (attrs.length === 0) return null;
  const activeCount = attrs.filter((k) => container?.[k] != null).length;
  return (
    <Box data-press-container="">
      <Flex gap={1} alignItems="center">
        <IconButton label={open ? 'Hide layout options' : 'Show layout options'} variant="ghost" size="S" onClick={() => setOpen((o) => !o)}>
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
              <Field.Label>{fieldLabel(key)}</Field.Label>
              <SingleSelect
                placeholder="engine default"
                disabled={disabled}
                value={(container?.[key] as string) ?? undefined}
                onClear={() => onSet(key, undefined)}
                clearLabel="Reset to engine default"
                onChange={(v) => onSet(key, v ? String(v) : undefined)}
              >
                {CONTAINER_OPTIONS[key].map((opt) => <SingleSelectOption key={opt} value={opt}>{opt}</SingleSelectOption>)}
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
  const groups = paletteGroups(ctx.schema);
  const add = (kind: string): void => {
    const node = kind === 'row' ? newRowNode('50-50') : newBlockNode(kind);
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
        <ContainerSection nodeType="column" topLevel={false} container={column.container as Record<string, unknown> | undefined}
          disabled={ctx.disabled} onSet={(k, v) => ctx.onChange(setContainerAttr(ctx.forest, columnPath, k, v))} />
      </Box>
      <Box marginTop={2}>
        <TreeForest nodes={column.children} parentPath={columnPath} topLevel={false} ctx={ctx} />
      </Box>
    </Box>
  );
}

function RowCard({ node, path, topLevel, ctx }: { node: RowNode; path: NodePath; topLevel: boolean; ctx: TreeCtx }) {
  const open = ctx.openIds.has(node.id);
  const columnCount = node.children.length;
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
        <Flex gap={2} alignItems="center">
          <SingleSelect aria-label="Row ratio" size="S" value={node.ratio} disabled={ctx.disabled}
            onChange={(v) => ctx.onChange(setRowRatio(ctx.forest, path, v as Ratio))}>
            {RATIOS.map((r) => <SingleSelectOption key={r} value={r}>{r}</SingleSelectOption>)}
          </SingleSelect>
          <NodeControls
            label="row"
            disabled={ctx.disabled}
            onUp={() => ctx.onChange(moveNode(ctx.forest, path, -1))}
            onDown={() => ctx.onChange(moveNode(ctx.forest, path, 1))}
            onRemove={() => ctx.onChange(removeNode(ctx.forest, path))}
          />
        </Flex>
      </Flex>
      {open ? (
        <>
          <Box marginTop={2}>
            <ContainerSection nodeType="row" topLevel={topLevel} container={node.container as Record<string, unknown> | undefined}
              disabled={ctx.disabled} onSet={(k, v) => ctx.onChange(setContainerAttr(ctx.forest, path, k, v))} />
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
  const ctx: TreeCtx = { forest, schema, disabled, onChange, MediaField, openIds, toggleOpen };
  const collapsibleIds = collectCollapsibleIds(forest);
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
