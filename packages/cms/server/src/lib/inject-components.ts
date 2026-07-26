import type { Core } from '@strapi/strapi';
import paragraphSchema from '../components/atoms/paragraph.json';
import headingSchema from '../components/atoms/heading.json';
import listSchema from '../components/atoms/list.json';
import quoteSchema from '../components/atoms/quote.json';
import imageSchema from '../components/atoms/image.json';
import buttonSchema from '../components/atoms/button.json';
import separatorSchema from '../components/atoms/separator.json';
import spacerSchema from '../components/atoms/spacer.json';
import linkSchema from '../components/molecules/link.json';
import heroSchema from '../components/organisms/hero.json';
import ctaSchema from '../components/organisms/cta.json';
import navbarSchema from '../components/organisms/navbar.json';
import footerSchema from '../components/organisms/footer.json';
import layoutContainerSchema from '../components/layout/container.json';
import layoutRowSchema from '../components/layout/row.json';
import layoutColumnSchema from '../components/layout/column.json';
import themeAdvancedSchema from '../components/config/theme-advanced.json';
import basicSettingsSchema from '../components/config/basic-settings.json';
import layoutDefaultsPageSchema from '../components/config/layout-page.json';
import layoutDefaultsRowSchema from '../components/config/layout-row.json';
import layoutDefaultsColumnSchema from '../components/config/layout-column.json';
import layoutDefaultsSchema from '../components/config/layout.json';
import { toGlobalId } from './global-id';

/**
 * The Atomic Design layers of the engine's PRESET palette. Every preset component
 * registers under the category `preset-${layer}`, so its uid reads
 * `preset-${layer}.${name}` (e.g. `preset-atom.heading`, `preset-organism.navbar`).
 * Declaring the layers here is the single source of truth for the palette's shape
 * — categories are never spelled as ad-hoc string literals scattered across files.
 *
 * `template` is RESERVED — no components ship in this task:
 *   - `template` ← installed by plugins (e.g. Site/Plugin for Company).
 * It is declared so the model is complete and picker labels are ready.
 * `layout` is no longer reserved: `preset-layout.container/row/column` are the
 * composition-tree node descriptors (Spec §4) the admin builder drives its
 * layout-node forms from.
 */
export const PRESET_LAYERS = ['atom', 'molecule', 'organism', 'config', 'layout', 'template'] as const;
export type PresetLayer = (typeof PRESET_LAYERS)[number];

/**
 * Adopter (CUSTOM) layers mirror the preset content layers, minus the engine-only
 * `config`. An adopter drops a component under `src/components/custom-${layer}/`;
 * Strapi derives the `custom-${layer}` category from that folder name. Unlike
 * preset, placement is NOT a category concern on the custom side — every custom
 * block is discovered straight from the components registry (`custom-*` category
 * prefix, see `isCustomBlockUid`) by the builder palette and `serialize-schema`;
 * the editor decides placement in the composition tree.
 */
export const CUSTOM_LAYERS = ['atom', 'molecule', 'organism', 'layout', 'template'] as const;
export type CustomLayer = (typeof CUSTOM_LAYERS)[number];

/**
 * Engine-shipped components, grouped by Atomic Design layer.
 *
 * Strapi only scans the host APP's `src/components` directory; there is no
 * declarative plugin-component API. To ship the preset palette from the engine
 * (`@ogs-tech/press-cms` in `node_modules`) we inject these into the components
 * registry during the plugin `register` lifecycle.
 *
 * Boot order (see @strapi/core/dist/Strapi.js `load`):
 *   1. providers.register  -> loadApplicationContext (app components AND plugin
 *      content-types loaded in parallel; module.load() registers CTs before register)
 *   2. plugins REGISTER     -> THIS hook (inject the preset-* palette). Custom blocks
 *      are never "admitted" anywhere — the builder palette and `serialize-schema`
 *      discover them straight from the components registry (the `custom-*` category
 *      prefix stays the whole extension-point contract).
 *   3. bootstrap            -> transformContentTypesToModels([...contentTypes, ...components])
 *
 * The injected object mirrors the exact shape produced by Strapi's own loader
 * (@strapi/core/dist/loaders/components.js): the raw schema plus
 * { __schema__, uid, category, modelType, modelName, globalId }.
 */
const ENGINE_COMPONENTS: Array<{ layer: PresetLayer; name: string; schema: Record<string, unknown> }> = [
  // Atoms — the atomic content palette: text, media, and structural blocks.
  { layer: 'atom', name: 'paragraph', schema: paragraphSchema as Record<string, unknown> },
  { layer: 'atom', name: 'heading', schema: headingSchema as Record<string, unknown> },
  { layer: 'atom', name: 'list', schema: listSchema as Record<string, unknown> },
  { layer: 'atom', name: 'quote', schema: quoteSchema as Record<string, unknown> },
  { layer: 'atom', name: 'image', schema: imageSchema as Record<string, unknown> },
  { layer: 'atom', name: 'button', schema: buttonSchema as Record<string, unknown> },
  { layer: 'atom', name: 'separator', schema: separatorSchema as Record<string, unknown> },
  { layer: 'atom', name: 'spacer', schema: spacerSchema as Record<string, unknown> },
  // Molecules — small composed units nested inside organisms (e.g. a navbar's links).
  { layer: 'molecule', name: 'link', schema: linkSchema as Record<string, unknown> },
  // Organisms — composed sections for the page body (hero/cta) and the site chrome
  // (navbar/footer). One unified layer (the old section.*/chrome.* palettes); the
  // placement split (body vs header/footer) is declared per content-type
  // schema.json, never by the category. The bar's internal layout is renderer-owned
  // so editors cannot break the chrome.
  { layer: 'organism', name: 'hero', schema: heroSchema as Record<string, unknown> },
  { layer: 'organism', name: 'cta', schema: ctaSchema as Record<string, unknown> },
  { layer: 'organism', name: 'navbar', schema: navbarSchema as Record<string, unknown> },
  { layer: 'organism', name: 'footer', schema: footerSchema as Record<string, unknown> },
  // Layout — the tree-node descriptors (Spec §4): pure schema for the builder's
  // layout-node forms. `preset-layout.container` is the shared ContainerAttrs
  // surface, referenced by row/column via `component:` fields (the link/nav-item
  // nesting pattern) so the "Container" form section is defined exactly once.
  { layer: 'layout', name: 'container', schema: layoutContainerSchema as Record<string, unknown> },
  { layer: 'layout', name: 'row', schema: layoutRowSchema as Record<string, unknown> },
  { layer: 'layout', name: 'column', schema: layoutColumnSchema as Record<string, unknown> },
  // Config — non-block settings referenced by the Site Settings single type,
  // behaving like a settings form. Injected like the rest but never admitted
  // into a Dynamic Zone. Nested child first: `basic-settings` references it.
  { layer: 'config', name: 'theme-advanced', schema: themeAdvancedSchema as Record<string, unknown> },
  { layer: 'config', name: 'basic-settings', schema: basicSettingsSchema as Record<string, unknown> },
  // Layout defaults — the CMS-owned baseline `resolveLayoutDefaults` sanitizes and
  // both sides resolve against. Nested children first: `layout` references them.
  { layer: 'config', name: 'layout-page', schema: layoutDefaultsPageSchema as Record<string, unknown> },
  { layer: 'config', name: 'layout-row', schema: layoutDefaultsRowSchema as Record<string, unknown> },
  { layer: 'config', name: 'layout-column', schema: layoutDefaultsColumnSchema as Record<string, unknown> },
  { layer: 'config', name: 'layout', schema: layoutDefaultsSchema as Record<string, unknown> },
];

/**
 * Injects the engine-owned preset components (preset-*) into Strapi's component
 * registry. This is an INTERNAL implementation detail — the public contract (the
 * component uids and their attributes) is defined by the component JSON schemas
 * plus the layer above, and must never be re-spelled here.
 */
export const injectComponents = ({ strapi }: { strapi: Core.Strapi }): void => {
  const componentRegistry = strapi.get('components');

  for (const { layer, name, schema } of ENGINE_COMPONENTS) {
    const category = `preset-${layer}`;
    const uid = `${category}.${name}`;

    if (componentRegistry.get(uid)) {
      strapi.log.warn(`[press-cms] component '${uid}' already registered; skipping engine injection`);
      continue;
    }

    const component = {
      ...schema,
      __schema__: structuredClone(schema),
      uid,
      category,
      modelType: 'component',
      modelName: name,
      // globalId is always derived deterministically — never taken from the JSON
      // schema to avoid a footgun where a mis-set globalId silently diverges from
      // the name Strapi uses internally.
      globalId: toGlobalId(`component_${uid}`),
    };

    componentRegistry.set(uid, component);
    strapi.log.info(`[press-cms] injected engine component '${uid}'`);
  }
};

/** An adopter block: any registered component under a `custom` / `custom-${layer}` category. */
export const isCustomBlockUid = (uid: string): boolean => uid.startsWith('custom.') || uid.startsWith('custom-');
