import type { Core } from '@strapi/strapi';
import heroSchema from './components/hero.json';

/**
 * Engine-shipped Dynamic-Zone components.
 *
 * Strapi only scans the host APP's `src/components` directory; there is no
 * declarative plugin-component API. To ship reference blocks from the engine
 * (`@press/cms` in `node_modules`) we inject them into the components registry
 * during the plugin `register` lifecycle.
 *
 * Boot order (see @strapi/core/dist/Strapi.js `load`):
 *   1. providers.register  -> loadApplicationContext (app components loaded)
 *   2. plugins REGISTER     -> THIS hook (we inject press.hero)
 *   3. bootstrap            -> transformContentTypesToModels([...contentTypes, ...components])
 *
 * The injected object mirrors the exact shape produced by Strapi's own loader
 * (@strapi/core/dist/loaders/components.js): the raw schema plus
 * { __schema__, uid, category, modelType, modelName, globalId }.
 */
const ENGINE_COMPONENTS: Array<{ category: string; name: string; schema: Record<string, unknown> }> = [
  { category: 'press', name: 'hero', schema: heroSchema as Record<string, unknown> },
];

/**
 * Mirrors lodash `_.upperFirst(_.camelCase(input))` for the `component_<uid>`
 * globalId derivation used by Strapi's component loader. Avoids a runtime
 * dependency on lodash (whose CJS default import breaks the Vite/Rollup bundle).
 */
const toGlobalId = (input: string): string => {
  const camel = input
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word, index) => (index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join('');
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  const registry = strapi.get('components');

  for (const { category, name, schema } of ENGINE_COMPONENTS) {
    const uid = `${category}.${name}`;

    if (registry.get(uid)) {
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
      globalId: (schema as { globalId?: string }).globalId || toGlobalId(`component_${uid}`),
    };

    registry.set(uid, component);
    strapi.log.info(`[press-cms] injected engine component '${uid}'`);
  }
};

export default register;
