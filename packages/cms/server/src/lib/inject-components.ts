import type { Core } from '@strapi/strapi';
import paragraphSchema from '../components/paragraph.json';
import headingSchema from '../components/heading.json';
import listSchema from '../components/list.json';
import quoteSchema from '../components/quote.json';
import imageSchema from '../components/image.json';
import buttonSchema from '../components/button.json';
import separatorSchema from '../components/separator.json';
import spacerSchema from '../components/spacer.json';
import seoSchema from '../components/seo.json';
import themeColorsSchema from '../components/theme-colors.json';
import themeRadiusSchema from '../components/theme-radius.json';
import navItemSchema from '../components/nav-item.json';
import heroSectionSchema from '../components/section/hero.json';
import ctaSectionSchema from '../components/section/cta.json';
import chromeNavbarSchema from '../components/chrome/navbar.json';
import chromeFooterSchema from '../components/chrome/footer.json';
import { toGlobalId } from './global-id';

/**
 * Engine-shipped Dynamic-Zone components.
 *
 * Strapi only scans the host APP's `src/components` directory; there is no
 * declarative plugin-component API. To ship reference blocks from the engine
 * (`@ogs-tech/press-cms` in `node_modules`) we inject them into the components registry
 * during the plugin `register` lifecycle.
 *
 * Boot order (see @strapi/core/dist/Strapi.js `load`):
 *   1. providers.register  -> loadApplicationContext (app components AND plugin
 *      content-types loaded in parallel; module.load() registers CTs before register)
 *   2. plugins REGISTER     -> THIS hook (we inject the press.* core palette, then admit custom.*)
 *   3. bootstrap            -> transformContentTypesToModels([...contentTypes, ...components])
 *
 * The injected object mirrors the exact shape produced by Strapi's own loader
 * (@strapi/core/dist/loaders/components.js): the raw schema plus
 * { __schema__, uid, category, modelType, modelName, globalId }.
 */
const ENGINE_COMPONENTS: Array<{ category: string; name: string; schema: Record<string, unknown> }> = [
  // Gutenberg-style core palette: atomic text, media, and structural blocks.
  { category: 'press', name: 'paragraph', schema: paragraphSchema as Record<string, unknown> },
  { category: 'press', name: 'heading', schema: headingSchema as Record<string, unknown> },
  { category: 'press', name: 'list', schema: listSchema as Record<string, unknown> },
  { category: 'press', name: 'quote', schema: quoteSchema as Record<string, unknown> },
  { category: 'press', name: 'image', schema: imageSchema as Record<string, unknown> },
  { category: 'press', name: 'button', schema: buttonSchema as Record<string, unknown> },
  { category: 'press', name: 'separator', schema: separatorSchema as Record<string, unknown> },
  { category: 'press', name: 'spacer', schema: spacerSchema as Record<string, unknown> },
  // Composite sections: engine-owned, flat (scalar/media/enum) building blocks.
  // Separate category from press.* keeps the atomic palette intact (Spec §5.1).
  { category: 'section', name: 'hero', schema: heroSectionSchema as Record<string, unknown> },
  { category: 'section', name: 'cta', schema: ctaSectionSchema as Record<string, unknown> },
  // Composite chrome blocks: header/footer bars admitted ONLY into the
  // site-setting chrome DZs, never the page body (Spec §1). The bar's internal
  // layout is renderer-owned so editors cannot break the chrome (Spec §Decisions 6).
  { category: 'chrome', name: 'navbar', schema: chromeNavbarSchema as Record<string, unknown> },
  { category: 'chrome', name: 'footer', schema: chromeFooterSchema as Record<string, unknown> },
  // Configuration components used by the Site Settings single type (not page blocks).
  { category: 'press', name: 'seo', schema: seoSchema as Record<string, unknown> },
  { category: 'press', name: 'theme-colors', schema: themeColorsSchema as Record<string, unknown> },
  { category: 'press', name: 'theme-radius', schema: themeRadiusSchema as Record<string, unknown> },
  { category: 'press', name: 'nav-item', schema: navItemSchema as Record<string, unknown> },
];

/**
 * Injects engine-owned components (press.*) into Strapi's component registry.
 * This is an INTERNAL implementation detail — the public contract (the press.*
 * component uids and their attributes) is defined by the component JSON schemas
 * and must never change here.
 */
export const injectComponents = ({ strapi }: { strapi: Core.Strapi }): void => {
  const componentRegistry = strapi.get('components');

  for (const { category, name, schema } of ENGINE_COMPONENTS) {
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
 * Admits all adopter custom.* components into the engine's page Dynamic Zone.
 *
 * Contract: any component the adopter places under <host>/src/components/custom/
 * is automatically admitted into the engine's reference Dynamic Zone (body field
 * on plugin::press-cms.page). The engine NEVER names specific adopter blocks;
 * only the "custom" category is the stable extension-point contract.
 *
 * Timing: loadApplicationContext runs loadPlugins + loadComponents in parallel
 * (Promise.all). module.load() registers plugin content-types synchronously when
 * the plugin module is added, so plugin::press-cms.page IS present in the
 * content-types registry by the time plugin register() fires.
 */
export const admitCustomBlocks = ({ strapi }: { strapi: Core.Strapi }): void => {
  const pageContentType = strapi.get('content-types').get('plugin::press-cms.page');

  // Invariant: the engine ships plugin::press-cms.page, so it MUST be registered
  // by the time this register hook fires. If it isn't, custom.* admission cannot
  // happen and the engine would boot half-broken (blocks silently absent from the
  // DZ → incomplete types → pages with unknown components). Fail loud, abort boot.
  if (!pageContentType) {
    throw new Error(
      "[press-cms] invariant violated: 'plugin::press-cms.page' is absent from the " +
        'content-types registry at register time — custom.* blocks cannot be admitted, ' +
        'aborting boot. Likely an engine content-type load failure or a Strapi version mismatch.',
    );
  }

  const bodyAttr = (pageContentType.attributes as Record<string, { type: string; components?: string[] }>)?.body;

  if (!bodyAttr || bodyAttr.type !== 'dynamiczone' || !Array.isArray(bodyAttr.components)) {
    throw new Error(
      "[press-cms] invariant violated: 'plugin::press-cms.page' has no 'body' dynamic zone " +
        '(or it has an unexpected shape) at register time. The page Dynamic Zone is the engine ' +
        'extension point for custom.* blocks — aborting boot. Likely a changed page schema or a ' +
        'Strapi version mismatch.',
    );
  }

  const componentRegistry = strapi.get('components');
  const admitted: string[] = [];

  for (const uid of componentRegistry.keys()) {
    if (uid.startsWith('custom.') && !bodyAttr.components.includes(uid)) {
      bodyAttr.components.push(uid);
      admitted.push(uid);
    }
  }

  if (admitted.length > 0) {
    strapi.log.info(`[press-cms] admitted custom blocks into page Dynamic Zone: ${admitted.join(', ')}`);
  } else {
    strapi.log.debug('[press-cms] no custom.* components found to admit');
  }
};
