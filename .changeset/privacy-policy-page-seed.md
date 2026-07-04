---
'@ogs-tech/press-cms': minor
---

feat(cms): seed a Privacy Policy page template once at bootstrap

`bootstrap()` now seeds a "Privacy Policy" page (slug `privacy-policy`) exactly
once, following the chrome-seed semantics: a `privacyPageSeeded` plugin-store
flag makes the pass literal-once, an adopter page already occupying the slug
wins (seed marks itself done without writing), and an editor-deleted page is
respected forever. The page is created as a DRAFT — the engine never publishes
content on its own.

The template is structure + placeholder guidance composed from existing
`press.*` atoms (intro, Data We Collect, Cookies, How We Use Your Data, Data
Sharing, Your Rights, Contact) — no legal boilerplate is embedded; the editor
writes and owns the actual policy text.
