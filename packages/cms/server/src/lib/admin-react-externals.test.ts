import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Regression guard for a SILENT, CI-invisible admin crash.
 *
 * The plugin's admin bundle (builder-input custom field) ships React components.
 * `@strapi/sdk-plugin`'s vite build externalizes ONLY the packages listed in the
 * plugin's `dependencies` + `peerDependencies` (see its vite-config: it iterates
 * `Object.keys(pkg.peerDependencies)`). If `react`/`react-dom` are not declared
 * here, the build BUNDLES the workspace's hoisted React (18) into the admin
 * chunk, producing a second React instance beside the Strapi admin host's React
 * (19) → "Cannot read properties of null (reading 'useState')" at admin runtime.
 * Nothing in `pnpm build`/`pnpm -r test`/typecheck catches this — only opening the
 * admin does. So this test pins the externalization contract instead.
 *
 * The SAME reasoning covers `@strapi/design-system` and `@strapi/icons`: the
 * composition builder renders design-system components, which read the theme and
 * portal targets from React context supplied by the host admin's
 * DesignSystemProvider. A bundled copy would carry its own context instance →
 * `undefined` theme / unstyled-or-crashing widgets. Both must be externalized too,
 * so they belong in peerDependencies for the same build reason as React.
 */
describe('admin bundle React externalization', () => {
  const pkg = JSON.parse(
    readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8'),
  ) as { peerDependencies?: Record<string, string> };

  it('declares react and react-dom as peerDependencies so the plugin admin uses the host React (not a bundled copy)', () => {
    expect(pkg.peerDependencies?.react).toBeDefined();
    expect(pkg.peerDependencies?.['react-dom']).toBeDefined();
  });

  it('declares @strapi/design-system and @strapi/icons as peerDependencies so the builder uses the host admin copy (not a bundled one)', () => {
    expect(pkg.peerDependencies?.['@strapi/design-system']).toBeDefined();
    expect(pkg.peerDependencies?.['@strapi/icons']).toBeDefined();
  });
});
