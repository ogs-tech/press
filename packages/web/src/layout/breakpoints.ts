/**
 * Layout breakpoints (Spec §5.1, §6.1). Three tiers cover mobile/tablet/desktop
 * cleanly for v1; extra tiers are a deliberate non-goal (Spec §3). Kept as TS
 * constants (not CSS vars) because `@media (min-width: var(--x))` is not
 * supported in production browsers — theme.css mirrors these literals in its
 * media queries, and `breakpoints.test.ts` (Task 8) asserts both sides match.
 */
export const BREAKPOINTS = { base: 0, md: 768, lg: 1024 } as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Shared responsive prop shape (Spec §5.1). Every primitive that accepts a
 * responsive value uses this: a bare `T` means "same at every tier"; the object
 * form declares per-tier values with a required `base` and optional `md`/`lg`
 * that inherit through the CSS var() cascade emitted by the primitive.
 */
export type Responsive<T> = T | { base: T; md?: T; lg?: T };

/**
 * Flattens a Responsive<T> to a full { base, md?, lg? } record for CSS-var
 * emission. Scalars are lifted to `{ base: value }`; an undefined value uses
 * `fallback`. Does NOT fill md/lg from base — the CSS var() cascade handles
 * inheritance (Spec §5.4/§5.5/§6.3), so we emit only the tiers the author
 * declared, keeping the DOM minimal.
 */
export function normalizeResponsive<T>(
  value: Responsive<T> | undefined,
  fallback: T,
): { base: T; md?: T; lg?: T } {
  if (value === undefined) return { base: fallback };
  if (typeof value === 'object' && value !== null && 'base' in (value as { base: T })) {
    const record = value as { base: T; md?: T; lg?: T };
    const out: { base: T; md?: T; lg?: T } = { base: record.base };
    if (record.md !== undefined) out.md = record.md;
    if (record.lg !== undefined) out.lg = record.lg;
    return out;
  }
  return { base: value as T };
}
