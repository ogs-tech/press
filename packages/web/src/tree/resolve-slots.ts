/**
 * Slot resolution + engine-block hydration — the ONE hydration point (Spec §5/§6).
 * `inherit` resolves against Site Settings pageDefaults at render (ISR ~60s:
 * editing the default header updates every inheriting page, no redeploy);
 * `none` is a bare page; `custom` is page-owned chrome. All three lists — and
 * the body — then get engine blocks hydrated WHEREVER they sit: navbar/footer
 * gain brand (identity is never stored on a block), and every engine link
 * field resolves with the homeSlug collapse. The engine names only its OWN
 * blocks here — adopter data passes through untouched (custom blocks render
 * links via <PressLink> themselves).
 */
import { isRecord, type ContainerAttrs, type Node, type PressTree, type Slot } from '@ogs-tech/press-shared';
import type { ResolvedPressConfig } from '../config/types';
import { resolveLink, type PressLinkData, type ResolvedLink } from '../link';

export interface ResolvedTree {
  header: Node[];
  children: Node[];
  footer: Node[];
  rootContainer?: ContainerAttrs;
}

type Brand = { name: string; logo?: string };

/**
 * A single link field to resolve on an engine block's data, declaratively —
 * covers every shape LINK_FIELDS below needs, so no component gets its own
 * hardcoded hydration branch:
 *  - a plain field (`{ field: 'link' }`): resolved only when present, in place.
 *  - `array`: the field is a `preset-molecule.link[]` (navbar `items`) — always
 *    resolved to a (possibly empty) array of successfully-resolved links.
 *  - `via`: the field is a NESTED component wrapping the real link one level
 *    down (navbar `cta` is a `preset-atom.button`, whose link lives at
 *    `cta.link`) — always resolved, `null` when absent, preserving the
 *    wrapper's other own keys (e.g. `variant`).
 */
interface LinkFieldSpec {
  field: string;
  array?: boolean;
  via?: string;
  /** Output key, when it differs from `field` (navbar's `items` → `links`). */
  outputField?: string;
}

const LINK_FIELDS: Record<string, LinkFieldSpec[]> = {
  'preset-atom.button': [{ field: 'link' }],
  'preset-organism.hero': [{ field: 'cta' }],
  'preset-organism.cta': [{ field: 'button' }],
  'preset-organism.navbar': [
    { field: 'items', array: true, outputField: 'links' },
    { field: 'cta', via: 'link' },
  ],
};

function resolveLinkField(data: Record<string, unknown>, spec: LinkFieldSpec, homeSlug: string): [string, unknown] | null {
  const raw = data[spec.field];
  const outKey = spec.outputField ?? spec.field;
  if (spec.array) {
    const items = Array.isArray(raw) ? (raw as PressLinkData[]) : [];
    const links = items.map((item) => resolveLink(item, homeSlug)).filter((link): link is ResolvedLink => link !== null);
    return [outKey, links];
  }
  if (spec.via) {
    const wrapper = isRecord(raw) ? raw : undefined;
    const link = wrapper ? resolveLink(wrapper[spec.via] as PressLinkData, homeSlug) : null;
    return [outKey, link ? { ...link, variant: wrapper?.variant } : null];
  }
  if (raw === undefined || raw === null) return null; // single link fields: only overwritten when present
  return [outKey, resolveLink(raw as PressLinkData, homeSlug)];
}

function hydrateBlockData(component: string, data: Record<string, unknown>, brand: Brand, homeSlug: string): Record<string, unknown> {
  let out = data;
  for (const spec of LINK_FIELDS[component] ?? []) {
    const resolved = resolveLinkField(data, spec, homeSlug);
    if (resolved) out = { ...out, [resolved[0]]: resolved[1] };
  }
  // Brand has no source field in the schema at all — pure code-side injection,
  // so it stays an explicit per-component step rather than folding into LINK_FIELDS.
  if (component === 'preset-organism.navbar') out = { ...out, brand: { name: brand.name, logo: brand.logo } };
  else if (component === 'preset-organism.footer') out = { ...out, brand: { name: brand.name } };
  return out;
}

export function hydrateEngineBlocks(nodes: Node[], brand: Brand, homeSlug: string): Node[] {
  return nodes.map((node) => {
    if (node.type === 'block') {
      return { ...node, data: hydrateBlockData(node.component, node.data, brand, homeSlug) };
    }
    return { ...node, children: hydrateEngineBlocks(node.children as Node[], brand, homeSlug) } as Node;
  });
}

function slotNodes(slot: Slot, defaults: Node[]): Node[] {
  if (slot.mode === 'inherit') return defaults;
  if (slot.mode === 'custom') return slot.children;
  return [];
}

export function resolveTree(tree: PressTree, site: ResolvedPressConfig): ResolvedTree {
  const brand: Brand = { name: site.brand.name, logo: site.brand.logo };
  const homeSlug = site.routes.home;
  const hydrate = (nodes: Node[]): Node[] => hydrateEngineBlocks(nodes, brand, homeSlug);
  return {
    header: hydrate(slotNodes(tree.root.header, site.pageDefaults.header)),
    children: hydrate(tree.root.children),
    footer: hydrate(slotNodes(tree.root.footer, site.pageDefaults.footer)),
    rootContainer: tree.root.container,
  };
}
