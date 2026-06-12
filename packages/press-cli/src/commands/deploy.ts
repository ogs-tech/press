export interface DeployOptions {
  cwd: string;
}

export async function deployCommand(_opts: DeployOptions): Promise<void> {
  throw new Error('deploy: not implemented');
}
