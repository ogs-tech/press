# BASE/PAGES — foundation rescoped (ISR + generic seed; metadata → Plugin/SEO)

**Date:** 2026-07-05
**CRM item:** `[OGS] [PRESS] BASE / PAGES`
**Status:** design approved, pending spec review

## Context

The `page` content-type, the RSC catch-all route, `mapPage` (`urn:page:{documentId}`),
and the `/home → /` redirect already exist. Reconnaissance against the CRM DONE found
that most of the item is already shipped. The real work is narrow:

- **One real bug:** `getPage` fetches with `cache: 'no-store'`, which opts the whole
  route into per-request dynamic rendering — so **ISR is NOT intact**, directly failing
  the DONE criterion "rota não-dynamic (ISR intacto)". This is the same trap the
  cookie-consent design deliberately avoids (never force the route dynamic / poison ISR).
- **One generalization:** page seeding is bespoke (`seedPrivacyPolicyPage`, hardcoded
  constant + `privacyPageSeeded` flag). The CRM wants a reusable idempotent seed
  mechanism and states privacy-policy is **not** a base seed — it belongs to a future
  Plugin/Legal.

### Scope decision (locked during brainstorming)

Metadata (SEO **and** social/share) is pulled OUT of this item into a **new Plugin/SEO**
roadmap item (sibling of Plugin/Legal), following the engine's thin-base + plugin-family
philosophy. BASE/PAGES becomes a pure foundation:

| Decision | Choice |
| --- | --- |
| Privacy-policy seed | **Remove from base**; ship generic `seedPage()` API |
| Metadata depth in this item | **None beyond `<title>`** (favicon kept — it is identity, not SEO) |
| Per-page SEO/social override fields | Deferred to Plugin/SEO (not added to `page` schema here) |
| Plugin/SEO roadmap card | Created (drafted below; user pastes into Zoho — no MCP access) |
| ISR revalidate window | 60s (mirrors `getSiteConfig`) |
| `seedPage()` consumer in base | None yet — exported-but-unused API until Plugin/Legal / archetypes consume it |

## Goals

1. Route renders SSR (full HTML in view-source) **as ISR**, not forced-dynamic.
2. `/home → /` stays deterministic and CMS-independent (already true — verify only).
3. A generic idempotent `seedPage({ slug, title, body, flagKey })` helper exists as
   public API for Plugin/Legal and archetype templates.
4. Privacy-policy seeding removed from base.
5. `<head>` metadata reduced to `<title>` (+ favicon); everything else handed to Plugin/SEO.

## Non-goals

- Any per-page SEO/social schema fields, canonical, `metadataBase`, Open Graph, Twitter
  card, robots, JSON-LD, hreflang — all Plugin/SEO.
- i18n / per-locale — separate downstream item.
- Touching the `preset-config.seo` component or `mapSiteSettings` (left as-is, harmless).
- Changing the `getPage` fetch URL / by-slug mechanism (out of scope — it works today).

## Design

### A. ISR intact (`packages/web`)

**`src/get-page.ts`** — the one-line core fix:

- `fetch(..., { cache: 'no-store' })` → `fetch(..., { next: { revalidate: 60 } })`.
  The cached fetch makes the route eligible for static generation + ISR: first request
  renders SSR and caches; Next revalidates in the background every 60s.
- Fix the header comment (`get-page.ts:9-11`): it currently claims `no-store` keeps the
  contract test deterministic. Re-state the ISR intent and note the route stays
  CMS-free at build time.

**`templates/host/app/[[...slug]]/page.tsx`**:

- Keep **no** `generateStaticParams` and `dynamicParams` at its default (`true`) so pages
  render on-demand and the build never touches a live CMS (preserves the property in
  `src/commands/build.ts:10-18`).
- Optionally add `export const revalidate = 60` for an explicit segment default; decide
  during implementation whether the fetch-level `revalidate` alone reads clearly enough.
- `/home → /` (`permanentRedirect`) and `notFound()` run inside the render and are
  unchanged — verify they still fire under ISR.
- Update the stale "dynamic RSC, never stale" comments in `src/commands/build.ts:16-17`.

**Materialization:** edit the `templates/host/**` source only. `apps/playground/.press/web`
is engine-owned and regenerated — never hand-edited.

### B. Generic `seedPage()` + remove privacy-policy (`packages/cms`)

**New `server/src/lib/seed-page.ts`** — extract the idempotent pattern verbatim from
`seedPrivacyPolicyPage`:

```ts
export const PAGE_UID = 'plugin::press-cms.page';

export async function seedPage(
  strapi: Core.Strapi,
  opts: { slug: string; title: string; body: unknown[]; flagKey: string },
): Promise<void> {
  const store = pluginStore(strapi);
  if (await store.get({ key: opts.flagKey })) return;          // seeded once, then never again
  const docs = strapi.documents(PAGE_UID);
  const existing = await docs.findFirst({ filters: { slug: opts.slug } } as any);
  if (!existing) {
    await docs.create({ data: { title: opts.title, slug: opts.slug, body: opts.body } as any });
  }
  await store.set({ key: opts.flagKey, value: true });          // draft only — engine never publishes
}
```

Preserves all three invariants: flag-first (editor-deleted page respected forever), slug
collision → adopter wins, created as DRAFT.

**Remove:**
- Delete `server/src/lib/seed-page-privacy-policy.ts`.
- Remove the import + `await seedPrivacyPolicyPage(strapi)` from `server/src/bootstrap.ts`.
- Relocate `PAGE_UID` (currently exported from the deleted file) into `seed-page.ts`;
  grep for other importers of `PAGE_UID` and repoint them.

**Export surface:** ensure `seedPage` is reachable by future consumers (Plugin/Legal,
archetype templates) from the cms server module — confirm the package's server export path
during implementation.

### C. Metadata reduced to `<title>` (`packages/web`)

**`src/config/build-metadata.ts`** — reduce `buildMetadata` to:

```ts
type PageMeta = { title?: string } | null;

export function buildMetadata(resolved: ResolvedPressConfig, page: PageMeta): Metadata {
  const { brand, seo } = resolved;
  const title = page?.title ? seo.titleTemplate.replace('%s', page.title) : seo.defaultTitle;
  return {
    title,
    ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
  };
}
```

Removed: `description`, `alternates.canonical` (was wrong anyway — always the site root),
`openGraph`, and the `images` derivation. The `ResolvedPressConfig.seo` shape and
`mapSiteSettings` stay untouched (`defaultDescription`/`defaultOgImage` simply go
unconsumed until Plugin/SEO). The route already forwards only `{ title }`, so no route
change is needed.

**Honest consequence:** until Plugin/SEO ships, the site emits no canonical and no OG.
Removing a *wrong* canonical is a net improvement; the removed logic is captured in the
Plugin/SEO card so nothing is lost.

### D. Plugin/SEO roadmap card (drafted — user pastes into Zoho)

> **[OGS] [PRESS] PLUGIN / SEO**
>
> **TIPO:** engine plugin (família PressPlugin) — metadata de `<head>` para ranking + share.
> **DEPENDE DE:** BASE/PAGES (content-type + render ISR), Base/Canonical.
> **HABILITA:** Site OGS, i18n (hreflang per-locale).
>
> **OBJETIVO:** entregar toda a metadata de `<head>` como plugin opt-in, em dois grupos:
> - **SEO (ranking/indexação):** `metadataBase`, canonical correto por página, robots
>   (noindex por página), JSON-LD (WebPage/Organization), hreflang (single-locale stub;
>   full quando i18n chegar).
> - **Social/share (unfurl):** Open Graph (`og:title/description/image/url/type/site_name`)
>   + Twitter card — default no Site Settings, override por página.
>
> **ESCOPO:**
> - Campos de override SEO/social **por página** no `page` schema (componente `preset-config`
>   dedicado ou estendendo o `preset-config.seo`; decidir no brainstorming do item).
> - Defaults no Site Settings (reusa o `preset-config.seo` já existente).
> - Seam de integração: mapper puro `buildSeoMetadata(resolved, page)` alimentando o
>   `generateMetadata` do host — **não** é mount de componente como o cookie-consent
>   (metadata é export de route/layout no Next, não componente montado no `layout.tsx`).
> - Fail-to-empty consistente com identity/SEO (CMS fora → metadata default, nunca crash).
>
> **DONE:** página compartilhada mostra card OG/Twitter com título+imagem corretos;
> canonical aponta pra própria URL da página; robots/JSON-LD presentes no view-source;
> ISR permanece intacto (metadata não força a rota dynamic).

## Testing

- **Unit — `seedPage` idempotency** (`packages/cms`): flag set → no-op; slug already
  exists → no write, marks done; absent → creates a DRAFT with the given title/slug/body.
- **Unit — `buildMetadata`** (`packages/web`): update the existing test to the title-only
  (+ favicon) shape; assert `description`/`openGraph`/`alternates` are gone.
- **Blast radius:** grep tests/e2e for any assertion that the privacy-policy page is
  seeded, and for `PAGE_UID`/`seedPrivacyPolicyPage`/`buildMetadata` output; adjust or
  remove. The reproducible-seed e2e (`5f850e7`) uses its own fixture, not privacy-policy —
  verify it is unaffected.
- **ISR verification (DONE gate):** drive the app (`press dev` / `/run`) — confirm a
  CMS-created page renders full HTML in view-source, `/home` 308-redirects to `/`, and the
  page route is served as ISR/static (not forced-dynamic). No route-level cache-busting.

## Verification against DONE (amended)

| DONE (amended) | How |
| --- | --- |
| Página renderiza SSR — HTML completo no view-source | view-source on a CMS page |
| **Rota não-dynamic / ISR intacto** | `getPage` cached (`revalidate: 60`); no forced-dynamic |
| `/home → /` | existing `permanentRedirect`, verified under ISR |
| `seedPage()` genérico idempotente disponível | unit test + exported API |
| Privacy-policy removida do base | `bootstrap.ts` no longer calls it; file deleted |
| Metadata = `<title>` (resto → Plugin/SEO) | `buildMetadata` reduced; card D created |

Original DONE said "metadata SEO + social" — that is now delivered by the **Plugin/SEO**
item (card D), not by BASE/PAGES.

## Rollout notes

- Engine change → add a changeset under `.changeset/` (press-web + press-cms both touched).
- Removing OG/canonical is a visible behavior change pre-Plugin/SEO; acceptable pre-release.
- `press-web` metadata reduction + `press-cms` seed removal are independent patches but ship
  together to keep the item coherent.
