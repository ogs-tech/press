---
'@ogs-tech/press-web': major
---

feat!: engine-owned layout primitives (Container / Grid / Row / Column) + responsive nav

`@ogs-tech/press-web` now ships four React layout primitives — `Container`,
`Grid`, `Row`, `Column` — under `packages/web/src/layout/` (public export from
the package entrypoint). Primitives are server-first, zero-runtime: every
responsive behavior is expressed through a three-tier `Responsive<T>` prop
shape (`base=0`, `md=768px`, `lg=1024px`) that lowers to inline CSS custom
properties consumed by `theme.css` via a `var(a, var(b, var(c, default)))`
cascade. All four preset organisms — `Hero`, `Cta`, `Navbar`, `Footer` — are
refactored to consume the primitives: `Hero` gains a responsive 2-column layout
(text 7 / image 5 on md+, stacked at base), `Cta` moves its boxy visual onto an
inner `data-cta="frame"` wrapper, `Navbar` composes brand + links + CTA through
nested Rows, and `Footer` wraps its `<small>` in a Container.

A companion `MobileNav` client component adds a hamburger drawer for narrow
viewports (below `md`): toggle, aria-expanded, aria-modal="true" dialog,
Escape to close, body scroll lock, focus management. The desktop nav Row is
hidden below `md` and the hamburger takes over — no viewport-observer JS, just
a small stateful client component matched to a CSS media-query swap.

The `preset-layout` CMS palette category stays declared and labelled but ships
**zero components** — reserved for future organism-nested config components
(pattern: `preset-molecule.nav-item`).

BREAKING (visual): `main` no longer caps content at 72ch. Every preset atom
(`preset-atom.*`) and every custom atom (`custom-atom.*`) rendered inside `main`
preserves the ~72ch editorial reading width via a new CSS selector — the change
is transparent for adopters using engine atoms. Migration for adopter CUSTOM
NON-ATOM blocks that relied on the old cap: wrap in
`<Container maxWidth="prose">` (or `"lg"` for the wider content width) to
restore the desired width.

BREAKING (interactive client component): the navbar now mounts a client-side
`MobileNav`. Adopters overriding `preset-organism.navbar` via
`components={{ 'preset-organism.navbar': MyNavbar }}` are unaffected (their
component is rendered instead). Adopters KEEPING the engine navbar receive the
hamburger + drawer automatically.

Contract stability: `PressSchema`, `PageBody`, `HeaderBlocks`, `FooterBlocks`
are byte-identical. No CMS re-seed, no admin re-login, no data migration. No
`press-cms` bump — the CMS side is untouched.
