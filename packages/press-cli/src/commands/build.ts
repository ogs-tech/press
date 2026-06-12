export interface BuildOptions {
  cwd: string;
}

export async function buildCommand(_opts: BuildOptions): Promise<void> {
  throw new Error('build: not implemented');
}
