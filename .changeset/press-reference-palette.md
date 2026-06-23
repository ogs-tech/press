---
"@ogs-tech/press-web": minor
"@ogs-tech/press-cms": minor
---

Replace the engine's single `press.hero` reference block with a Gutenberg-style core palette of eight flat blocks: atomic text (`press.paragraph`, `press.heading`, `press.list`, `press.quote`), media (`press.image`), and structural (`press.button`, `press.separator`, `press.spacer`). Modeled on WordPress Gutenberg's core blocks but stored Strapi-native (structured Dynamic-Zone components; no HTML-comment grammar, no nesting). The decomposed text blocks share a small in-house Strapi-`blocks` renderer (`blocks/blocks-content.tsx`, exported as `renderBlocks`) rather than `@strapi/blocks-react-renderer` (which is `"use client"` and would hydrate static prose into a client island), so the palette adds zero runtime dependencies and stays fully server-rendered. The inline link renderer now neutralizes `javascript:`/`data:` URLs and marks external links `rel="noopener noreferrer"`. The seeded "Hello from press" home page is rebuilt to showcase the new blocks.

BREAKING: `press.hero` is removed. The `@ogs-tech/press-web` exports `Hero` and `PressHero` are gone, replaced by the new block components (`Paragraph`, `Heading`, `List`, `Quote`, `Image`, `Button`, `Separator`, `Spacer`) and their `Press*` types. Pages referencing a removed `__component` do NOT crash: `BlockRenderer` tolerates the now-unknown block (renders nothing plus a dev-only warning). Existing Hero rows remain in the database but are no longer editable as that component; authors rebuild that content from the new atomic blocks.
