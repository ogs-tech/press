---
title: "PRD — Next in Site (cms-scaffold-cli)"
internal_name: cms-scaffold-cli
codename: nis
public_name: Next in Site
status: Discovery
created_at: 2026-04-19
updated_at: 2026-04-26
---

# PRD — Next in Site (cms-scaffold-cli)

> [!NOTE]
> Stack, flows and technical decisions in `ARCH.md`. Delivery sequence in `ROADMAP.md`.

## 1. Problem

Full-stack devs and agency tech leads who build content-driven sites rebuild the same stack every project. Existing options solve only parts: headless CMS without front-end, front-end frameworks without CMS, or all-in-one platforms with vendor lock-in. Nobody ships an opinionated, open scaffold that wires CMS + front-end + types + dynamic blocks end-to-end.

## 2. Hypothesis

Devs and small agencies adopt a one-command CLI that scaffolds a production-ready, full-stack codebase in under 2 minutes when it removes the boilerplate phase entirely and stays open and rebrandable, in exchange for accepting an opinionated stack.

**Validation:** ≥ 20 external PRs and ≥ 100 unique installs in the first 3 months post-`v0.1`, with ≥ 1 agency forking and rebranding the scaffold for client work.

## 3. User

Single persona: **full-stack dev or agency tech lead** building content-driven sites, with two usage profiles:

- **Solo dev / freelancer** — wants a production-ready baseline they didn't have to assemble; values speed from `create` to deploy.
- **Agency tech lead** — wants a standard baseline across teams and clients; values whitelabel/rebrand support so the scaffold becomes the agency's own template.

JTBD: *"When I start a new content-driven site, I want a single command to scaffold the whole stack — CMS, front-end, types, blocks — so I can ship features instead of wiring boilerplate."*

## 4. Scope

### Must-have

- Single command generates the project and boots the local environment (`create` → running stack in ≤ 2 min).
- Pre-configured monorepo layout (front-end app, CMS app, shared packages).
- Shared type contract between CMS and front-end, auto-synced during development.
- Dynamic block system with sample blocks editors can compose without dev changes.
- Multi-language content and routing ready on day one.
- Whitelabel-by-design: brand strings/assets (product name, CLI label, tagline, primary color, logo, repo/docs URLs) centralized in a single config consumed by templates, README, CLI banner, landing and generated `package.json`.
- Deploy guide for managed and self-hosted scenarios.

### Should-have (only after must-have ships)

- Admin authentication ready out of the box (no custom auth needed).
- Basic SEO defaults (meta tags, sitemap, robots).
- Utility-first styling configured (no opinionated design system imposed).

> Should-have only starts **after** must-haves have been in real use for ≥ 1 month with ≥ 3 external adopters. If a should-have takes > 1 week to implement, it's cut and becomes post-MVP debt.

### Nice-to-have

- Opt-in CLI telemetry to inform roadmap.

## 5. Out of scope

- SaaS / hosted offering.
- WYSIWYG page builder.
- Theme marketplace.
- Custom RBAC.
- Advanced technical SEO (structured data automation, hreflang matrices, etc.).
- Prebuilt design system / component library.
- Alternative front-end frameworks (single opinionated choice in MVP).
- Custom auth providers beyond the bundled default.
- CLA / formal RFC process pre-traction.

## 6. Success metrics

- **≥ 20 external PRs** merged in 3 months post-`v0.1`.
- **`create` → first deploy ≤ 30 min** (median, measured via opt-in telemetry or qualitative interviews).
- **Dev NPS ≥ 30** from a sample of ≥ 10 adopters surveyed at 30 and 90 days.
- **Generated-site Core Web Vitals**: LCP < 2.5s, CLS < 0.1 on the default template.
- **Zero critical regressions** persisting > 1 working day across releases in the 3-month window.

**Checkpoints:** 30min retro every **2 weeks** with 3 fixed questions:

1. Are external adopters using it? (yes/no/partial — with evidence from GitHub activity, telemetry or interviews)
2. Is anything blocking adoption? (friction, bug, missing feature, doc gap)
3. Cut scope, continue or stop?

Decision logged in this PRD changelog or a dedicated file.

**Stop rule:**

- 6 calendar months without hitting validation (≥ 20 external PRs + ≥ 100 installs + ≥ 1 agency fork) → soft cap, retro decides continue / cut / stop.
- Validation reached → close discovery, decide hardening / open next phase in ROADMAP.

**Failure:** zero external PRs after 90 days post-`v0.1`, or no agency adopts the whitelabel path despite outreach to ≥ 5 qualified candidates.

## 7. Assumptions

- Two devs full-time sustain delivery pace for `v0.1` in 3 months without dedicated designer.
- MIT license is acceptable for both adopters and downstream agencies forking the scaffold.
- The chosen opinionated stack (front-end framework, CMS, type-sharing approach — defined in ARCH) remains stable enough during the 3-month window.
- npm scope `@nis` remains available and reservable on `npmjs.com`.
- GitHub Discussions is sufficient for community at launch; Discord deferred until recurring demand for synchronous chat.
- DCO sign-off via the official DCO GitHub App is acceptable to contributors as the only provenance requirement (no CLA).
