import { Command } from 'commander';
import pkg from '../package.json';
import { createCommand } from './commands/create';

/** Builds the create-press program — scaffold is the package's default action. */
export function buildProgram(): Command {
  const program = new Command();
  program
    .name('create-press')
    .description('Scaffold a new press project (ultra-thin Project zone)')
    .version(pkg.version)
    .argument('<name>', 'project directory to scaffold')
    .action((name: string) => createCommand({ name }));
  return program;
}

export async function run(argv: string[]): Promise<void> {
  await buildProgram().parseAsync(argv);
}
