import { Command } from 'commander';
import pkg from '../package.json';
import { createCommand } from './commands/create';
import { devCommand } from './commands/dev';
import { buildCommand } from './commands/build';
import { deployCommand } from './commands/deploy';

/** Builds the configured commander program (extracted for testability). */
export function buildProgram(): Command {
  const program = new Command();
  program
    .name('press')
    .description('press CLI — create / dev / build / deploy the press stack')
    .version(pkg.version);

  program
    .command('create')
    .argument('<name>', 'project directory to scaffold')
    .description('Scaffold a new press project (ultra-thin Project zone)')
    .option('--registry <url>', 'registry serving @press/* packages', 'https://registry.npmjs.org/')
    .action((name: string, opts: { registry: string }) =>
      createCommand({ name, registry: opts.registry }),
    );

  program
    .command('dev')
    .description('Boot the whole stack (cms + web) for development')
    .action(() => devCommand({ cwd: process.cwd() }));

  program
    .command('build')
    .description('Build deployable artifacts for cms + web')
    .action(() => buildCommand({ cwd: process.cwd() }));

  program
    .command('deploy')
    .description('Validate prereqs and emit the deploy path (Spec 5)')
    .action(() => deployCommand({ cwd: process.cwd() }));

  return program;
}

export async function run(argv: string[]): Promise<void> {
  await buildProgram().parseAsync(argv);
}
