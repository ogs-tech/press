# Plugin/Forms — Design Decisions

> Cited from code as `plugin-forms Spec §N`. Per repo convention, this doc may
> be removed after merge — CLAUDE.md is the living architectural reference for
> these decisions.

**Goal:** lead capture as the engine's fifth plugin — an editor-configurable
form block, a public submission endpoint that validates against the stored form
definition, and a plugin-owned collection where the leads land. **This is the
first plugin that installs its own entity**, the case CLAUDE.md has been
reserving for exactly this scenario.

**Depends on:** Base/Plugin (the `plugins/<id>/` structure,
`PLUGIN_DEFINITIONS`), Base/Components (the palette + `preset-organism.*`
placement), Plugin/Legal (the seeded privacy-policy page the consent checkbox
links to), Composition trees (the endpoint resolves the form definition by
walking a stored `PressTree`).

**Consumed by:** the OGS site (contact).

## Corrections to the originating brief

**Plugin/SMTP is gone.** The brief's scope said "Notificação: consome
Plugin/SMTP → o lead chega por EMAIL" and its DONE required delivery by mail.
That task was removed from the CRM: **submissions are read in the CMS**. Three
consequences, all reductions:

1. No transport dependency, no `Plugin/SMTP` blocker.
2. The Site Settings config loses its "destinatário" (recipient) field.
3. DONE becomes "submission stored and readable", not "submission delivered".

**This changes a design weight, not just scope.** With no email, the Content
Manager is not an archive — it *is* the inbox. Everything about how a submission
is stored is therefore judged by how it reads in a list view (§1.3, §4.4).

## §1 — CMS schema

### §1.1 — `preset-molecule.form-field` (nested-only)

The editor defines the fields. `molecule` is the right layer and carries the
right behavior for free: `NON_PLACEABLE` already excludes every
`(preset|custom)-molecule` category from the builder palette, so a field can
only ever exist inside a form, never as a standalone block.

| field | type | notes |
| --- | --- | --- |
| `label` | string, required | shown to the visitor |
| `name` | string, required | the key under which the value is stored in `data` |
| `type` | enumeration, default `text` | **closed set: `text`, `email`, `textarea`, `tel`, `number`** |
| `required` | boolean, default `false` | enforced on the server (§4.3), not just the client |
| `placeholder` | string | optional |

The type set is closed deliberately, and kept to types whose validation is
unambiguous server-side. `select`/`radio`/`checkbox-group` would each need a
repeatable options sub-component and an "is this value one of the allowed ones"
rule; they are out of scope (§Out of scope), and adding one later is additive.

### §1.2 — `preset-organism.form` (placeable)

| field | type | notes |
| --- | --- | --- |
| `name` | string, required | **the endpoint's address for this form** (§4.2) — editorial, not a node id |
| `title` | string | optional heading above the fields |
| `description` | text | optional |
| `fields` | repeatable `preset-molecule.form-field` | the definition the server validates against |
| `submitLabel` | string | defaults to the Site Settings value when empty |

The block deliberately does **not** carry success/error/consent copy. Those are
identical across every form on a site, so they live once in Site Settings
(§1.4) — the "curated primitives, one source per value" line this engine keeps
drawing. Per-form message overrides are additive if a real need appears.

### §1.3 — `plugin::press-cms.submission` (the first plugin-owned entity)

`collectionType`, `draftAndPublish: false`. Follows the `plugin` content-type's
read-only recipe: full `config.settings` (the shape must be complete —
`bulkable`/`filterable`/`pageSize`/`searchable`/`mainField` — a partial override
is not accepted by Strapi) and `editable: false` on every field, because nobody
should edit a received lead.

| field | type | notes |
| --- | --- | --- |
| `formName` | string, required | which form |
| `pageSlug` | string, required | which page it was submitted from |
| `data` | json, required | **the source of truth** — every submitted value |
| `submittedBy` | string | **derived** (§4.4); `mainField` |
| `summary` | text | **derived** (§4.4) |
| `consentedAt` | datetime, required | the LGPD proof (§6) |

**Deliberately NOT stored:** IP address and user-agent. The IP is used
transiently for rate-limiting (§5) and never persisted — a plugin that exists
partly to honour LGPD should not quietly accumulate more personal data than the
visitor filled in.

**Write-only over HTTP.** The submission routes are `POST`-only: no public `GET`
is registered for this collection, and none may be added. Every other engine
route is a public read (`/api/pages`, `/api/press/schema`, `/api/site-setting`),
so this is the one content-type where that reflex is wrong — the rows are
third-party personal data. Reading them is the Content Manager's job, behind
admin authentication. A guard test pins the route table (§8).

### §1.4 — `preset-config.forms` (`site-setting.forms`)

| field | type | notes |
| --- | --- | --- |
| `enabled` | boolean, default `true` | gates rendering **and** the endpoint (§7) |
| `consentLabel` | string | the checkbox text; the privacy link is appended (§6) |
| `submitLabel` | string | default for blocks that leave it empty |
| `successMessage` | text | shown after a successful submit |
| `errorMessage` | text | shown on any failure — deliberately one message (§4.5) |

`PLUGIN_DEFINITIONS` gains one row: `{ id: 'forms', label: 'Forms',
configHost: 'site-setting.forms', defaultEnabled: true, readEnabled: (site) =>
site?.forms?.enabled }`.

## §2 — Types and mapper (web side)

`packages/web/src/plugins/forms/` — `types.ts`, `default-forms.ts`,
`map-forms.ts`, mirroring `plugins/legal/`. `ResolvedPressConfig.plugins` gains
a required `forms: ResolvedFormsPlugin` key; the plugin carries the synthetic
`urn:plugin:forms` identity of `PressPlugin<'forms'>`. The mapper is FAIL-OPEN
on presentation values (labels and messages fall back to defaults), matching
`mapLegal`/`mapSeoPlugin`.

## §3 — The form block (web)

`preset-organism.form` renders through a `'use client'` component — **the
engine's third client component**, after `MobileNav` and `CookieConsentBanner`.
The exception is justified on the same terms as those two: a form is inherently
stateful (field values, in-flight submit, success/error), and no server-only
approach expresses it.

States: `idle → submitting → success | error`. On success the fields are
replaced by `successMessage`; on error the message is shown and the values are
kept so nothing typed is lost.

The submit button is disabled until the consent checkbox is ticked — the
client-side half of §6, with the server half in §4.3.

## §4 — The endpoint

`POST /api/press/forms/submit`, registered in `routes/content-api/index.ts`
with `config: { auth: false, prefix: '' }` — the same mechanism the existing
read routes use, so the contract lives entirely in engine code and needs no
users-permissions role clicks from the adopter.

### §4.1 — Request

```jsonc
{
  "page": "contact",         // page slug
  "form": "contact-main",    // the block's editorial `name`
  "values": { "email": "ana@acme.com", "message": "…" },
  "consent": true,
  "hp": "",                  // honeypot — must be empty
  "t": 1754063200000         // render timestamp — time-trap
}
```

### §4.2 — Resolving the form definition

**The server never trusts a definition sent by the client.** It loads the
PUBLISHED page by slug and walks its stored `PressTree` for a `BlockNode` with
`component === 'preset-organism.form'` and `data.name === form`. When the page's
header/footer slot is `inherit`, the corresponding Site Settings `pageDefaults`
slot is walked too, so a form placed in inherited chrome is addressable — the
same resolution the renderer performs.

**Why an editorial `name` and not the node id.** A `BlockNode.id` is a
builder-minted UUID that CLAUDE.md defines as a React key and a builder-mutation
address, explicitly *not* a durable identity; addressing forms by it would
promote it to exactly what it is not, and the address would break silently when
an editor deletes and re-adds the block. A `name` is content — the same
reasoning that keeps a page's `slug` distinct from its `documentId` — so this
adds no member to `Entity`.

**Duplicate names.** The walk takes the first match. Two forms sharing a `name`
on one page is an editor error; it surfaces as a validation rejection (values
checked against the wrong field list) rather than a silently mis-stored lead.
Accepted limitation, logged server-side.

### §4.3 — Validation

Against the resolved `fields[]`, in order — all fail-closed:

1. Unknown key in `values` → reject. (Nothing outside the definition is stored.)
2. `required` field missing or empty → reject.
3. `type: 'email'` → format check; `type: 'number'` → parse check.
4. Per-value length cap and a total payload cap (a public write endpoint is a
   DoS surface; §5).
5. `consent !== true` → reject (§6).

### §4.4 — Derived columns

`data` stays the source of truth; the server *additionally* writes two indexed
columns so the Content Manager list is readable:

- `submittedBy` ← the value of the first field whose `type` is `email`, else the
  first non-empty value.
- `summary` ← the first `text`/`textarea` value, truncated.

This restores sorting, search and a meaningful `mainField` without constraining
what the editor may ask for. **Accepted cost:** derived values are a snapshot —
if the form definition changes later, old rows keep the derivation made at write
time. That is correct for an inbox (the row reflects what arrived) and is
documented rather than reconciled.

### §4.5 — Response

`{ ok: true }` on success — the stored record is never echoed back. Every
failure returns the same generic 400 and the single `errorMessage`: a public
endpoint that distinguished "no such form" from "invalid value" would let an
attacker enumerate the site's forms and field definitions. Real causes are
logged server-side.

## §5 — Anti-spam

Three local mechanisms, **no external dependency**:

1. **Honeypot** — a visually hidden field a bot fills and a human does not.
2. **Time-trap** — a minimum elapsed time between render and submit.
3. **Rate limit** — per-IP, in memory.

A hosted captcha (Turnstile/reCAPTCHA) was rejected: it would send visitor
signals to a third party *before* the visitor consents to anything, which is a
direct conflict with the plugin's own consent gate and with Plugin/Legal's
purpose — it would need a consent category loaded before the form could even be
protected.

**Stated limitations**, so nobody mistakes this for real protection:

- The time-trap's `t` is **client-supplied and therefore forgeable** — a bot that
  sends a plausible timestamp walks past it. It costs one field and stops
  scripted replays that submit instantly; it is not a control.
- The honeypot fails against any bot that renders CSS.
- The rate limit is per-process in memory, so it weakens across multiple
  instances and resets on every boot.

All three are accepted for the MVP: they raise the cost of naive abuse to
roughly zero-effort-defeated-only-by-effort, without sending a single visitor
signal to a third party. A pluggable captcha provider is the escalation path if
real abuse appears — and the rate limit is the piece to move to shared storage
first, since it is the only one that degrades with scale rather than with
attacker skill.

## §6 — LGPD consent

The checkbox is **mandatory**, enforced on both sides — the client disables
submit until it is ticked, and the server rejects `consent !== true`
independently. `consentedAt` is stamped server-side at write time; a
client-supplied timestamp would be worthless as proof.

The label comes from Site Settings `consentLabel`, with a link to the
**privacy-policy page Plugin/Legal seeds**. Resolution is a page lookup by the
`privacy-policy` slug, so it survives renames and degrades to a plain
non-linked label when the page is absent (Legal disabled, or the page deleted) —
the form must never fail to render because a link target is missing.

Making consent optional was rejected: it would make "collect PII without a legal
basis" a supported configuration of the engine.

## §7 — Error handling

**This is the engine's first write path, and it inverts the prevailing
posture.** The read-path plugins are fail-OPEN by design — a malformed Site
Settings value degrades to a default so the site still renders. A submission
endpoint is fail-CLOSED: anything unverified is rejected, because storing a bad
lead is worse than dropping one.

- Plugin disabled → the block renders nothing **and** the endpoint rejects.
  Both, not either: a stale page in a CDN cache must not be able to write.
- Form not found / page unpublished → generic 400 (§4.5).
- Missing privacy-policy page → the consent label renders unlinked; submission
  still works (§6).
- A storage failure → generic 400; the visitor is told it failed rather than
  shown a success message for a lead that was never saved.

## §8 — Testing

cms (vitest, mocked `strapi.documents`):

1. **The tree walk finds a form by `(pageSlug, name)`** — including one nested
   deep inside rows/columns, and one in an inherited chrome slot.
2. Unknown key, missing `required`, bad email, bad number → each rejected.
3. `consent !== true` → rejected, nothing written.
4. Honeypot filled → rejected. Submit faster than the time-trap → rejected.
5. Derived `submittedBy`/`summary` computed from the right fields.
6. Plugin disabled → endpoint rejects even with a valid payload.
7. Every failure path returns the identical generic response (no enumeration).
8. Nothing outside the definition reaches `data`.
9. **Route-table guard:** the registered content-api routes expose no `GET` for
   `submission` (§1.3). Cheap to assert, and it catches the one mistake whose
   cost is leaking third-party personal data.

web (vitest): `map-forms.test.ts` (fail-open mapping) and the block's
interactive states under `// @vitest-environment jsdom`, using the hand-rolled
`act()`+`createRoot` harness the mobile-nav tests established rather than
adding `@testing-library/react`.

Gate: `pnpm -r --if-present typecheck` + `pnpm -r test`.

## Out of scope (deliberate)

- **Email notification / Plugin/SMTP** — removed from the roadmap; leads are read
  in the CMS.
- **CRM (Zoho) integration** — the brief already marked it post-MVP.
- Field types beyond the five (`select`, `radio`, checkbox groups, file upload).
- Multi-step forms, conditional fields, per-form message overrides.
- A custom admin view for submissions — the derived columns (§4.4) buy list
  readability at a fraction of the cost.
- Export (CSV) and retention/erasure tooling. Worth flagging: an LGPD erasure
  request currently means deleting the row by hand in the Content Manager.
- Hosted captcha (§5).

## Versioning

- `@ogs-tech/press-cms` — **minor**: two components, one content-type, one route.
- `@ogs-tech/press-web` — **major**: a new required key in
  `ResolvedPressConfig.plugins`, the documented discipline for every new plugin.

## CLAUDE.md updates this invalidates

To apply **with the implementation**, not before (the repo's established
pattern — see commits `c0efa82`, `108cc5a`):

- L504 "Three real plugins ship today" and L501's `plugins` key list.
- L528–529 "`<CookieConsentBanner>`, the engine's SECOND client component after
  MobileNav" → the form block is the third.
- L544 "Legal did NOT install its own entities… a future plugin with genuinely
  plugin-owned records (form submissions…) is still where that contract would
  first pay for itself" → this is that plugin.
- The palette lists: `preset-organism.form`, `preset-molecule.form-field`,
  `preset-config.forms`, and the `submission` content-type.
