---
'@ogs-tech/press-cms': minor
---

feat(cms): custom block kinds — placement-scoped adopter categories

The adopter extension point now carries placement semantics per category
folder (`admitCustomBlocks`):

- `src/components/custom/` → every engine Dynamic Zone (page `body` +
  site-setting `header`/`footer`) — the existing contract, unchanged;
- `src/components/custom-section/` → the page `body` only;
- `src/components/custom-chrome/` → the site-setting `header`/`footer` only,
  never the page body.

Purely additive: existing `custom.*` blocks keep their behavior and uids. The
engine still never names individual adopter blocks — only the `custom*`
categories are the stable contract. Note: `custom-chrome.*` blocks do not
receive the brand/links hydration that `chrome.navbar` gets from
`mapSiteSettings`; they render from their stored attributes alone.
