export interface CreateOptions {
  name: string;
  registry: string;
}

export async function createCommand(_opts: CreateOptions): Promise<void> {
  throw new Error('create: not implemented');
}
