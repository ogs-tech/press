/**
 * Runtime PressTree validator (Spec §3 "press-shared changes nature"): pure TS,
 * zero deps. Compiled into press-cms dist (save-time backstop) and consumed as
 * source by press-web (render-time guard).
 *
 * Contract: `value` is a SANITIZED deep copy — structural failures null it and
 * land in `errors`; invalid container-attr values are stripped and land in
 * `warnings` (attr-level failure never becomes tree-level, Spec §7); an unknown
 * slot mode degrades to `none` with a warning. Writers reject on errors OR
 * warnings (strict write); readers render whenever `value` is non-null
 * (tolerant read).
 */
import type { ColumnNode, ContainerAttrs, LayoutNode, Node, PressTree, RowNode, Slot } from './tree';
import { PRESS_TREE_VERSION } from './tree';

export interface TreeIssue {
  path: string;
  message: string;
}

export interface TreeResult<T> {
  value: T | null;
  errors: TreeIssue[];
  warnings: TreeIssue[];
}

export const MAX_ROW_COLUMNS = 4;

const RATIOS: readonly string[] = ['50-50', '33-67', '67-33', '33-33-33', '25-25-25-25'];
const WIDTHS: readonly string[] = ['prose', 'lg', 'full'];
const GAPS: readonly string[] = ['compact', 'normal', 'spacious'];
const VERTICAL_ALIGNS: readonly string[] = ['top', 'center', 'bottom'];

interface Ctx {
  errors: TreeIssue[];
  warnings: TreeIssue[];
}

const fail = (ctx: Ctx, path: string, message: string): null => {
  ctx.errors.push({ path, message });
  return null;
};

const warn = (ctx: Ctx, path: string, message: string): void => {
  ctx.warnings.push({ path, message });
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function sanitizeContainer(input: unknown, path: string, ctx: Ctx): ContainerAttrs | undefined {
  if (input === undefined || input === null) return undefined;
  if (!isRecord(input)) {
    warn(ctx, path, 'container must be an object — ignored');
    return undefined;
  }
  const out: ContainerAttrs = {};
  const pick = (key: keyof ContainerAttrs, allowed: readonly string[]): void => {
    const v = input[key];
    if (v === undefined) return;
    if (typeof v === 'string' && allowed.includes(v)) {
      (out as Record<string, unknown>)[key] = v;
    } else {
      warn(ctx, `${path}.${key}`, `invalid value ${JSON.stringify(v)} — attribute dropped`);
    }
  };
  pick('width', WIDTHS);
  pick('gap', GAPS);
  pick('verticalAlign', VERTICAL_ALIGNS);
  return Object.keys(out).length > 0 ? out : undefined;
}

function requireId(input: Record<string, unknown>, path: string, ctx: Ctx): string | null {
  if (typeof input.id !== 'string' || input.id.length === 0) {
    return fail(ctx, `${path}.id`, 'node id must be a non-empty string');
  }
  return input.id;
}

function validateColumn(input: unknown, path: string, ctx: Ctx): ColumnNode | null {
  if (!isRecord(input) || input.type !== 'column') {
    return fail(ctx, path, `row children must be column nodes, got ${JSON.stringify(isRecord(input) ? input.type : input)}`);
  }
  const id = requireId(input, path, ctx);
  if (id === null) return null;
  const children = validateChildren(input.children, `${path}.children`, ctx);
  if (children === null) return null;
  const node: ColumnNode = { id, type: 'column', children };
  const container = sanitizeContainer(input.container, `${path}.container`, ctx);
  if (container) node.container = container;
  return node;
}

/** A generic children position (layout root / column) admits block | row only. */
function validateChildren(input: unknown, path: string, ctx: Ctx): Node[] | null {
  if (!Array.isArray(input)) return fail(ctx, path, 'children must be an array');
  const out: Node[] = [];
  input.forEach((child, i) => {
    const node = validateNode(child, `${path}[${i}]`, ctx);
    if (node) out.push(node);
  });
  return out;
}

function validateNode(input: unknown, path: string, ctx: Ctx): Node | null {
  if (!isRecord(input)) return fail(ctx, path, 'node must be an object');
  switch (input.type) {
    case 'block': {
      const id = requireId(input, path, ctx);
      if (id === null) return null;
      if (typeof input.component !== 'string' || input.component.length === 0) {
        return fail(ctx, `${path}.component`, 'block component must be a non-empty palette uid');
      }
      let data: Record<string, unknown> = {};
      if (input.data === undefined) {
        // tolerated: an attribute-less block (bare navbar seed)
      } else if (isRecord(input.data)) {
        data = structuredClone(input.data) as Record<string, unknown>;
      } else {
        warn(ctx, `${path}.data`, 'block data must be an object — reset to {}');
      }
      return { id, type: 'block', component: input.component, data };
    }
    case 'row': {
      const id = requireId(input, path, ctx);
      if (id === null) return null;
      if (typeof input.ratio !== 'string' || !RATIOS.includes(input.ratio)) {
        return fail(ctx, `${path}.ratio`, `ratio must be one of ${RATIOS.join(' | ')}`);
      }
      if (!Array.isArray(input.children)) {
        return fail(ctx, `${path}.children`, 'row children must be an array of columns');
      }
      if (input.children.length < 1 || input.children.length > MAX_ROW_COLUMNS) {
        return fail(ctx, `${path}.children`, `a row carries 1–${MAX_ROW_COLUMNS} columns, got ${input.children.length}`);
      }
      const columns: ColumnNode[] = [];
      input.children.forEach((c, i) => {
        const col = validateColumn(c, `${path}.children[${i}]`, ctx);
        if (col) columns.push(col);
      });
      const node: RowNode = { id, type: 'row', ratio: input.ratio as RowNode['ratio'], children: columns };
      const container = sanitizeContainer(input.container, `${path}.container`, ctx);
      if (container) node.container = container;
      return node;
    }
    case 'column':
      return fail(ctx, path, 'a column node is only legal directly under a row');
    default:
      return fail(ctx, `${path}.type`, `unknown node type ${JSON.stringify(input.type)}`);
  }
}

function validateSlot(input: unknown, path: string, ctx: Ctx): Slot {
  if (!isRecord(input)) {
    warn(ctx, path, 'slot must be an object — treated as none');
    return { mode: 'none' };
  }
  if (input.mode === 'inherit') return { mode: 'inherit' };
  if (input.mode === 'none') return { mode: 'none' };
  if (input.mode === 'custom') {
    const children = validateChildren(input.children, `${path}.children`, ctx);
    return { mode: 'custom', children: children ?? [] };
  }
  warn(ctx, `${path}.mode`, `unknown slot mode ${JSON.stringify(input.mode)} — treated as none`);
  return { mode: 'none' };
}

export function validatePressTree(input: unknown): TreeResult<PressTree> {
  const ctx: Ctx = { errors: [], warnings: [] };
  if (!isRecord(input)) {
    return { value: null, errors: [{ path: '$', message: 'tree must be an object' }], warnings: [] };
  }
  if (input.version !== PRESS_TREE_VERSION) {
    return {
      value: null,
      errors: [{ path: '$.version', message: `unsupported tree version ${JSON.stringify(input.version)} (expected ${PRESS_TREE_VERSION})` }],
      warnings: [],
    };
  }
  const root = input.root;
  if (!isRecord(root) || root.type !== 'layout') {
    return { value: null, errors: [{ path: '$.root', message: "root must be a node of type 'layout'" }], warnings: ctx.warnings };
  }
  const header = validateSlot(root.header, '$.root.header', ctx);
  const footer = validateSlot(root.footer, '$.root.footer', ctx);
  const children = validateChildren(root.children, '$.root.children', ctx) ?? [];
  const layout: LayoutNode = { type: 'layout', header, footer, children };
  const container = sanitizeContainer(root.container, '$.root.container', ctx);
  if (container) layout.container = container;
  return {
    value: ctx.errors.length === 0 ? { version: PRESS_TREE_VERSION, root: layout } : null,
    errors: ctx.errors,
    warnings: ctx.warnings,
  };
}

/** Validates a bare Node[] — the shape of one Site Settings pageDefaults slot. */
export function validateNodeArray(input: unknown): TreeResult<Node[]> {
  const ctx: Ctx = { errors: [], warnings: [] };
  const nodes = validateChildren(input, '$', ctx);
  return { value: ctx.errors.length === 0 ? nodes : null, errors: ctx.errors, warnings: ctx.warnings };
}
