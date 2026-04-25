---
title: "PRD — Next in Site (cms-scaffold-cli)"
internal_name: cms-scaffold-cli
codename: nis
public_name: Next in Site
status: in progress
created_at: 2026-04-19
updated_at: 2026-04-25
---

# PRD — Next in Site

## 1. Purpose

**Pitch:** a one-command CLI that scaffolds a production-ready, full-stack codebase for content-driven sites in under 2 minutes — opinionated end-to-end, no boilerplate to assemble.

**Audience:** full-stack developers building content-driven sites and platforms who don't want to rebuild the same stack on every project. Agency tech leads who need a standard baseline across teams.

**Why now:** the modern alternatives solve only parts of the problem (headless CMS without front-end, front-end frameworks without CMS, or all-in-one platforms with vendor lock-in). There's an open window for an opinionated, open scaffold that ships the whole package.

**Edge:**
- Type-safe contract between CMS and front-end out of the box
- Dynamic block system so editors compose pages without developer changes
- Bilingual documentation (en / pt-BR)

## 2. Features (MVP)

**Must Have**
- F1 — Single command generates the project and boots the local environment
- F2 — Pre-configured monorepo layout (front-end app, CMS app, shared packages)
- F3 — Shared type contract between CMS and front-end (auto-synced during development)
- F4 — Dynamic block system with sample blocks editors can compose
- F5 — Multi-language content and routing ready on day one
- F6 — Deploy guide for managed and self-hosted scenarios
- F11 — Whitelabel-by-design: all brand strings/assets (product name, CLI command label, tagline, primary color, logo, repo/docs URLs) centralized in a single config file consumed by templates, README, CLI banner, landing, and generated `package.json`. Enables zero-friction rebrand and agency forks.

**Should Have**
- F7 — Admin authentication ready out of the box (no custom auth needed)
- F8 — Basic SEO defaults (meta tags, sitemap, robots)
- F9 — Utility-first styling configured (no opinionated design system imposed)

**Post-MVP (v1.1+)**
- F10 — Opt-in CLI telemetry to inform roadmap (deferred from MVP; see Decision 3)

## 3. Release Criteria (v0.1)

**Targets (3 months):**

| Category | Metric | Target |
|---|---|---|
| Engagement | External PRs | ≥ 20 |
| Engagement | `create` → first deploy | ≤ 30min |
| Engagement | Dev NPS | ≥ 30 |
| Quality | Generated-site Core Web Vitals | LCP <2.5s, CLS <0.1 |
| Quality | Releases without critical regression | 100% |

**Out of scope for MVP:** SaaS / hosted offering, WYSIWYG page builder, theme marketplace, custom RBAC, advanced technical SEO, prebuilt design system, alternative front-end frameworks.

## 4. Schedule

- **Team:** 2 full-time devs, no dedicated designer
- **Deadline:** v0.1 in 3 months (July/2026)
- **License:** open-source MIT

## 5. Decisions

1. **License:** MIT — aligned with the JS/Node ecosystem (Next.js, Vite, Astro, etc.) and reduces friction for adopters' legal review.
2. **Distribution name (npm):** `@nis/create` — invoked as `npm create @nis@latest`. Scoped name avoids trademark proximity with Next.js and protects against squatting. Scope availability checked via registry (`@nis/*` returns 0 results); final reservation requires creating the `nis` organization on npmjs.com while logged in.
3. **Telemetry (F10):** deferred to v1.1. Keeps MVP scope tight; pre-traction telemetry has low signal. Early roadmap input via GitHub activity and qualitative interviews.
4. **Community:** GitHub Discussions only at launch. Indexable, asynchronous, low moderation cost for a 2-dev team. Reassess Discord post-v0.1 if there is recurring demand for synchronous chat.
5. **Branding:** founders decide a minimum-viable identity (wordmark, one primary color, single-scroll landing). Project is **whitelabel-by-design** — all brand strings/assets centralized in a single config so rebranding (or fork-and-rebrand by agencies) is a one-file change. Removes the "Next in Site" trademark risk as a blocker.
6. **Governance:** `CODEOWNERS` enabled at launch (auto-assign reviewers; initial rule `* @founder1 @founder2`). DCO sign-off (`git commit -s`) enforced via the official **DCO GitHub App** (https://github.com/apps/dco) for lightweight provenance — no Action wiring needed, just install on the repo. RFC process and CLA deferred — revisit RFC after consistent external contribution volume; CLA only if the project ever moves to dual-licensing.
