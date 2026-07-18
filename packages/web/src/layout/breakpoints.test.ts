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

  it('every layout-primitive @media in theme.css uses exactly the md or lg literal', () => {
    // Extract only the layout section (between "Layout primitives" comment and
    // end of file) so unrelated queries elsewhere in theme.css (none today,
    // but future-proof) don't perturb the check.
    const layoutSectionStart = css.indexOf('/* Layout primitives');
    expect(layoutSectionStart).toBeGreaterThanOrEqual(0);
    const layoutSection = css.slice(layoutSectionStart);
    const literals = [...layoutSection.matchAll(/@media \(min-width: (\d+)px\)/g)].map((m) => Number(m[1]));
    expect(literals.length).toBeGreaterThan(0);
    for (const value of literals) {
      expect([BREAKPOINTS.md, BREAKPOINTS.lg]).toContain(value);
    }
  });
});
