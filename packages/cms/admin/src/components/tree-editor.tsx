/**
 * Structural tree editor (Spec §4 v1): collapsible nodes, add/remove/reorder
 * via buttons, per-node forms. All mutations go through tree-ops, so the
 * structural invariants hold by construction.
 */
import { useState } from 'react';
import type { PressSchema, Ratio } from '@ogs-tech/press-shared';
import { applicableContainerAttrs, paletteGroups } from '../lib/form-model';
import {
  addColumn, insertNode, moveNode, newBlockNode, newRowNode, removeNode,
  setBlockData, setContainerAttr, setRowRatio, type Forest, type NodePath,
} from '../lib/tree-ops';
import { NodeForm } from './node-form';

const RATIOS: Ratio[] = ['50-50', '33-67', '67-33', '33-33-33', '25-25-25-25'];
const CONTAINER_OPTIONS: Record<'width' | 'gap' | 'verticalAlign', string[]> = {
  width: ['prose', 'lg', 'full'],
  gap: ['compact', 'normal', 'spacious'],
  verticalAlign: ['top', 'center', 'bottom'],
};

export interface TreeEditorProps {
  forest: Forest;
  schema: PressSchema;
  disabled?: boolean;
  onChange(forest: Forest): void;
  MediaField: Parameters<typeof NodeForm>[0]['MediaField'];
}

function AddControls({ schema, disabled, onAdd }: { schema: PressSchema; disabled?: boolean; onAdd(kind: string): void }) {
  const [pick, setPick] = useState('');
  const groups = paletteGroups(schema);
  return (
    <div data-press-add="">
      <select aria-label="Add node" disabled={disabled} value={pick} onChange={(e) => setPick(e.target.value)}>
        <option value="">Add…</option>
        <option value="row">Row (columns layout)</option>
        {groups.map((g) => (
          <optgroup key={g.category} label={g.category}>
            {g.uids.map((uid) => <option key={uid} value={uid}>{uid.split('.')[1]}</option>)}
          </optgroup>
        ))}
      </select>
      <button type="button" disabled={disabled || !pick} onClick={() => { onAdd(pick); setPick(''); }}>Add</button>
    </div>
  );
}

function ContainerSection({ nodeType, topLevel, container, disabled, onSet }: {
  nodeType: 'row' | 'column';
  topLevel: boolean;
  container: Record<string, unknown> | undefined;
  disabled?: boolean;
  onSet(key: 'width' | 'gap' | 'verticalAlign', value: string | undefined): void;
}) {
  const attrs = applicableContainerAttrs(nodeType, topLevel);
  return (
    <fieldset data-press-container="">
      <legend>Container</legend>
      {attrs.map((key) => (
        <label key={key}>
          {key}
          <select disabled={disabled} value={(container?.[key] as string) ?? ''} onChange={(e) => onSet(key, e.target.value || undefined)}>
            <option value="">engine default</option>
            {CONTAINER_OPTIONS[key].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </label>
      ))}
    </fieldset>
  );
}

export function TreeEditor({ forest, schema, disabled, onChange, MediaField }: TreeEditorProps) {
  const add = (parentPath: NodePath | null, index: number, kind: string): void => {
    const node = kind === 'row' ? newRowNode('50-50') : newBlockNode(kind);
    onChange(insertNode(forest, parentPath, index, node));
  };

  const renderForest = (nodes: Forest, parentPath: NodePath | null, topLevel: boolean): JSX.Element => (
    <div data-press-forest="">
      {nodes.map((node, i) => {
        const path = [...(parentPath ?? []), i];
        const key = node.id;
        const controls = (
          <span data-press-controls="">
            <button type="button" aria-label={`Move up ${key}`} disabled={disabled} onClick={() => onChange(moveNode(forest, path, -1))}>↑</button>
            <button type="button" aria-label={`Move down ${key}`} disabled={disabled} onClick={() => onChange(moveNode(forest, path, 1))}>↓</button>
            <button type="button" aria-label={`Remove ${key}`} disabled={disabled} onClick={() => onChange(removeNode(forest, path))}>✕</button>
          </span>
        );
        if (node.type === 'block') {
          return (
            <details key={key} data-press-node="block">
              <summary>{node.component} {controls}</summary>
              <NodeForm componentUid={node.component} schema={schema} data={node.data} disabled={disabled}
                onChange={(data) => onChange(setBlockData(forest, path, data))} MediaField={MediaField} />
            </details>
          );
        }
        // node.type === 'row' (columns render inside it; tree-ops never yields a stray column).
        // The guard narrows Node → RowNode for the compiler — a bare column in a
        // forest is unreachable by construction, so it renders nothing.
        if (node.type !== 'row') return null;
        return (
          <details key={key} data-press-node="row" open>
            <summary>Row · {node.ratio} {controls}</summary>
            <label>
              ratio
              <select disabled={disabled} value={node.ratio} onChange={(e) => onChange(setRowRatio(forest, path, e.target.value as Ratio))}>
                {RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <ContainerSection nodeType="row" topLevel={topLevel} container={node.container as Record<string, unknown> | undefined}
              disabled={disabled} onSet={(k, v) => onChange(setContainerAttr(forest, path, k, v))} />
            <div data-press-columns="">
              {node.children.map((column, ci) => {
                const columnPath = [...path, ci];
                return (
                  <fieldset key={column.id} data-press-node="column">
                    <legend>
                      Column {ci + 1}
                      <button type="button" aria-label={`Remove ${column.id}`} disabled={disabled} onClick={() => onChange(removeNode(forest, columnPath))}>✕</button>
                    </legend>
                    <ContainerSection nodeType="column" topLevel={false} container={column.container as Record<string, unknown> | undefined}
                      disabled={disabled} onSet={(k, v) => onChange(setContainerAttr(forest, columnPath, k, v))} />
                    {renderForest(column.children, columnPath, false)}
                    <AddControls schema={schema} disabled={disabled} onAdd={(kind) => add(columnPath, column.children.length, kind)} />
                  </fieldset>
                );
              })}
              <button type="button" disabled={disabled} onClick={() => onChange(addColumn(forest, path))}>Add column</button>
            </div>
          </details>
        );
      })}
      <AddControls schema={schema} disabled={disabled} onAdd={(kind) => add(parentPath, nodes.length, kind)} />
    </div>
  );

  return renderForest(forest, null, true);
}
