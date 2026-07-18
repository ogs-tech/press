import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BREAKPOINTS } from './breakpoints';

// theme.css lives at packages/web/theme.css — three levels up from this test.
const themeCssPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'theme.css');
const css = readFileSync(themeCssPath, 'utf8');

describe('breakpoint coordination between TS constants and theme.css (Spec §6.1)', () => {
  it('theme.css contains a @media (min-width: <md>px) rule matching BREAKPOINTS.md', () => {
    expect(css).toMatch(new RegExp(`@media \\(min-width: ${BREAKPOINTS.md}px\\)`));
  });

  it('theme.css contains a @media (min-width: <lg>px) rule matching BREAKPOINTS.lg', () => {
    expect(css).toMatch(new RegExp(`@media \\(min-width: ${BREAKPOINTS.lg}px\\)`));
  });

  it('every @media in the layout-primitives OR mobile-nav sections uses exactly the md or lg literal', () => {
    // Layout primitives live from "Layout primitives" to end of file, plus
    // the mobile-nav block appended in plan Task 13. Both share the same
    // BREAKPOINTS.md / BREAKPOINTS.lg literals. `max-width: 767.98px` (= md - 0.02)
    // is allowed because it is the semantic complement to `min-width: 768px`
    // — a mobile-nav CSS idiom that keeps both queries mutually exclusive
    // across zoom levels.
    const layoutSectionStart = css.indexOf('/* Layout primitives');
    expect(layoutSectionStart).toBeGreaterThanOrEqual(0);
    const layoutSection = css.slice(layoutSectionStart);
    const literals = [...layoutSection.matchAll(/@media \([^)]+\)/g)].map((m) => m[0]);
    expect(literals.length).toBeGreaterThan(0);
    const allowed = new Set([
      `@media (min-width: ${BREAKPOINTS.md}px)`,
      `@media (min-width: ${BREAKPOINTS.lg}px)`,
      `@media (max-width: ${BREAKPOINTS.md - 0.02}px)`,
    ]);
    for (const q of literals) {
      expect(allowed).toContain(q);
    }
  });
});
