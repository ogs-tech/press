---
'@ogs-tech/press-web': minor
---

feat(web): `component` canonical — `urn:component:{uid}` type-level identity

`Entity` gains a 4th member `'component'` (additive), plus a `componentUrn(uid)`
factory (exported from the package root) formatting `urn:component:{uid}` for the
palette registries (`press.*`/`section.*`/`chrome.*`/`custom.*`). This is a
TYPE-level identity — distinct from the STORED identities (page/site-setting/
plugin) and from `blockKey`'s COMPUTED per-instance key. No object implements
`Canonical<'component'>`; the first consumer is `BlockRenderer`'s
unknown-component dev warning, now citing the canonical `urn:component:…` form.
