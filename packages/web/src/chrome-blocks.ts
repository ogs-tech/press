import type { ComponentType } from 'react';
import { Navbar } from './chrome/navbar';
import { Footer } from './chrome/footer';

/**
 * Engine-owned CHROME registry (Spec §3). Kept SEPARATE from referenceBlocks and
 * sectionBlocks so the four-palette split (press.* atoms / section.* sections /
 * chrome.* chrome / custom.* adopter) is mirrored in code. BlockRenderer merges
 * this after sections and before the adopter map — `chrome.navbar` is overridable
 * exactly like `section.hero`.
 */
export const chromeBlocks: Record<string, ComponentType<any>> = {
  'chrome.navbar': Navbar,
  'chrome.footer': Footer,
};
