---
'@ogs-tech/press-web': major
'@ogs-tech/press-cms': minor
---

feat: Base/Plugin framework — the example plugin, wired end to end, plus a Content-Manager plugin index

The reusable plugin framework every future engine plugin builds on:
`PressPlugin<Id>` (already merged, RESERVED since the cookie-consent
retirement) gets its first real consumer. A synthetic `example` plugin — one
boolean (`enabled`, off by default) and one string (`message`) — is wired
through the full pipeline: a new `preset-config.example-plugin` CMS
component on Site Settings, a pure fail-open mapper
(`plugins/example/map-example-plugin.ts`), and a plain server-component
shell mounted with one line in the host `layout.tsx`
(`{site.plugins.example.enabled && <ExamplePlugin ... />}`). A fresh adopter
site shows nothing extra out of the box; toggling it on in Site Settings
proves the whole contract works.

A new read-only `plugin::press-cms.plugin` collection type gives
Content-Manager visibility into every plugin the engine knows about and its
currently-configured `enabled` state (`syncPluginEntries`, run every boot,
wired last in `bootstrap.ts`) — a view, never a second source of truth.
Every field is `editable: false`; the mirror only refreshes on the next
boot (a lifecycle-hook refresh is a named follow-up, out of scope here).

BREAKING (press-web): `ResolvedPressConfig` gains a REQUIRED `plugins: {
example: ResolvedExamplePlugin }` key — hand-constructed literals fail
`tsc`, the same discipline `pageDefaults`/`layout` already follow.

press-cms is additive only: one component, one Site Settings attribute, one
populate key, one new collection type, one bootstrap step.
