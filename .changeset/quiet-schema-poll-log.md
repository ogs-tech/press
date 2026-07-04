---
'@ogs-tech/press-cms': patch
---

fix(cms): silence the schema-poll http log line in development

`press dev` polls `GET /api/press/schema` every ~2s (the type-sync watcher),
and Strapi's `strapi::logger` middleware logs every request unconditionally —
flooding the dev log with one line per poll. The plugin now wraps
`strapi.log.http` during `register()` and drops messages for that one
engine-owned path, in development only: in production the watcher never runs,
and a stray hit on the schema endpoint stays visible.
