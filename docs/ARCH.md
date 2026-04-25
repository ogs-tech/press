---
title: "ARCH — Next in Site (cms-scaffold-cli)"
internal_name: cms-scaffold-cli
codename: nis
status: in progress
created_at: 2026-04-25
updated_at: 2026-04-25
template: arc42 v8.2 (https://arc42.org/overview)
---

# ARCH — Next in Site

Technical architecture for the `cms-scaffold-cli` CLI and the monorepo it generates. Structured per [arc42](https://arc42.org/overview) (v8.2). Product scope, audience, and goals live in [PRD.md](PRD.md); this document covers solution structure, decisions, and quality.

## 1. Introduction and Goals

### 1.1 Requirements Overview

Two artifacts are delivered:

- **The CLI** (`@nis/create`) — a Node generator that prompts the user, renders a template repository, installs dependencies, and boots the local environment.
- **The generated monorepo** — an opinionated full-stack codebase emitted by the CLI as the starting point for a new project.

The CLI itself is small; value is concentrated in the template and integration patterns it ships with. Functional scope is defined in [PRD §2](PRD.md#2-features-mvp) (F1–F11).

### 1.2 Quality Goals

Top-3 quality drivers (full quality tree in §10):

1. **Time-to-value** — `create` → first deploy ≤ 30 min ([PRD §3](PRD.md#3-release-criteria-v01)).
2. **Generated-site performance** — LCP <2.5s, CLS <0.1 on the scaffolded site ([PRD §3](PRD.md#3-release-criteria-v01)).
3. **Release reliability** — 100% of releases without critical regression in the bootable scaffold ([PRD §3](PRD.md#3-release-criteria-v01)).

### 1.3 Stakeholders

| Role | Concern |
|---|---|
| Full-stack developer | Run one command, get a working full-stack project |
| Agency tech lead | Standard baseline across teams; whitelabel for client forks |
| Content editor (post-scaffold) | Compose pages via dynamic blocks without dev changes |
| Maintainers (2 devs) | Keep template bootable across pinned-version upgrades |

## 2. Architecture Constraints

### 2.1 Technical

Pinned majors to keep upgrades coordinated:

| Layer | Choice | Version |
|---|---|---|
| Front-end framework | Next.js (App Router) | 15.x |
| Headless CMS | Strapi | 5.x |
| Language | TypeScript | 5.x |
| Monorepo orchestration | Turborepo | 2.x |
| Package manager | pnpm | 9.x |
| Styling | Tailwind CSS | 4.x |
| Container runtime (self-host) | Docker / Docker Compose | latest |

### 2.2 Organizational

- **Team:** 2 full-time devs, no dedicated designer ([PRD §4](PRD.md#4-schedule)).
- **Deadline:** v0.1 in 3 months — July/2026 ([PRD §4](PRD.md#4-schedule)).
- **License:** MIT ([PRD §5 Decision 1](PRD.md#5-decisions)).

### 2.3 Conventions

- **Distribution name:** `@nis/create`, invoked as `npm create @nis@latest` ([PRD §5 Decision 2](PRD.md#5-decisions)).
- **MVP exclusions:** SaaS/hosted offering, WYSIWYG page builder, theme marketplace, custom RBAC, advanced SEO, prebuilt design system, alternative front-end frameworks ([PRD §3](PRD.md#3-release-criteria-v01)).

## 3. Context and Scope

### 3.1 Business Context

```text
                   ┌──────────────────────┐
   developer ────► │  @nis/create  (CLI)  │ ◄──── npm registry
                   └──────────┬───────────┘
                              │ scaffolds + boots
                              ▼
                   ┌──────────────────────┐
                   │   Generated monorepo │
                   │   apps/web (Next 15) │ ◄──── end visitor (HTTP)
                   │   apps/cms (Strapi 5)│ ◄──── content editor (admin UI)
                   └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Postgres (CMS data) │
                   └──────────────────────┘
```

| External actor / system | Interaction |
|---|---|
| Developer | Runs CLI from terminal; answers prompts |
| npm registry | Distributes `@nis/create` |
| Content editor | Uses Strapi admin UI in `apps/cms` |
| End visitor | Browses the deployed `apps/web` site |
| Postgres | Backing store for Strapi |
| Vercel / Strapi Cloud (managed) | Hosts `apps/web` / `apps/cms` |
| Telemetry endpoint (post-MVP) | Receives anonymous usage events (§8.2) |

### 3.2 Technical Context

| Channel | Protocol / Format |
|---|---|
| CLI ↔ developer | stdio prompts (TTY) |
| CLI ↔ npm | HTTPS package fetch |
| `apps/web` ↔ `apps/cms` | HTTP REST/GraphQL (Strapi content API) |
| Type-sync generator ↔ Strapi | Local introspection (in-process, dev-time) |
| `apps/cms` ↔ Postgres | TCP/SQL |
| Telemetry (post-MVP) | HTTPS POST, JSON |

## 4. Solution Strategy

| Goal | Strategy |
|---|---|
| One-command scaffold (F1) | Single Node CLI as `npm create` entry point; template rendered with variable substitution |
| Type-safe CMS↔Web contract (F3) | Generator introspects Strapi schema and emits `.d.ts` into `packages/types` |
| Editor-driven page composition (F4) | Strapi Dynamic Zone + typed `<BlockRenderer />` registry on Next |
| Whitelabel by design (F11) | Single root `nis.config.json`, JSON Schema-validated, consumed by all layers |
| Two deploy paths (F6) | Managed (Vercel + Strapi Cloud) and self-hosted (Docker Compose); no code branching |
| Tractable maintenance (2 devs) | Single front-end framework, pinned majors, Turborepo + pnpm for minimal config surface |

## 5. Building Block View

### 5.1 Generated monorepo (level 1)

```text
<project>/
├── apps/
│   ├── web/        # Next.js 15 (App Router) — public site
│   └── cms/        # Strapi 5 — admin + content API
├── packages/
│   ├── types/      # shared TS types (Strapi ↔ Next contract)
│   ├── ui/         # shared React primitives (optional)
│   └── config/     # shared eslint / tsconfig / tailwind presets
├── nis.config.json # whitelabel source of truth (F11)
├── turbo.json
├── pnpm-workspace.yaml
└── docker-compose.yml
```

`apps/*` are deployable units. `packages/*` are internal-only.

### 5.2 Building blocks

| Block | Responsibility |
|---|---|
| `apps/web` | Public site, App Router, localized routing, `<BlockRenderer />` |
| `apps/cms` | Strapi admin, content API, type-sync generator script |
| `packages/types` | Generated `.d.ts` for Strapi content types + `NisConfig` from JSON Schema |
| `packages/ui` | Shared React primitives (optional, opt-out per project) |
| `packages/config` | ESLint, tsconfig, Tailwind presets — including `primaryColor` from `nis.config.json` |

## 6. Runtime View

### 6.1 CLI scaffold flow (F1)

1. `npm create @nis@latest <name>` invokes the CLI (resolves to `@nis/create`).
2. Prompts collect project name, package manager, locales, deploy target.
3. CLI clones/renders the template into `<name>/`, applying variable substitution.
4. `pnpm install` runs at the root.
5. CLI boots `apps/cms` (Strapi dev) and `apps/web` (Next dev) in parallel via Turborepo.
6. CLI prints local URLs and a "what's next" checklist.

### 6.2 CMS ↔ Next type sync (F3)

- A generator script in `apps/cms` introspects Strapi content types and emits `.d.ts` into `packages/types`.
- A watch task re-runs on schema changes during dev.
- `apps/web` imports `@nis/types` directly — no manual type duplication.

### 6.3 Dynamic block rendering (F4)

- Strapi side: pages expose a Dynamic Zone (`blocks`) that accepts a curated set of components.
- Next side: `<BlockRenderer />` maps each block's `__component` discriminator to a React component via a typed registry.
- Three reference blocks ship in the template (e.g. hero, rich text, media grid) as worked examples.

### 6.4 Localized content (F5)

- Strapi i18n plugin enabled with locales chosen at scaffold time.
- Next localized routing (`/[locale]/...`) wired to fetch the matching locale from Strapi.

## 7. Deployment View

Two paths documented; the scaffold supports both without code changes.

| Path | `apps/web` | `apps/cms` | Notes |
|---|---|---|---|
| **Managed** (default) | Vercel | Strapi Cloud | Recommended for fastest first deploy |
| **Self-hosted** | Node service or static export | `docker-compose.yml` (Strapi + Postgres + reverse proxy) | Full control, ops cost on adopter |

## 8. Cross-cutting Concepts

### 8.1 Whitelabel configuration (F11)

A single `nis.config.json` at the generated repo root is the source of truth for brand strings and assets — the project is whitelabel-by-design ([PRD §5 Decision 5](PRD.md#5-decisions)).

**Location and format**

- File: `nis.config.json` at the root of the generated repo.
- Format: JSON, for cross-tool consumption (Node templates, Strapi scripts, shell, CI).
- Schema: `nis.config.schema.json` ships alongside; editors get autocomplete via JSON Schema.
- Types: `packages/types` exports `NisConfig` derived from the schema. Consumers `import type { NisConfig } from '@nis/types'`.

**Fields (initial set)**

`productName`, `tagline`, `primaryColor`, `logo` (light/dark), `repoUrl`, `docsUrl`, `npmScope`. The schema is the canonical reference; this list documents intent only.

**Consumers**

- CLI templates — variable substitution at scaffold time.
- Generated root + workspace `package.json` — CLI writes resolved values during scaffold.
- CLI banner — reads `nis.config.json` from the generated repo.
- `README.md` — substitution at scaffold time.
- `apps/web` landing page — imports `nis.config.json` at build time.
- `packages/config/tailwind` — resolves `primaryColor` into the Tailwind theme.

**Validation**

The CLI validates `nis.config.json` against the schema during scaffold and on `pnpm dev` / `pnpm build`; invalid config fails fast with a typed error.

### 8.2 Telemetry (F10, post-MVP)

- Opt-in at first run (CLI prompt) and revocable via config.
- Anonymous payload only: CLI version, Node version, OS, scaffold options chosen, success/failure of boot. No project name, no path, no content.
- Sent to a single owned endpoint; transport details TBD.
- Deferred to v1.1 ([PRD §5 Decision 3](PRD.md#5-decisions)).

### 8.3 Internationalization (F5)

Cross-cutting across `apps/cms` (Strapi i18n plugin) and `apps/web` (Next localized routing). Locales selected at scaffold time and propagated to both apps.

### 8.4 Type contract (F3)

Cross-cutting across `apps/cms` (generator) and `apps/web` (consumer) via `packages/types`. See §6.2 for runtime, §11 for drift risk.

## 9. Architecture Decisions

ADR-lite format: each decision lists context, decision, and consequences.

### ADR-1 — Next 15 + Strapi 5

- **Context:** Both are current majors with stable APIs; pinning earlier majors locks adopters out of recent ecosystem improvements.
- **Decision:** Pin to Next 15.x and Strapi 5.x.
- **Consequences:** Forced re-pin if a Strapi 6 release lands within the v0.1 window (see §11).

### ADR-2 — Turborepo + pnpm

- **Context:** Need monorepo task graph and minimal install footprint with low config surface for a 2-dev team.
- **Decision:** pnpm workspaces + Turborepo.
- **Consequences:** Adopters must use pnpm; npm/yarn parity is not provided.

### ADR-3 — Tailwind 4, no design system

- **Context:** Shipping a design system would force aesthetics on every adopter (out of scope per [PRD §3](PRD.md#3-release-criteria-v01)).
- **Decision:** Utility-first Tailwind as the lowest-opinion baseline.
- **Consequences:** No prebuilt components beyond optional `packages/ui` primitives; adopters bring their own design language.

### ADR-4 — Whitelabel config in JSON (F11)

- **Context:** Whitelabel-by-design ([PRD §5 Decision 5](PRD.md#5-decisions)) requires a config readable by Node, Strapi, shell, and CI.
- **Decision:** `nis.config.json` (JSON, lowest common denominator) + JSON Schema + derived `.d.ts`.
- **Consequences:** Type-safety preserved; one extra build step to derive `NisConfig`.

### ADR-5 — Strapi default auth (F7)

- **Context:** Building custom auth in MVP is high cost; most users will replace it anyway.
- **Decision:** Ship Strapi's default auth as-is.
- **Consequences:** No SSO/RBAC examples; documented as adopter-extension point.

### ADR-6 — Single front-end framework (Next)

- **Context:** Multi-framework support multiplies the type contract and block-system surface — intractable for 2 devs.
- **Decision:** Next is the only front-end framework for MVP.
- **Consequences:** Adopters preferring Remix/Astro must wait or fork; revisit post-v0.1.

### ADR-7 — Two deploy paths only (managed + Docker Compose)

- **Context:** Covers the 80% case; Kubernetes / serverless variations multiply ops surface.
- **Decision:** Managed (Vercel + Strapi Cloud) and self-hosted Docker Compose only.
- **Consequences:** K8s/Helm, AWS-native, and edge-runtime variants are out of scope for MVP.

## 10. Quality Requirements

### 10.1 Quality tree

```text
quality
├── performance
│   ├── generated-site LCP <2.5s, CLS <0.1
│   └── scaffold + boot ≤ 2 min (PRD pitch)
├── usability
│   ├── create → first deploy ≤ 30 min
│   └── Dev NPS ≥ 30
├── reliability
│   └── 100% releases without critical regression
└── maintainability
    ├── type-sync drift detected by snapshot test
    └── pinned majors with renovate-style updates
```

### 10.2 Quality scenarios

CI must guarantee the scaffold itself stays bootable. Minimum scenarios on each release:

1. `create-next-in-site` runs to completion on a clean machine (Linux + macOS).
2. Generated repo: `pnpm install` succeeds.
3. Generated repo: `pnpm dev` boots `apps/cms` and `apps/web` and both respond on their ports.
4. Generated repo: `pnpm build` succeeds for `apps/web`.
5. Type sync (F3) produces a non-empty `packages/types` after first CMS boot.
6. `BlockRenderer` renders the three reference blocks without runtime errors.

Targets above (10.1) tracked per [PRD §3 release criteria](PRD.md#3-release-criteria-v01).

## 11. Risks and Technical Debt

| Risk | Impact | Mitigation |
|---|---|---|
| Strapi 6 release during v0.1 window | Forces re-pin; possibly rewrites the type-sync generator | Track Strapi release cadence; keep generator isolated |
| Next App Router edge cases (localized routing × dynamic blocks × caching/streaming) | Subtle prod bugs missed in dev | Reference blocks must exercise these paths in CI |
| Type-sync drift (generator misses a content type or relation kind) | `apps/web` compiles against stale contract | Snapshot test on generator output |
| Template rot (pinned versions go stale) | Adopters land on stale stack | Renovate-style update routine before v0.1 ships |

## 12. Glossary

| Term | Definition |
|---|---|
| CLI | The `@nis/create` command-line tool that scaffolds and boots a new project |
| Scaffold | Output of the CLI: a rendered, installed, and bootable monorepo |
| Monorepo | Single repository hosting multiple deployable apps (`apps/*`) and shared packages (`packages/*`) |
| App Router | Next.js routing model based on filesystem under `app/` (Next 13+) |
| Headless CMS | Content management system exposing content over an API rather than rendering pages directly |
| Dynamic Zone | Strapi field type that accepts an editor-composed list of typed components |
| BlockRenderer | Next-side component that maps a Dynamic Zone entry's `__component` discriminator to a React component |
| Type sync | Generator that introspects Strapi content types and emits `.d.ts` into `packages/types` |
| Whitelabel | Property that all brand strings/assets are externalized in `nis.config.json` so rebranding is a one-file change |
| Managed deploy | Deploy path using Vercel (`apps/web`) + Strapi Cloud (`apps/cms`) |
| Self-hosted deploy | Deploy path using `docker-compose.yml` for `apps/cms` + Postgres + reverse proxy |
