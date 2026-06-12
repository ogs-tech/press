export interface DevOptions {
  cwd: string;
}

export async function devCommand(_opts: DevOptions): Promise<void> {
  throw new Error('dev: not implemented');
}
