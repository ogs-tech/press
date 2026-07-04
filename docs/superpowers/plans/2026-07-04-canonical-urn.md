# Canonical URN Identity — Design Decisions

> Cited from code as `canonical-urn Spec §N`. Per repo convention, this doc may
> be removed after merge — CLAUDE.md ("Canonical identity (URNs)") is the living
> architectural reference for these decisions.

**Goal:** introduce the Canonical pattern on the web side: engine aggregates
carry a `urn:{entity}:{id}` identity, attached at the mapping boundary.
Interface + factory (no classes — the repo is pure functions + interfaces, and
plain values must cross the RSC boundary). Wire/CMS contract untouched.

## §1 — Identity primitives (`packages/web/src/urn.ts`)

- `Entity = 'page' | 'site-setting'` — CLOSED union of aggregates with STORED
  identity. Additive extension only (mirrors the `ThemeName` precedent); never
  widen a call site to plain `string`.
- `Urn<E extends string> = \`urn:${E}:${string}\`` — deliberately generic over
  any string (wider than `Entity`) so the same primitive formats COMPUTED
  identities (§4) without admitting them into the closed union. Template
  literal typing rejects arbitrary strings; no nominal brand (avoids `as Urn`
  noise at zero safety loss).
- `Canonical<E extends Entity> = { urn: Urn<E> }` — implemented by extension
  (`Page extends Canonical<'page'>`), never via parallel wrapper types: the
  aggregate IS the entity; there is exactly one type to import.
- `buildUrn(entity, id)` — pure, accepts `string | number`, no id validation
  (same trust boundary the mappers already apply to the CMS wire shape).

## §2 — Page: stored identity from `documentId`

`urn:page:{documentId}` — Strapi 5's document key is the only wire id that is
stable across draft/publish and locales. Attached by the pure `mapPage`
(`map-page.ts`, `RawPage = Omit<Page, 'urn'>`), mirroring the existing
`mapSiteSettings` pure-mapper + thin-fetcher split; `getPage` stays a thin
fetcher. The urn is derived web-side — never sent or stored by press-cms.

## §3 — Site Settings: synthetic singleton identity

`urn:site-setting:default` — the single type exposes no id in this wire
contract, so the id segment is a CONSTANT, attached by `mapSiteSettings`
unconditionally. Preserves the tolerant-absence philosophy: the urn is present
even when the CMS is unreachable/empty (identity is never CMS-sourced data).

## §4 — Blocks: computed identity only (Entity vs. value object)

Dynamic-zone block ids are ephemeral (unique only within the component table,
no document identity), so blocks are value objects: they get NO stored urn and
stay OUT of the `Entity` union. `blockKey` formats its React key through the
same `buildUrn` with `__component` as the entity segment
(`urn:press.image:5`) — one identity format, single-sourced, promised only for
the current render. A future stored block identity requires a CMS-persisted
uid (wire work — explicitly out of scope here).

## Out of scope (deliberate)

Media ids (dropped at the first hop today), nested components (`press.nav-item`
carries no `__component` — its type is only known to the parent schema),
`parseUrn` (no reverse-parsing consumer exists; note for a future implementer:
a block urn's entity segment contains dots and the composite id may contain
colons — split on the first two `:` only), and any change to press-cms,
press-shared, the serializer, or the generator.

## Versioning

`@ogs-tech/press-web` **major** (`.changeset/canonical-urn-identity.md`):
adding a REQUIRED `urn` field to the public `Page`/`ResolvedPressConfig`
interfaces breaks compilation for adopters who hand-construct those literals,
and the repo convention (chrome-blocks precedent) labels compile-breaking
changes with an explicit `BREAKING (press-web):` section rather than downplaying
them as minor. Runtime stays additive. A major press-web changeset
(chrome-blocks) was already pending, so the released version is unchanged by
this label — it only keeps the changelog honest.
