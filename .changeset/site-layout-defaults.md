---
'@ogs-tech/press-shared': minor
'@ogs-tech/press-cms': minor
'@ogs-tech/press-web': major
'@ogs-tech/create-press': patch
---

feat: site-level layout defaults — the builder speaks editorial, not engine

The three container-attr fallbacks that were hardcoded in the renderer
(`attrs?.width ?? 'lg'`, `gap ?? 'normal'`, `verticalAlign ?? 'top'`) are now
CMS-owned, edited in a new **Layout** section on Site Settings and picked up on
the next ISR cycle — no engine edit, no redeploy. The composition builder stops
saying `engine default` and NAMES the resolved value instead
(`Site default · Content width`), with humanized option labels
(`prose` → "Reading width", `lg` → "Content width", `full` → "Full bleed") and
per-level field names, so `gap` reads "Column gap" on a row and "Vertical
rhythm" in a column — the two different physical axes it actually is.

**press-shared** (minor, additive): new `LayoutDefaults` / `DEFAULT_LAYOUT` /
`resolveLayoutDefaults` (`src/layout-defaults.ts`), one group per tree level
(`page` / `row` / `column`, each the subset of `ContainerAttrs` that applies
there); the validator's three private enum lists become one exported
`CONTAINER_ENUMS`; `ContainerKey` is exported; `PressSchema` gains an OPTIONAL
`layoutDefaults`. No wire migration — `PRESS_TREE_VERSION` stays `2`.

**press-cms** (minor, additive): four new `preset-config.layout*` components and
a `layout` field on Site Settings; `GET /api/press/schema` now also carries
`layoutDefaults` (read via the new `readLayoutDefaults`, failing to
`DEFAULT_LAYOUT` so a pre-bootstrap database still serves a complete payload);
`GET /api/site-setting` deep-populates the group. The builder gains a
page-level "Layout options" section writing `tree.root.container` — the wire
field `TreeRenderer` already read but no UI could set.

**press-web** (MAJOR): `ResolvedPressConfig` gains a REQUIRED `layout:
LayoutDefaults` key (the `urn` / `pageDefaults` / `plugins` discipline). Every
`container-attrs.ts` picker takes the site defaults for its level as a second
argument (`rowGap(attrs, layout.row)`, `stackGap(attrs, layout.page)`, …) and
`TreeRenderer` threads `site.layout` beside `registry`. `mapSiteSettings`
resolves the key FAIL-TO-DEFAULT, joining `theme` and `plugins.cookieConsent`
rather than the identity/SEO fail-to-empty rule: an unreachable CMS renders with
the engine's layout, not with none. `watchSchema` now compares the
type-relevant slice of the schema payload (`contentTypes`/`components`/`tree`)
instead of the raw body, so editing a layout default no longer looks like a type
change; a non-JSON body (a cms mid-restart) still compares raw.

**create-press** (patch): the demo home page's second heading and its
surrounding copy say "Grid system", the feature's name everywhere else.
