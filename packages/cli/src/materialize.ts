import { createRequire } from 'node:module';
import { cpSync, rmSync } from 'node:fs';
import path from 'node:path';

export interface MaterializeOptions {
  /**
   * Directory whose node_modules resolves @press/web. Defaults to the project
   * root (the normal case); the test overrides it to resolve from the repo.
   */
  resolveFrom?: string;
}

/**
 * Regenerates `<project>/.press/web/` from the @press/web host template (spec
 * §4.1). The host lives INSIDE the project tree so Node resolution reaches the
 * root node_modules (@press/web, next, react) and the adopter's blocks/custom/.
 * Engine-owned and rewritten on every run, exactly like `.next/` — never
 * hand-edited.
 */
export function materialize(projectRoot: string, opts: MaterializeOptions = {}): void {
  const resolveFrom = opts.resolveFrom ?? projectRoot;
  const require = createRequire(path.join(resolveFrom, 'noop.js'));
  const webPkg = require.resolve('@press/web/package.json');
  const templateDir = path.join(path.dirname(webPkg), 'templates', 'host');

  const dest = path.join(projectRoot, '.press', 'web');
  rmSync(dest, { recursive: true, force: true });
  cpSync(templateDir, dest, { recursive: true });
}
