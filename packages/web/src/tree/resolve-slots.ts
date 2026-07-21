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
import type { ContainerAttrs, Node, PressTree, Slot } from '@ogs-tech/press-shared';
import type { ResolvedPressConfig } from '../config/types';
import { resolveLink, type PressLinkData, type ResolvedLink } from '../link';

export interface ResolvedTree {
  header: Node[];
  children: Node[];
  footer: Node[];
  rootContainer?: ContainerAttrs;
}

type Brand = { name: string; logo?: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Engine blocks whose data carries ONE link field to resolve in place. */
const LINK_FIELDS: Record<string, string> = {
  'preset-atom.button': 'link',
  'preset-organism.hero': 'cta',
  'preset-organism.cta': 'button',
};

function hydrateBlockData(component: string, data: Record<string, unknown>, brand: Brand, homeSlug: string): Record<string, unknown> {
  if (component === 'preset-organism.navbar') {
    const items = Array.isArray(data.items) ? (data.items as PressLinkData[]) : [];
    const links = items
      .map((item) => resolveLink(item, homeSlug))
      .filter((link): link is ResolvedLink => link !== null);
    const rawCta = isRecord(data.cta) ? data.cta : undefined;
    const ctaLink = rawCta ? resolveLink(rawCta.link as PressLinkData, homeSlug) : null;
    return {
      ...data,
      brand: { name: brand.name, logo: brand.logo },
      links,
      cta: ctaLink ? { ...ctaLink, variant: rawCta?.variant } : null,
    };
  }
  if (component === 'preset-organism.footer') {
    return { ...data, brand: { name: brand.name } };
  }
  const linkField = LINK_FIELDS[component];
  if (linkField && data[linkField] !== undefined && data[linkField] !== null) {
    return { ...data, [linkField]: resolveLink(data[linkField] as PressLinkData, homeSlug) };
  }
  return data;
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
