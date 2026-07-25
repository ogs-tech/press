/**
 * Site-level layout defaults (layout-defaults spec §3) — the fallbacks the web
 * pickers used to hardcode (`attrs?.width ?? 'lg'`, …), promoted to a CMS-owned
 * contract so a site's baseline rhythm is an editorial decision, not an engine
 * edit + redeploy.
 *
 * ONE GROUP PER TREE LEVEL, not one shared group: `gap` is two different
 * physical axes — space BETWEEN columns on a row (`--press-grid-gap`) versus
 * vertical rhythm WITHIN a page/column stack (`--press-tree-gap` /
 * `--press-cell-gap`). A single field would force one label onto both, and
 * setting it would silently flip every column cell from per-block margins to
 * flex stacking.
 *
 * Lives here, not in web, because the cms (serving the builder's payload) and
 * web (rendering) must resolve the SAME value — the `validate-tree` precedent:
 * one shared implementation both sides import.
 */
import type { ContainerAttrs, ContainerKey } from './tree';
import { CONTAINER_ENUMS } from './validate-tree';

/** Each level carries the SUBSET of ContainerAttrs that actually applies there
 *  (tree design §3: a non-applicable attr is ignored by the renderer and hidden
 *  by the builder form — here it is absent from the type outright, so the CMS
 *  can never grow a field the renderer would ignore). */
export interface LayoutDefaults {
  page: Pick<ContainerAttrs, 'gap'>;
  row: ContainerAttrs;
  column: Pick<ContainerAttrs, 'gap' | 'verticalAlign'>;
}

/** The engine baseline. An ABSENT `gap` on page/column is meaningful, not a
 *  hole: the renderer emits no stack attribute and legacy per-block margins
 *  apply — which is also why there is no enum member meaning "no stack". */
export const DEFAULT_LAYOUT: LayoutDefaults = {
  page: {},
  row: { width: 'lg', gap: 'normal', verticalAlign: 'top' },
  column: { verticalAlign: 'top' },
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Which keys each level admits — the type's `Pick`s, as data. */
const LEVEL_KEYS: Record<keyof LayoutDefaults, readonly ContainerKey[]> = {
  page: ['gap'],
  row: ['width', 'gap', 'verticalAlign'],
  column: ['gap', 'verticalAlign'],
};

/**
 * CMS shape → a TOTAL LayoutDefaults. Sanitizing and never throwing: an absent
 * group, a `null` value (an unset Strapi enum), a wrong type, or an unknown enum
 * member all fall back to the engine default for THAT KEY — the validate-tree
 * discipline, where an attr-level failure is never a document-level failure.
 * Always returns a fresh object, so DEFAULT_LAYOUT is never handed out for
 * mutation.
 */
export function resolveLayoutDefaults(raw: unknown): LayoutDefaults {
  const source = isRecord(raw) ? raw : {};
  const level = <L extends keyof LayoutDefaults>(name: L): LayoutDefaults[L] => {
    const group = isRecord(source[name]) ? (source[name] as Record<string, unknown>) : {};
    const out: Record<string, string> = { ...(DEFAULT_LAYOUT[name] as Record<string, string>) };
    for (const key of LEVEL_KEYS[name]) {
      const value = group[key];
      if (typeof value === 'string' && CONTAINER_ENUMS[key].includes(value)) out[key] = value;
    }
    return out as LayoutDefaults[L];
  };
  return { page: level('page'), row: level('row'), column: level('column') };
}
