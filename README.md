# press

A CLI for building content-driven sites on a **Strapi 5 CMS + Next.js** stack,
where the whole stack ships as a versioned, updatable dependency. You own a
thin config layer (`press.config.ts` + your custom blocks); `press` materializes
and runs everything else.

```bash
pnpm create @ogs-tech/press my-site
cd my-site
pnpm dev          # cms on :1337/admin, web on :3000
```

One project, four commands: **create → dev → build → upgrade**.

## Requirements

- **Node 20.x** (`engines` pins `>=20 <21`)
- **pnpm 10.x**

## Install

> **Published on npm** under the [`@ogs-tech`](https://www.npmjs.com/org/ogs-tech) org.
> Scaffold a project anywhere with `pnpm create @ogs-tech/press my-site`; the
> generated project pins `@ogs-tech/press-{web,cms}` at the versions that
> produced it. Inside this monorepo the same packages are consumed via `workspace:*`
> for a fast dev loop (see [Repository internals](#repository-internals)).

## Quickstart

```bash
# 1. Scaffold a new project (writes only your thin Project zone, then installs).
pnpm create @ogs-tech/press my-site
cd my-site

# 2. Develop — boots the full stack as one process group
pnpm dev
#   → cms (Strapi)  http://localhost:1337/admin
#   → web (Next.js) http://localhost:3000
# Ctrl-C stops both.

# 3. Build deployable artifacts for both halves
pnpm build
```

`pnpm dev` / `build` / `upgrade` are thin aliases the scaffold writes for
`press dev` / `press build` / `press upgrade`.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm create @ogs-tech/press <name>` | Scaffold a new project into `<name>/` and `pnpm install` it. Run once — `@ogs-tech/create-press` is the scaffolder and is not added as a project dependency. |
| `pnpm dev` | Materialize the web host, seed sample content, boot cms (`:1337`), sync CMS schema → web types, then boot web (`:3000`). Maps to `press dev`. |
| `pnpm build` | Materialize the web host, `strapi build` the cms, and `next build` the web. No live CMS is needed to build. Maps to `press build`. |
| `pnpm upgrade [version]` | Bump `@ogs-tech/press-*` to the target in lockstep, reinstall, and re-materialize the host. Default = latest; pass an explicit version (e.g. `pnpm upgrade 0.4.0`) to pin a specific release. Maps to `press upgrade`. |

Run `press --help` or `press <command> --help` for the full flag list on the runtime bin.

## What `pnpm create @ogs-tech/press` writes

The scaffold is **ultra-thin** — only the layer you own. There is no `app/` or
`next.config`; the Next host is engine-owned and regenerated under a gitignored
`.press/web/` on every `dev`/`build`.

```
my-site/
├─ packages/
│  ├─ web/                 # your zone: config.ts (build-time anchors: routes + theme) + blocks/custom/ (React blocks + index.ts)
│  ├─ cms/                 # the one visible host — a minimal Strapi app
│  │  └─ scripts/seed.mjs  # sample home page so the first `press dev` renders something
│  └─ shared/              # the content-type contract (<name>-shared/types)
├─ package.json            # scripts: dev / build / upgrade → press
├─ pnpm-workspace.yaml     # packages/* are workspace members (web has no package.json, so pnpm skips it)
└─ .npmrc / .gitignore / .nvmrc
```

`.press/` is engine territory — regenerated every run, **never edit it**.

## Customizing your site

Two surfaces, split by *when* the value is needed.

**Build-time anchors** — `press.config.ts` (repo root). Only what the build must know
deterministically: the home-route slug, the theme **name**, and theme **fonts** (which
`next/font` resolves at build time). It is typed by `@ogs-tech/press-web`, so an engine
update that changes the config shape fails loudly at *your* file rather than drifting
silently. The engine reads this file but **never rewrites** it.

```ts
import { defineConfig } from '@ogs-tech/press-web';

export default defineConfig({
  routes: { home: 'home' }, // slug served at '/'; a direct hit on it redirects to '/'
  theme: 'default',         // or { name: 'default', fonts: { body: 'Inter' } }
});
```

**Identity, SEO & theme values** — edited in the CMS **"Site Settings"** single type
(brand name, URL, logo/favicon, SEO template, theme colors & radius). The web host
fetches them at **runtime** (ISR ~60s), so changes appear **without a redeploy**. If the
CMS is unreachable the site renders unbranded/default-themed rather than crashing — there
is no `press.config` fallback for identity by design.

**Custom blocks** — the engine ships a `preset-*` Atomic Design palette: atoms
(`preset-atom.paragraph`, `heading`, `list`, `quote`, `image`, `button`, `separator`,
`spacer`) and organisms (`preset-organism.hero`, `cta`, `navbar`, `footer`). To add your
own, drop a Strapi component under `packages/cms/src/components/custom-<layer>/` (the
folder names the atomic layer, e.g. `custom-organism/`), a matching React component under
`packages/web/blocks/custom/`, and wire it in `packages/web/blocks/custom/index.ts`:

```ts
export const customBlocks: Record<string, ComponentType<any>> = {
  'custom-organism.callout': Callout,
};
```

Every `custom-*` component is auto-admitted into **all** engine Dynamic Zones — the page
`body` and the site-setting `header`/`footer` — so the editor decides placement in the
picker (unlike the engine's own `preset-*` blocks, whose placement is curated per
content-type). The materialized host passes this map to its block renderer, so your blocks
render server-side alongside the engine's built-in blocks.

**Overriding a reference block** — the `preset-*` palette ships as defaults, not a
sealed set. The block renderer merges your map *over* the engine's
(`{ ...atomBlocks, ...organismBlocks, ...customBlocks }`), so mapping the **same key**
shadows a built-in with your own React component — markup and behavior become yours. Any
`preset-atom.*` or `preset-organism.*` key is overridable this way (e.g.
`'preset-organism.hero': MyHero`). This is **web-only**: the CMS still serves
`preset-atom.button` and the editing experience is unchanged, so existing content keeps
rendering.

```tsx
// packages/web/blocks/custom/Button.tsx — take the same props the engine block gets.
import type { PresetAtomButton } from '@ogs-tech/press-web';

export function Button({ label, href, variant }: PresetAtomButton) {
  // Keep `data-block` to inherit the default theme.css styling and only tweak markup;
  // drop it to fully own the look (the engine's `[data-block="preset-atom.button"]` rule
  // then matches nothing and goes inert).
  return <a className="cta" href={href} data-variant={variant ?? 'primary'}>{label}</a>;
}
```

```ts
// packages/web/blocks/custom/index.ts — map the SAME key to shadow the default.
export const customBlocks: Record<string, ComponentType<any>> = {
  'custom-organism.callout': Callout,
  'preset-atom.button': Button, // overrides the engine's preset-atom.button
};
```

Your override is yours to maintain: `press upgrade` keeps updating the engine's
*default* (which your map overrides) but never touches your component. If a future
engine version changes a block's prop **shape**, the generated `Preset*` type changes
and `tsc` flags your override at its call site — so drift fails loud rather than
silently rendering wrong.

**Reusing a reference block inside a custom block** — the inverse of overriding: instead
of *replacing* a `preset-*` block you *embed* one. Each reference block is exported
individually from `@ogs-tech/press-web` (`Heading`, `Paragraph`, `List`, `Quote`,
`Image`, `Button`, `Separator`, `Spacer`), so a custom block can reuse the engine's
server-rendered, theme-aware markup instead of reimplementing it. You feed each one from
your **own** schema fields — the presentation is reused, the data stays yours.

```tsx
// packages/web/blocks/custom/Callout.tsx
import { Heading, Paragraph, Button } from '@ogs-tech/press-web';
import type { CustomOrganismCallout } from '<name>-shared/types';

export function Callout({ title, body, ctaLabel, ctaHref }: CustomOrganismCallout) {
  return (
    <aside data-block="custom-organism.callout">
      <Heading text={title} level="3" />  {/* preset-atom.heading → { text, level } */}
      <Paragraph content={body} />         {/* preset-atom.paragraph → { content } */}
      <Button label={ctaLabel} href={ctaHref} variant="primary" />
    </aside>
  );
}
```

The one gotcha is **prop shape** — the generated `Preset*` types are the source of truth.
`Heading` wants `{ text, level }` and `Button` wants `{ label, href, variant }` (plain
scalars), but `Paragraph`/`List`/`Quote` want `{ content }` — a Strapi **blocks** value,
*not* a string. So to feed a `Paragraph`, the custom block's own schema needs a `blocks`
attribute:

```jsonc
// packages/cms/src/components/custom-organism/callout.json
"attributes": {
  "title":    { "type": "string", "required": true },
  "body":     { "type": "blocks" },        // ← feeds <Paragraph content={body} />
  "ctaLabel": { "type": "string" },
  "ctaHref":  { "type": "string" }
}
```

The embedded child carries its own `data-block` (e.g. `preset-atom.heading`), so it
inherits the default theme.css styling for free; the wrapper's
`data-block="custom-organism.callout"` is your block's own hook. Reuse is **web-only and
decided by you** — the editor fills your custom block's flat fields, not a nested preset
block; you choose the layout. (Letting the *editor* compose `preset-*` blocks inside a
custom component is a different, schema-level feature and not currently supported.)

## Updating the engine

`press upgrade` (via `pnpm upgrade`) is the coordinated lockstep update path —
it resolves the target version, rewrites exact pins for `@ogs-tech/press-web` and
`@ogs-tech/press-cms` in lockstep, reinstalls, and re-materializes the host.
Because pins are EXACT, `pnpm update` is a no-op — `pnpm upgrade` is the real path.

```bash
pnpm upgrade            # latest engine
pnpm upgrade 0.4.0      # a specific version
```

Engine updates never touch your Project zone (your config, blocks, and content
stay byte-for-byte intact).

---

## Repository internals

This monorepo develops `press` and proves the core thesis — that a Strapi 5 CMS
can ship as a versioned, updatable dependency without leaking into the adopter's
code.

- `packages/cli` — `@ogs-tech/create-press`: the run-once scaffolder invoked via `pnpm create @ogs-tech/press`; not added as a project dependency.
- `packages/cms` — the **engine** Strapi plugin (`@ogs-tech/press-cms`): ships the
  `page` + `site-setting` content-types, injects the `preset-*` Atomic Design palette
  (atoms/molecules/organisms/config) into the engine Dynamic Zones, and serves the
  type-sync contract at `/api/press/schema`.
- `packages/web` — the **engine** web layer (`@ogs-tech/press-web`): the Next host
  template, block renderer, config helpers, and CMS→types sync.
- `packages/shared` — `@ogs-tech/press-shared`: framework-agnostic contract types
  (the `PressSchema` wire format) and constants shared by `cms` and `web`.
- `apps/playground/` — the in-repo dogfood: the real `press create` output,
  committed and consumed via `workspace:*` for a fast dev loop. Boot it with
  `pnpm dev` (it recreates the tree from the live scaffold when absent); to
  force-recreate, run `pnpm exec tsx scripts/create-playground.ts`.

### Working in the repo

```bash
pnpm install              # from the repo root (Node 20.x, pnpm 10.x)
pnpm --filter @ogs-tech/create-press test      # CLI unit contracts
pnpm dev                              # boot the playground (press dev: cms :1337 + web :3000)
```

End-to-end tests (a Playwright suite) are planned.

### Design docs

Architecture and design rationale live in [`CLAUDE.md`](CLAUDE.md) — the contract /
type-sync loop, host materialization, the build-time-anchors vs. runtime Site Settings
split, the custom-block extension point, and the versioning/upgrade model.
