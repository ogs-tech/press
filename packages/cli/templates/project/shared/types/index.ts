// shared/types — the project's concrete content contract. `generated.ts` ships a
// committed baseline (the starter schema) so this re-export resolves the moment
// `press create` finishes; `press dev` (sync-types) then overwrites it from the
// live CMS schema, so the types mirror exactly what the CMS serves (every
// `custom.*` block + the discriminated PageBody union). Adopter blocks import
// their props from here, e.g. `import type { CustomCallout } from '<name>-shared/types'`.
export * from './generated';
