import type { ComponentType } from 'react';
import { Hero } from './sections/hero';
import { Cta } from './sections/cta';
import { Columns } from './sections/columns';
import { Navbar } from './chrome/navbar';
import { Footer } from './chrome/footer';

/**
 * Engine-owned ORGANISM registry — composed sections for the page body
 * (hero/cta) and the site chrome (navbar/footer), unified into one Atomic Design
 * layer (the old `section.*` / `chrome.*` split). Kept SEPARATE from atomBlocks so the
 * layer boundary is mirrored in code. BlockRenderer merges this after the atoms
 * and before the adopter map — every organism is overridable via the explicit
 * `components` prop (e.g. `{ 'preset-organism.navbar': MyNavbar }`).
 */
export const organismBlocks: Record<string, ComponentType<any>> = {
  'preset-organism.hero': Hero,
  'preset-organism.cta': Cta,
  'preset-organism.columns': Columns,
  'preset-organism.navbar': Navbar,
  'preset-organism.footer': Footer,
};
