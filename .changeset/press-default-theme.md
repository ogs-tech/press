---
"@ogs-tech/press-web": minor
"@ogs-tech/press-cms": minor
---

Add the theming mechanism and the embedded "Default" theme. The engine now ships a static `theme.css` and a pure `buildThemeStyle` helper that emits a `:root{ --press-* }` token block from a new `theme` key in `press.config.ts` (`theme: 'default'` or per-group colour/font/radius overrides). The host layout loads three optimized `next/font` families, injects the tokens, sets `<html data-theme>`, and renders a header/main/footer shell; reference blocks and custom blocks are styled entirely through the `var(--press-*)` namespace. `@ogs-tech/press-cms` adds a `theme` content-type (a "Themes" admin menu) seeded with one active "Default". The token namespace and the `:root` injection point are the only added contract surface.
