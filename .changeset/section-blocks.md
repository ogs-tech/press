---
'@ogs-tech/press-cms': minor
'@ogs-tech/press-web': minor
---

feat: composite section blocks (section.*)

Adds an engine-owned palette of composite sections under a new `section.*`
category: `section.hero` and `section.cta`. CMS injects both components and lists
them statically in the page `body` Dynamic Zone; they flow through the unchanged
type-sync pipeline (all fields are flat scalar/media/enum), so `serialize-schema`
and the generator are untouched. Web ships `Hero`/`Cta` renderers behind a separate
`sectionBlocks` registry that `BlockRenderer` merges between `referenceBlocks` and
the adopter's `components` — each section is born branded by the Site Settings theme
(theme.css consumes `var(--press-*)` tokens) and overridable via
`components={{ 'section.hero': MyHero }}`. Additive and non-breaking: `press.*` and
`custom.*` are unchanged; adopters gain `section.*` on `press upgrade`.
