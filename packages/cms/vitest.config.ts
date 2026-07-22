import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';

/**
 * The cms suite is otherwise config-free (node default env; the admin component
 * test opts into jsdom with a `// @vitest-environment jsdom` pragma). This file
 * exists ONLY to let that one test import real `@strapi/design-system` widgets,
 * which needs two workarounds:
 *
 *  1. ESM/CJS: `@strapi/design-system` (+ `@strapi/icons` / `@strapi/ui-primitives`)
 *     declare `"type": "module"` yet point `main` at a CommonJS `dist/index.js`
 *     with no `exports` map. Externalized, Node's ESM loader reads that `.js` as
 *     ESM and dies on `exports is not defined`. Inlining routes them through
 *     vite's transform; `mainFields` prefers their ESM `module` build. Packages
 *     that ship an `exports` map (the server-side strapi deps) are unaffected —
 *     `exports` wins over `mainFields`.
 *  2. Duplicate React: design-system pulls in radix, and pnpm has planted a
 *     second physical `react` copy nested under a `@radix-ui` package. Inlined
 *     radix resolving to it gives a second React instance → null hook dispatcher
 *     ("Cannot read properties of null (reading 'useMemo')"). Pinning every
 *     react entrypoint to the single hoisted copy collapses them.
 */
const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    mainFields: ['module', 'browser', 'main'],
    dedupe: ['react', 'react-dom'],
    // Order matters: subpaths before the bare package names.
    alias: {
      'react/jsx-dev-runtime': require.resolve('react/jsx-dev-runtime'),
      'react/jsx-runtime': require.resolve('react/jsx-runtime'),
      'react-dom/client': require.resolve('react-dom/client'),
      'react-dom': require.resolve('react-dom'),
      react: require.resolve('react'),
    },
  },
  test: {
    server: {
      deps: {
        // @radix-ui too: externalized, Node resolves its nested react copy and
        // ignores the vite alias above; inlined, the alias collapses it to one.
        inline: [/@strapi\/design-system/, /@strapi\/icons/, /@strapi\/ui-primitives/, /@radix-ui\//],
      },
    },
  },
});
