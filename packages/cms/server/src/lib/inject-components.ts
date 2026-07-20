import type { Core } from '@strapi/strapi';
import paragraphSchema from '../components/atoms/paragraph.json';
import headingSchema from '../components/atoms/heading.json';
import listSchema from '../components/atoms/list.json';
import quoteSchema from '../components/atoms/quote.json';
import imageSchema from '../components/atoms/image.json';
import buttonSchema from '../components/atoms/button.json';
import separatorSchema from '../components/atoms/separator.json';
import spacerSchema from '../components/atoms/spacer.json';
import navItemSchema from '../components/molecules/nav-item.json';
import columnSchema from '../components/molecules/column.json';
import heroSchema from '../components/organisms/hero.json';
import ctaSchema from '../components/organisms/cta.json';
import columnsSchema from '../components/organisms/columns.json';
import navbarSchema from '../components/organisms/navbar.json';
import footerSchema from '../components/organisms/footer.json';
import seoSchema from '../components/config/seo.json';
import themeColorsSchema from '../components/config/theme-colors.json';
import themeRadiusSchema from '../components/config/theme-radius.json';
import cookieCategorySchema from '../components/config/cookie-category.json';
import cookieConsentSchema from '../components/config/cookie-consent.json';
import { toGlobalId } from './global-id';

/**
 * The Atomic Design layers of the engine's PRESET palette. Every preset component
 * registers under the category `preset-${layer}`, so its uid reads
 * `preset-${layer}.${name}` (e.g. `preset-atom.heading`, `preset-organism.navbar`).
 * Declaring the layers here is the single source of truth for the palette's shape
 * — categories are never spelled as ad-hoc string literals scattered across files.
 *
 * `layout` and `template` are RESERVED — no components ship in this task:
 *   - `layout`   ← delivered by the Grid System task (container/grid/row/column).
 *   - `template` ← installed by plugins (e.g. Site/Plugin for Company).
 * They are declared so the model is complete and picker labels are ready.
 */
export const PRESET_LAYERS = ['atom', 'molecule', 'organism', 'config', 'layout', 'template'] as const;
export type PresetLayer = (typeof PRESET_LAYERS)[number];

/**
 * Adopter (CUSTOM) layers mirror the preset content layers, minus the engine-only
 * `config`. An adopter drops a component under `src/components/custom-${layer}/`;
 * Strapi derives the `custom-${layer}` category from that folder name. Unlike
 * preset, placement is NOT a category concern on the custom side — every custom
 * block is admitted into every engine Dynamic Zone (see admitCustomBlocks); the
 * editor decides placement in the picker.
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
 *   2. plugins REGISTER     -> THIS hook (inject the preset-* palette, then admit custom-*)
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
  { layer: 'molecule', name: 'nav-item', schema: navItemSchema as Record<string, unknown> },
  { layer: 'molecule', name: 'column', schema: columnSchema as Record<string, unknown> },
  // Organisms — composed sections for the page body (hero/cta) and the site chrome
  // (navbar/footer). One unified layer (the old section.*/chrome.* palettes); the
  // placement split (body vs header/footer) is declared per content-type
  // schema.json, never by the category. The bar's internal layout is renderer-owned
  // so editors cannot break the chrome.
  { layer: 'organism', name: 'hero', schema: heroSchema as Record<string, unknown> },
  { layer: 'organism', name: 'cta', schema: ctaSchema as Record<string, unknown> },
  { layer: 'organism', name: 'columns', schema: columnsSchema as Record<string, unknown> },
  { layer: 'organism', name: 'navbar', schema: navbarSchema as Record<string, unknown> },
  { layer: 'organism', name: 'footer', schema: footerSchema as Record<string, unknown> },
  // Config — non-block settings referenced by the Site Settings single type (seo /
  // theme behave like a settings form; cookie-consent is plugin #1's editable
  // surface). Injected like the rest but never admitted into a Dynamic Zone.
  { layer: 'config', name: 'seo', schema: seoSchema as Record<string, unknown> },
  { layer: 'config', name: 'theme-colors', schema: themeColorsSchema as Record<string, unknown> },
  { layer: 'config', name: 'theme-radius', schema: themeRadiusSchema as Record<string, unknown> },
  { layer: 'config', name: 'cookie-category', schema: cookieCategorySchema as Record<string, unknown> },
  { layer: 'config', name: 'cookie-consent', schema: cookieConsentSchema as Record<string, unknown> },
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

/**
 * The engine Dynamic Zones that admit adopter blocks: the page `body` and the two
 * site-setting chrome zones. Every adopter component (category `custom-*`) is
 * admitted into ALL of them — placement is not a category concern on the custom
 * side (custom is organized by atomic LAYER; the editor decides placement in the
 * picker). The engine never restricts adopter blocks; it only curates the
 * placement of its OWN preset blocks, statically, in each content-type schema.json.
 */
const ENGINE_DZ_TARGETS: Array<{ uid: string; attribute: string }> = [
  { uid: 'plugin::press-cms.page', attribute: 'body' },
  { uid: 'plugin::press-cms.site-setting', attribute: 'header' },
  { uid: 'plugin::press-cms.site-setting', attribute: 'footer' },
];

/** An adopter block: any registered component under a `custom` / `custom-${layer}` category. */
const isCustomBlockUid = (uid: string): boolean => uid.startsWith('custom.') || uid.startsWith('custom-');

/**
 * Admits adopter components into EVERY engine Dynamic Zone.
 *
 * Contract: the folder an adopter drops a component under
 * (<host>/src/components/custom-${layer}/) declares its atomic LAYER — used for
 * palette grouping and generated type names — while the block itself is usable in
 * any zone. The engine NEVER names specific adopter blocks; the `custom*` category
 * prefix is the whole extension-point contract.
 *
 * Timing: loadApplicationContext runs loadPlugins + loadComponents in parallel
 * (Promise.all). module.load() registers plugin content-types synchronously when
 * the plugin module is added, so both engine content-types ARE present in the
 * content-types registry by the time plugin register() fires.
 */
export const admitCustomBlocks = ({ strapi }: { strapi: Core.Strapi }): void => {
  const componentRegistry = strapi.get('components');
  const customUids = [...componentRegistry.keys()].filter(isCustomBlockUid);

  for (const { uid, attribute } of ENGINE_DZ_TARGETS) {
    const contentType = strapi.get('content-types').get(uid);

    // Invariant: the engine ships both content-types, so they MUST be registered
    // by the time this register hook fires. If one isn't, custom block admission
    // cannot happen and the engine would boot half-broken (blocks silently absent
    // from the DZ → incomplete types → unknown components). Fail loud, abort boot.
    if (!contentType) {
      throw new Error(
        `[press-cms] invariant violated: '${uid}' is absent from the content-types ` +
          'registry at register time — custom blocks cannot be admitted, aborting boot. ' +
          'Likely an engine content-type load failure or a Strapi version mismatch.',
      );
    }

    const dzAttr = (contentType.attributes as Record<string, { type: string; components?: string[] }>)?.[attribute];

    if (!dzAttr || dzAttr.type !== 'dynamiczone' || !Array.isArray(dzAttr.components)) {
      throw new Error(
        `[press-cms] invariant violated: '${uid}' has no '${attribute}' dynamic zone ` +
          '(or it has an unexpected shape) at register time. The engine Dynamic Zones are the ' +
          'extension point for custom blocks — aborting boot. Likely a changed schema or a ' +
          'Strapi version mismatch.',
      );
    }

    const admitted: string[] = [];
    for (const customUid of customUids) {
      if (!dzAttr.components.includes(customUid)) {
        dzAttr.components.push(customUid);
        admitted.push(customUid);
      }
    }

    if (admitted.length > 0) {
      strapi.log.info(`[press-cms] admitted custom blocks into ${uid}#${attribute}: ${admitted.join(', ')}`);
    } else {
      strapi.log.debug(`[press-cms] no custom blocks to admit into ${uid}#${attribute}`);
    }
  }
};
