// Re-exports the sync-generated types. `generated.ts` is gitignored and produced
// by `pnpm --filter @press/web sync-types`; this file fails to resolve until the
// first sync — which is the intended contract (Spec §6, AC2).
export * from './generated';
