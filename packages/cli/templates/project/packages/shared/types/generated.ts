// BOOTSTRAP content contract — a minimal, COMMITTED baseline so the project
// typechecks and builds before the first `press dev`. This file is OVERWRITTEN
// from the live CMS schema by `press dev` (sync-types); it intentionally mirrors
// only the starter schema (the `custom-organism.callout` block). Safe to commit — later
// schema changes land here as reviewable diffs.

export interface PressMedia {
  url: string;
  width?: number;
  height?: number;
  alternativeText?: string | null;
  name?: string;
  mime?: string;
}

export interface CustomOrganismCallout {
  __component: 'custom-organism.callout';
  id: number;
  message: string;
  variant?: 'info' | 'warning' | 'success';
}

// Permissive baseline: the real union (every `custom-*` block) is filled in on
// the first sync. Kept forgiving so any starter page body still typechecks.
export type PageBody = Array<{ __component: string; id: number; [key: string]: unknown }>;

export interface Page {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  body: PageBody;
}
