---
'@ogs-tech/press-web': patch
'@ogs-tech/create-press': patch
---

fix: layout/grid fine-tuning — Column span, uniform prose column, full-width footer, scrollable drawer, grid-showcase seed

`@ogs-tech/press-web`:

- **`<Column>` span no longer collapses to one track.** The `grid-column: span N`
  shorthand stores the span in the START longhand, so the subsequent
  `grid-column-start: auto` (the undeclared-`start` case) erased it — every
  Column rendered as span 1. The span now rides on `grid-column-end`.
- **One editorial prose column for every atom.** `--press-container-prose`
  moves from `72ch` to `42rem` (≈72ch at the 16px body size): a `ch` value
  resolves against each consuming element's font, which gave a 28px heading a
  ~2× wider "prose" column than a paragraph. The column is now left-aligned to
  the lg-container rail (same margin math as `<Container maxWidth="lg">`)
  instead of viewport-centered, so atoms and organisms share a single left
  axis at every viewport.
- **Hero gap is tier-scaled** (`{ base: 'md', lg: 'lg' }`). A 12-track grid
  always carries 11 interior column-gaps, so a flat `lg` (48px) forced a 528px
  minimum width and overflowed phone viewports even with every column stacked.
- **Footer goes full-width** (`maxWidth="full"`), matching the Navbar so both
  chrome surfaces share edge-to-edge geometry — chrome is full-bleed, content
  Containers are the constrained ones.
- **The mobile nav drawer panel scrolls** (`max-height` + `overflow-y: auto` +
  `overscroll-behavior: contain`): body scroll is locked while the drawer is
  open, so an overflowing menu tail was previously unreachable.
- **One button family.** Every button-shaped link the engine renders (button
  atom, navbar CTA on desktop and in the drawer, hero CTA, cta-banner button)
  now shares a single visual contract: an always-present transparent border
  keeps both voices the same height, the secondary outline rides on
  `currentColor` (it used the neutral `--press-color-border`, which read as
  unfinished next to primary-colored text), and all surfaces gain hover /
  active states derived from the variant's own colors via `color-mix`
  (primary darkens toward ink, never black) plus a `:focus-visible` ring.
  The cookie-consent banner buttons get the same secondary border, hover,
  and focus treatment. No new tokens; flat strokes-over-shadows preserved.
- **Quote citations are anchored** with a typographic em-dash (`cite::before`)
  — the cite sits outside the blockquote's left border and floated without it.

`@ogs-tech/create-press`:

- The seeded "Hello from press" home becomes a layout-system showcase — it
  opens with the responsive 2-column `preset-organism.hero` (image + CTA) and
  closes with a centered `preset-organism.cta` banner around the ~72ch prose
  atom sequence. Demo content is deduplicated by design: one image, three
  distinct CTA labels.
- The seed fills the bootstrap's bare navbar with demo navigation (Home, an
  external GitHub item, a "Get started" CTA) so the header and the MobileNav
  hamburger render out of the box.
- The example `Callout` custom block now wraps itself in `<Container>`,
  demonstrating the non-atom custom-block contract (organisms own their own
  width; only atoms are re-centered by the engine's prose selector).
- The seeded spacer between the GitHub button and the cta banner drops from
  `lg` to `md` — the banner already carries its own section margin, and the
  stacked pair read as a ~120px dead zone.
- Every seeded CTA now has its own destination: the cta banner points at the
  press page on the OGS site (`https://useogs.com/press`, the launch-day
  route), the navbar "Get started" opens the published
  `@ogs-tech/create-press` npm page (the real scaffold quickstart), and the
  hero "Read the docs" / "Star on GitHub" keep their repo semantics.
