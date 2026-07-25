/**
 * Registry schema → form descriptors. This is the whole "forms are generated
 * from the schema catalog" mechanism (Spec §4): node-form.tsx renders from
 * these descriptors and nothing else, so a new block (preset or custom) gets a
 * working form with zero admin code. `preset-molecule.link` needs NO special
 * case — its `page` relation maps to the pageRef dropdown like any other.
 */
import { resolveLayoutDefaults, type Attr, type ContainerKey, type LayoutDefaults, type PressSchema } from '@ogs-tech/press-shared';

export type FieldKind =
  | 'text' | 'textarea' | 'select' | 'checkbox' | 'number'
  | 'media' | 'pageRef' | 'component' | 'json';

export interface FieldDescriptor {
  name: string;
  kind: FieldKind;
  required: boolean;
  options?: string[];
  component?: string;
  repeatable?: boolean;
}

const PAGE_TARGET = 'plugin::press-cms.page';
const NUMBERS = new Set(['integer', 'biginteger', 'float', 'decimal']);

export function fieldsFor(attributes: Record<string, Attr>): FieldDescriptor[] {
  const out: FieldDescriptor[] = [];
  for (const [name, attr] of Object.entries(attributes ?? {})) {
    const base = { name, required: attr.required === true };
    switch (attr.type) {
      case 'string':
      case 'uid':
        out.push({ ...base, kind: 'text' });
        break;
      case 'text':
        out.push({ ...base, kind: 'textarea' });
        break;
      case 'enumeration':
        out.push({ ...base, kind: 'select', options: attr.enum ?? [] });
        break;
      case 'boolean':
        out.push({ ...base, kind: 'checkbox' });
        break;
      case 'media':
        out.push({ ...base, kind: 'media' });
        break;
      case 'relation':
        if ((attr as Record<string, unknown>).target === PAGE_TARGET) out.push({ ...base, kind: 'pageRef' });
        break;
      case 'component':
        if (typeof attr.component === 'string') {
          out.push({ ...base, kind: 'component', component: attr.component, repeatable: attr.repeatable === true });
        }
        break;
      case 'json':
        out.push({ ...base, kind: 'json' });
        break;
      default:
        if (attr.type && NUMBERS.has(attr.type)) out.push({ ...base, kind: 'number' });
        // anything else (password, dynamiczone, …) is not form-editable — skipped
    }
  }
  return out;
}

/** Which shared container attrs the form shows per node type (Spec §3: non-applicable attrs are hidden). */
export function applicableContainerAttrs(
  nodeType: 'layout' | 'row' | 'column',
  topLevel: boolean,
): ContainerKey[] {
  if (nodeType === 'layout') return ['gap'];
  if (nodeType === 'row') return topLevel ? ['width', 'gap', 'verticalAlign'] : ['gap', 'verticalAlign'];
  return ['gap', 'verticalAlign'];
}

/** The site layout defaults the served schema carries — routed through the shared
 *  `resolveLayoutDefaults` sanitizer (not a bare `?? DEFAULT_LAYOUT`) so a partial or
 *  malformed payload degrades PER KEY, never handing out the shared const by reference,
 *  and an older cms that omits the key degrades identically everywhere. */
export const layoutDefaultsOf = (schema: PressSchema): LayoutDefaults => resolveLayoutDefaults(schema.layoutDefaults);

/** Categories whose components are never PLACED as blocks (nested-only / settings / descriptors). */
const NON_PLACEABLE = /^preset-(molecule|config|layout|template)$/;

export function paletteGroups(schema: PressSchema): Array<{ category: string; uids: string[] }> {
  const byCategory = new Map<string, string[]>();
  for (const uid of Object.keys(schema.components ?? {})) {
    const category = uid.split('.')[0];
    if (NON_PLACEABLE.test(category)) continue;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(uid);
  }
  return [...byCategory.entries()]
    .map(([category, uids]) => ({ category, uids: uids.sort() }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
