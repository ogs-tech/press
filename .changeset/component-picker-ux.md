---
'@ogs-tech/press-cms': minor
---

feat(cms): component-picker UX — per-block icons + human category labels

Every engine component JSON now sets `info.icon` (Strapi's fixed icon enum), so
the admin "Pick one component" dialog stops rendering the generic grid fallback
for all blocks: `press.paragraph` → `write`, `press.image` → `picture`,
`section.hero` → `landscape`, `chrome.navbar` → `layout`, and so on.

The plugin also ships its first admin bundle (`./strapi-admin` export, built by
the same `strapi-plugin build`). Its single job is `registerTrads`: the picker
resolves each category accordion title through react-intl using the RAW
category string as the message id, so the bundle registers unprefixed keys —
`press` → "Blocks", `section` → "Sections", `chrome` → "Site chrome",
`custom` → "Custom blocks" (en + pt/pt-BR) — labelling the picker without
touching component uids (a uid is wire/DB contract; labels are presentation).
Adopters keep the final word: `src/admin/app.tsx` `config.translations` takes
precedence over these engine defaults.
