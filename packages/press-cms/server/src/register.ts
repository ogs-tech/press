import type { Core } from '@strapi/strapi';
import heroSchema from './components/hero.json';
import { toGlobalId } from './lib/global-id';

/**
 * Engine-shipped Dynamic-Zone components.
 *
 * Strapi only scans the host APP's `src/components` directory; there is no
 * declarative plugin-component API. To ship reference blocks from the engine
 * (`@press/cms` in `node_modules`) we inject them into the components registry
 * during the plugin `register` lifecycle.
 *
 * Boot order (see @strapi/core/dist/Strapi.js `load`):
 *   1. providers.register  -> loadApplicationContext (app components AND plugin
 *      content-types loaded in parallel; module.load() registers CTs before register)
 *   2. plugins REGISTER     -> THIS hook (we inject press.hero, then admit custom.*)
 *   3. bootstrap            -> transformContentTypesToModels([...contentTypes, ...components])
 *
 * The injected object mirrors the exact shape produced by Strapi's own loader
 * (@strapi/core/dist/loaders/components.js): the raw schema plus
 * { __schema__, uid, category, modelType, modelName, globalId }.
 */
const ENGINE_COMPONENTS: Array<{ category: string; name: string; schema: Record<string, unknown> }> = [
  { category: 'press', name: 'hero', schema: heroSchema as Record<string, unknown> },
];

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  const componentRegistry = strapi.get('components');

  // Step 1: inject engine-owned components (press.*)
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

  // Step 2: admit all adopter custom.* components into the engine's page Dynamic Zone.
  //
  // Contract: any component the adopter places under <host>/src/components/custom/
  // is automatically admitted into the engine's reference Dynamic Zone (body field
  // on plugin::press-cms.page). The engine NEVER names specific adopter blocks;
  // only the "custom" category is the stable extension-point contract.
  //
  // Timing: loadApplicationContext runs loadPlugins + loadComponents in parallel
  // (Promise.all). module.load() registers plugin content-types synchronously when
  // the plugin module is added, so plugin::press-cms.page IS present in the
  // content-types registry by the time plugin register() fires.
  const pageContentType = strapi.get('content-types').get('plugin::press-cms.page');

  if (!pageContentType) {
    strapi.log.warn('[press-cms] plugin::press-cms.page not found in content-types registry at register time; custom.* blocks cannot be admitted');
    return;
  }

  const bodyAttr = (pageContentType.attributes as Record<string, { type: string; components?: string[] }>)?.body;

  if (!bodyAttr || bodyAttr.type !== 'dynamiczone' || !Array.isArray(bodyAttr.components)) {
    strapi.log.warn('[press-cms] page.body dynamic zone not found or has unexpected shape; skipping custom.* admission');
    return;
  }

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

export default register;
