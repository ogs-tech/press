# Deploying press (Spec 5)

press ships two documented deploy paths: a **self-hosted Docker Compose** stack
(recommended — low/no recurring cost) and a **managed** path on Strapi Cloud +
Vercel. Both run the same production shape; pick by budget and ops appetite.

## TL;DR + deploy order

A press project has two deployable halves:

- the **cms host** (`cms/`) — a committed Strapi 5 app. It owns the public origin,
  the database, the uploaded media, and every secret.
- the **web host** — a Next 15 app that **does not exist in the repo**. It is
  materialized to `.press/web/` by `press build` from the engine template, and is
  never committed. You don't "point a platform at a Next app" — you build it, then
  run it.

**Deploy order is fixed: cms first, then web.** The web host reads `CMS_URL` at
*runtime* (per request) for both its API fetch and the hero image `src` it emits
into the browser-loaded HTML — so `CMS_URL` must point at the **public** cms
origin, and the cms must be up before web is wired to it.

## Prerequisites

- **Node 20** and **pnpm 10** on the build host.
- Access to the private `@press/*` registry (an `.npmrc` with the scope route + a
  token). `press create` writes the `.npmrc`; the registry is where your build
  installs the engine from.
- **Self-hosted:** Docker + Docker Compose on the build/run host.
- **Managed:** a Strapi Cloud account and a Vercel account.
- A **domain** for a real (non-local) deploy, so the single public origin can serve
  HTTPS.

## Self-hosted (recommended)

`press create` drops a `deploy/` kit into your project: `docker-compose.yml`
(Postgres + cms + web + a Caddy single-origin proxy + a one-shot seed),
`Dockerfile.cms`, `Dockerfile.web`, a `Caddyfile`, and `.env.deploy.example`.

### Steps

```bash
# 1. Build both halves on the host (materializes .press/web, strapi build, next build).
press build

# 2. Fill in the deploy env. Generate every secret with: openssl rand -base64 16
cp deploy/.env.deploy.example deploy/.env.deploy
#    Set PUBLISH_PORT + CMS_URL to your domain for production, e.g.
#      PUBLISH_PORT=443  CMS_URL=https://example.com   (with a hostname Caddyfile)
#    or leave the defaults (8080 / http://localhost:8080) to try it locally.

# 3. Bring the stack up (Postgres -> seed -> cms -> web -> Caddy).
docker compose -f deploy/docker-compose.yml --env-file deploy/.env.deploy up -d --build

# 4. Open the public origin.
open http://localhost:8080     # or your domain
```

### Why a single origin, and why `CMS_URL` is the public origin

The web host's hero block resolves the image `src` **absolutely** against `CMS_URL`
(`new URL(image.url, CMS_URL)`), and that `src` is embedded in HTML the **browser**
loads. If `CMS_URL` were an internal Docker hostname (`http://cms:1337`), the
server-side API fetch would still work container-to-container, but the browser
could never load the media. The kit therefore routes **both** web and cms through
**one Caddy origin** (`:8080`): Caddy sends `/api/*`, `/admin*`, `/uploads/*`,
`/content-manager/*`, etc. to `cms:1337` and everything else to `web:3000`. One
`CMS_URL` (the public origin) then satisfies the server-side fetch *and* the
browser-loaded image — which is exactly the contract the deploy smoke harness
asserts.

### build-then-ship and the same-arch caveat

The Dockerfiles **copy the host-installed `node_modules` and the build artifacts**
(`.press/web/.next`, the built Strapi admin) and only *run* them — they do not
install or build inside the image. This keeps the private `@press/*` registry auth
out of the image and makes the build fast.

The trade-off: the image is **architecture-coupled to the build host**. Native
modules (`sharp` for image processing, `better-sqlite3`) are compiled for the build
platform. **Build on the same OS/arch you run on** — e.g. build on a Linux VPS (or
in CI) and run the Linux containers there. Building on macOS and shipping to a Linux
server will fail at runtime (the darwin native binaries cannot load in the Linux
container). If you must build cross-platform, switch to a registry-install image
(install `@press/*` inside the Dockerfile with the registry token) instead of
build-then-ship.

> The cms host depends on **`pg`** (added to `cms/package.json`) — Strapi 5 does not
> bundle database drivers, and `DATABASE_CLIENT=postgres` needs `pg` present. sqlite
> dev keeps using `better-sqlite3`.

### Persistence

- **Database:** Postgres data lives on the named `db-data` volume — it survives
  `up`/`down` (but `down -v` wipes it).
- **Uploaded media:** files land on the **cms container's disk** (`cms/public/uploads`),
  which is *not* a volume by default — a redeploy loses them. For anything real,
  mount a volume for `cms/public/uploads` (add it to the `cms` service in
  `docker-compose.yml`) or configure a Strapi upload provider (S3, Cloudinary, …).

### Verify

The self-hosted path is reproduced end-to-end, in production mode against Postgres,
by the deploy smoke harness:

```bash
pnpm deploy:smoke
#  → "DEPLOY SMOKE PASS: Postgres-backed cms + production Next web rendered
#     hero + callout + whitelabel head through Caddy."
```

(It is also gated in CI by `.github/workflows/deploy-smoke.yml`, which runs on
Linux — the same-arch happy case.)

## Managed (Strapi Cloud + Vercel)

A fully managed path, at a recurring cost: roughly **~US$18/mo** (Strapi Cloud
Essential) **+ ~US$20/mo** (Vercel Pro, for commercial use) ≈ **~US$38/mo** for a
real site. Free tiers exist for trials.

**cms → Strapi Cloud.** Deploy the `cms/` app. Strapi Cloud provisions Postgres for
you; set the same secrets (`APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`,
`TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`) in its environment settings.
Note its public origin — that's your `CMS_URL`.

**web → Vercel.** This is where the materialized-host wrinkle matters: there is **no
committed Next app** for Vercel to detect. Configure the project explicitly:

- **Build Command:** `pnpm press build`
- **Output Directory:** `.press/web/.next`
- **Install:** add the `@press/*` registry token via `.npmrc` + a `NPM_TOKEN`
  environment variable so the private engine installs.
- **Environment:** set `CMS_URL` to the **live Strapi Cloud origin** (public).

Deploy cms first, then web wired to that origin.

> This path is **documented but not covered by the smoke harness** — CI has no paid
> Strapi Cloud / Vercel accounts. Follow the steps manually and verify the rendered
> page loads the hero media from the Strapi Cloud origin.

## AWS / other clouds

The self-hosted Compose stack runs unchanged on any VM — EC2, Lightsail, Hetzner,
DigitalOcean. Provision a Linux box, install Docker, build on it (same-arch), and
run `docker compose up`. A first-class AWS-native path (ECS + RDS + Amplify/CloudFront)
is future work and out of beta scope.

## Troubleshooting

- **Hero image 404 / media won't load in the browser:** `CMS_URL` is not the public
  origin (or points at an internal Docker hostname). It must be the same public
  origin the browser uses. Re-check `deploy/.env.deploy`.
- **`strapi start` exits with `Cannot find module 'pg'`:** the cms host is missing
  the Postgres driver. `press create` now adds `pg`; for an older project, add
  `"pg"` to `cms/package.json` dependencies and reinstall.
- **Container boots but crashes loading `sharp` / `better-sqlite3`:** you built on a
  different OS/arch than you're running (the build-then-ship same-arch caveat).
  Build on the target platform (or in CI), or switch to a registry-install image.
- **Missing-secret errors on cms boot:** every Strapi secret is **required** in
  production. Generate each with `openssl rand -base64 16` and fill
  `deploy/.env.deploy` (and `cms/.env` for the managed/non-Compose path).
- **sqlite in production:** don't. sqlite is dev-only and ephemeral on managed hosts.
  The deploy kit defaults to Postgres for exactly this reason.
- **Seed didn't run / no `home` page:** the one-shot `seed` service must complete
  before `cms` serves traffic (the programmatic seed needs the server *down*).
  Check `docker compose logs seed`.
