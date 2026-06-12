import path from 'node:path';
import { scaffold } from '../create/scaffold';
import { run } from '../util/run';

export interface CreateOptions {
  name: string;
  registry: string;
}

/**
 * Scaffolds the ultra-thin Project zone (spec §6) into <name>/ and installs it
 * against the configured registry. The CLI writes ONLY the adopter layer; the
 * Next host is materialized to .press/web/ on the first dev/build.
 */
export async function createCommand(opts: CreateOptions): Promise<void> {
  const target = path.resolve(process.cwd(), opts.name);
  console.log(`> press create ${opts.name}`);
  scaffold({ target, name: opts.name, registry: opts.registry });
  console.log('> scaffolded the Project zone (config + blocks + content + cms host)');

  console.log('> pnpm install');
  await run('pnpm', ['install'], { cwd: target });

  console.log(`\nDone. Next steps:\n  cd ${opts.name}\n  pnpm dev      # boots cms + web\n`);
}
