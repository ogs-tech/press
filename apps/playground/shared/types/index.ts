// shared/types — the project's concrete content contract. `generated.ts` is
// written from the live CMS schema by `press dev` (sync-types) and gitignored;
// this re-export fails to resolve until the first sync, which is the intended
// contract: the types mirror exactly what the CMS serves (every `custom.*` block
// + the discriminated PageBody union). Adopter blocks import their props from
// here, e.g. `import type { CustomCallout } from '<name>-shared/types'`.
export * from './generated';
