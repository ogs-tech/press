---
'@ogs-tech/press-web': major
---

feat(web)!: canonical urn identity — `urn:{entity}:{id}` on Page and Site Settings

New web-only identity primitives in `packages/web/src/urn.ts`, exported from the
package root: the closed `Entity` union (`'page' | 'site-setting'`), the
template-literal `Urn<E>` (`urn:{entity}:{id}`), the `Canonical<E>` interface
(`{ urn: Urn<E> }`), and the pure `buildUrn(entity, id)` factory. The wire
contract, press-cms, and press-shared are untouched — a urn is never sent or
stored by the CMS.

`Page` now extends `Canonical<'page'>`: the new pure `mapPage` mapper (mirroring
the `mapSiteSettings` pure-mapper + thin-fetcher split) attaches
`urn:page:{documentId}` right after the fetch. `ResolvedPressConfig` extends
`Canonical<'site-setting'>`: `mapSiteSettings` attaches the synthetic constant
`urn:site-setting:default` (single type — one record, identity never
CMS-sourced, present even when the CMS is unreachable). `blockKey` now formats
its React key through the same primitive (`press.image:5` →
`urn:press.image:5`) — a computed identity, never stored on the block; blockKey
was never exported, so no public surface changes shape there.

BREAKING (press-web): `Page` and `ResolvedPressConfig` gain a REQUIRED `urn`
field. Runtime is additive — every object produced by `getPage`/`getSiteConfig`
carries it automatically — but adopter code that hand-constructs a literal of
either type (e.g. a test fixture or a mock) fails `tsc` until it adds `urn`
(`'urn:page:<documentId>'` / `'urn:site-setting:default'`).
