import { Command } from 'commander';
import { buildCommand } from './commands/build';
import { devCommand } from './commands/dev';
import { upgradeCommand } from './commands/upgrade';

/** Builds the press runtime program (dev/build/upgrade), extracted for testability. */
export function buildProgram(): Command {
  const program = new Command();
  program.name('press').description('press runtime — dev / build / upgrade the press stack');

  program
    .command('dev')
    .description('Boot the whole stack (cms + web) for development')
    .action(() => devCommand({ cwd: process.cwd() }));

  program
    .command('build')
    .description('Build deployable artifacts for cms + web')
    .action(() => buildCommand({ cwd: process.cwd() }));

  program
    .command('upgrade')
    .argument('[target]', 'engine version to upgrade to (default: latest)')
    .description('Bump @ogs-tech/press-* to the target, reinstall, and re-materialize')
    .action((target?: string) => upgradeCommand({ cwd: process.cwd(), target }));

  return program;
}

export async function run(argv: string[]): Promise<void> {
  await buildProgram().parseAsync(argv);
}
