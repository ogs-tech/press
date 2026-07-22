---
'@ogs-tech/press-cms': patch
'@ogs-tech/create-press': patch
---

fix(cms): rebuild the composition builder UI on Strapi's design-system

The `plugin::press-cms.builder` custom field was raw, unstyled HTML (native
`<select>`/`<details>`/`<fieldset>`, unicode `↑↓✕` controls, raw component uids as
labels) — jarring islands of light-mode browser widgets inside the dark admin,
and hard to read once the tree nested. It is now rebuilt with
`@strapi/design-system` + `@strapi/icons`, so the builder reads as native admin UI:

- Blocks are collapsible cards with a friendly name + icon (derived from the uid
  via a new `palette-labels` helper — unmapped/`custom-*` blocks degrade
  gracefully) and reorder/remove `IconButton`s.
- Rows and columns are distinct titled cards; container attrs collapse into a
  "Layout options" disclosure instead of always-open noise.
- "Add block" opens ONE inline palette grouped by category (this also removes a
  duplicate adder that rendered twice per column).
- Per-field forms use design-system inputs (`TextInput`, `Textarea`,
  `NumberInput`, `Toggle`, `SingleSelect`, `Field`), and empty slots show a hint.

Rows are now collapsible cards too (with a per-slot "Collapse all" / "Expand all"
control), so a deeply nested page stays scannable instead of exploding every
column and nested row at once.

`@strapi/design-system` and `@strapi/icons` are declared as `peerDependencies` so
`@strapi/sdk-plugin` externalizes them (the builder uses the host admin's single
copy — the same contract as React); a guard test pins this. No wire, schema, or
API change: `tree-ops`/`form-model` and the served `PressSchema` are untouched.

**Scaffold seed (`create-press`)**: the demo home is trimmed from a kitchen-sink
page (hero, list, quote, a nested-row recursion demo, separator, button, spacer,
cta, callout) to a simple, focused showcase of the two things worth demonstrating
up front — the **components** you place (a few blocks plus a note on the wider
palette) and the **grid layout** (one 50-50 row with an image in one column and a
paragraph in the other). The image component still carries the media-crosses-REST
proof. The rest of the palette is meant to be composed in the builder, and a
simple starting page is far easier to edit and test than a pre-filled one.
