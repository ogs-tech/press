/**
 * Registry schema → form descriptors. This is the whole "forms are generated
 * from the schema catalog" mechanism (Spec §4): node-form.tsx renders from
 * these descriptors and nothing else, so a new block (preset or custom) gets a
 * working form with zero admin code. `preset-molecule.link` needs NO special
 * case — its `page` relation maps to the pageRef dropdown like any other.
 */
import {
  applicableContainerAttrs, parseUid, resolveLayoutDefaults,
  type Attr, type LayoutDefaults, type PressSchema,
} from '@ogs-tech/press-shared';

// Re-exported so admin call sites (tree-editor.tsx and this module's own tests)
// keep importing form/palette helpers from one place, while the single source of
// truth — shared by the Site Settings layout-defaults resolver too — lives in
// @ogs-tech/press-shared.
export { applicableContainerAttrs };

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

/** The site layout defaults the served schema carries — routed through the shared
 *  `resolveLayoutDefaults` sanitizer (not a bare `?? DEFAULT_LAYOUT`) so a partial or
 *  malformed payload degrades PER KEY, never handing out the shared const by reference,
 *  and an older cms that omits the key degrades identically everywhere. */
export const layoutDefaultsOf = (schema: PressSchema): LayoutDefaults => resolveLayoutDefaults(schema.layoutDefaults);

/**
 * Categories whose components are never PLACED as blocks (nested-only / settings /
 * descriptors) — applies to both owners: a `molecule`/`layout`/`template` category is
 * nested-only whether it's `preset-*` or `custom-*` (an adopter's `custom-molecule`
 * is exactly as un-placeable as `preset-molecule`); `config` only ever exists on the
 * preset side (an adopter has no `custom-config` category to exclude).
 */
const NON_PLACEABLE = /^preset-config$|^(preset|custom)-(molecule|layout|template)$/;

export function paletteGroups(schema: PressSchema): Array<{ category: string; uids: string[] }> {
  const byCategory = new Map<string, string[]>();
  for (const uid of Object.keys(schema.components ?? {})) {
    const { category } = parseUid(uid);
    if (NON_PLACEABLE.test(category)) continue;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(uid);
  }
  return [...byCategory.entries()]
    .map(([category, uids]) => ({ category, uids: uids.sort() }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
