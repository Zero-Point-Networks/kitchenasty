# Local Docker Dev Environment

## Status: In Progress

<!-- Status values: Draft | In Progress | Complete | On Hold | Cancelled -->
<!-- Folder must match status: draft/ | in-progress/ | completed/ | on-hold/ | cancelled/ -->

## Objective

Make `docker compose up` bring up a fully working, migrated, and seeded KitchenAsty stack on a developer's machine — so the whole app (including the new QR / dine-in flow) is usable and testable locally without manual DB setup.

## Problem Statement

The repo already has a from-source `docker-compose.yml` and per-package Dockerfiles, but the stack does **not** come up working:

1. **Migrations are never applied** — the server image's entrypoint is `CMD ["node", "packages/server/dist/index.js"]` (`packages/server/Dockerfile:46`). `docker-compose.yml` starts `postgres` + `server` but nothing runs `prisma migrate deploy`, so the server boots against an **empty database** and every query fails. The new QR migration (`prisma/migrations/20260630083351_add_qr_dine_in_ordering/`) is never applied either.
2. **No seed data** — nothing runs the seed (`prisma/seed.ts`), so there's no menu, no tables, and no `dev-table-1-qr` token / `dineInEnabled` flag — the app is empty and the QR flow can't be exercised.
3. **The runtime server image can't self-migrate** — the runtime stage runs `npm ci --omit=dev` (`packages/server/Dockerfile:36`), which excludes the `prisma` CLI and `tsx` (both dev deps). So migrate/seed cannot run from the server container; they need a step that has dev deps.
4. **QR URLs point at production** — `tableQrUrl` falls back to `DEFAULT_PUBLIC_URL` (`https://inka.kitchenasty.com`) when `PUBLIC_URL` is unset (`packages/server/src/lib/qr.ts:17`), and `docker-compose.yml` doesn't set `PUBLIC_URL`. Locally-generated QR codes would point at the prod domain.
5. **No readiness gating** — `server` has no healthcheck, so `admin`/`storefront` (`depends_on: server`, `docker-compose.yml:44`,`:54`) start before the API is ready.

## Current Architecture

### Key Files

| File | Role |
|------|------|
| `docker-compose.yml` | From-source local stack: `postgres`, `server`, `admin`, `storefront`, `docs` |
| `packages/server/Dockerfile` | Multi-stage; **builder** stage has full deps + `prisma/` + `seed.ts`; runtime stage is `--omit=dev` |
| `packages/server/package.json` | Scripts: `db:migrate` (`prisma migrate dev`), `db:seed` (`prisma db seed`); `prisma.schema` → `../../prisma/schema.prisma`, `prisma.seed` → `tsx ../../prisma/seed.ts` |
| `packages/{admin,storefront}/nginx.conf` | Proxy `/api/`, `/uploads/`, `/socket.io/` → `server:3000` (networking already correct) |
| `packages/server/src/app.ts:54` | `GET /api/health` (used for readiness) |
| `prisma/seed.ts` | Idempotent upsert seed (menu, tables incl. `dev-table-1-qr`, `orderSettings.dineInEnabled: true`) |
| `deploy/docker-compose.demo.yml` | Separate **prod/demo** stack (GHCR images + Caddy) — not touched by this spec |

The container networking is already correct (nginx proxies API/websocket to `server:3000`). The gap is purely the **database lifecycle** (migrate + seed) and a couple of env/readiness details.

## Design

Add a one-shot **`migrate`** init service and wire the stack so `docker compose up` produces a working, seeded environment. The prod images stay lean (unchanged `--omit=dev` runtime); migration/seeding runs from the Dockerfile's existing **builder** stage, which already has the Prisma CLI, `tsx`, the migrations, and `seed.ts`.

### 1. Add a `db:deploy` script (non-interactive migrations)

`packages/server/package.json` — `db:migrate` is `prisma migrate dev` (interactive, dev-only). Add a deploy variant for automation:

```json
"db:deploy": "prisma migrate deploy",
```

`prisma migrate deploy` reads the schema from the package's `prisma.schema` config (`../../prisma/schema.prisma`).

### 2. Add a one-shot `migrate` service

In `docker-compose.yml`, build it from the **builder** target of the server Dockerfile (full deps, has `tsx` + prisma CLI + `prisma/` + `seed.ts`):

```yaml
  migrate:
    build:
      context: .
      dockerfile: packages/server/Dockerfile
      target: builder
    command: sh -c "npm run db:deploy -w packages/server && npm run db:seed -w packages/server"
    environment:
      DATABASE_URL: postgresql://kitchenasty:kitchenasty@postgres:5432/kitchenasty
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"
```

`docker compose up` re-starts the exited `migrate` container on **every** invocation, so `db:seed` must be safe to re-run. It currently is **not**: `prisma/seed.ts` creates sample orders with unique `orderNumber`s (`KA-SEED-001`…`KA-SEED-015`, `seed.ts:530`) plus unguarded `deliveryZone`/`mealtime`/`reservation` creates, and `main().catch(() => process.exit(1))` (`seed.ts:739`). A second run hits the `orderNumber @unique` constraint, the migrate container exits non-zero, and — because `server` waits on `migrate: service_completed_successfully` — the stack fails to boot. See §2b.

### 2b. Make the seed re-run-safe

Convert the non-idempotent `create` calls in `prisma/seed.ts` to idempotent forms so the `migrate` service can run on every `up`:

- **Sample orders** (`seed.ts:530`): `prisma.order.createMany({ data: [...], skipDuplicates: true })` (relies on the `orderNumber @unique` constraint) — or guard the whole demo-order block behind `if ((await prisma.order.count()) === 0)`.
- **Extra delivery zones** (`seed.ts:92`,`:102`) and **mealtimes** (`seed.ts:113`,`:123`): guard each with a `findFirst`-or-create (no unique key exists on these).
- **Reservations** (`seed.ts:577`): skip when reservations already exist (count check).

The upsert-based sections (site settings, menu, tables incl. `dev-table-1-qr`, `dineInEnabled`) are already re-run-safe and stay as-is.

### 3. Gate the server on migration completion + add a healthcheck

```yaml
  server:
    # ...existing...
    environment:
      # ...existing...
      PUBLIC_URL: http://localhost:5174   # storefront origin; QR codes point here
    depends_on:
      postgres:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/api/health || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 10
```

`admin`/`storefront` change to wait for a healthy server:

```yaml
    depends_on:
      server:
        condition: service_healthy
```

### 4. Secrets & config via `.env`

Add a committed `.env.example` documenting the knobs; `docker compose` auto-loads `.env`. Keep working dev defaults so the stack runs with zero config, but allow overrides:

```
POSTGRES_PASSWORD=kitchenasty
JWT_SECRET=change-this-to-a-random-secret
PUBLIC_URL=http://localhost:5174
```

Parameterise the compose values that read from these (with `${VAR:-default}` fallbacks) so a bare `docker compose up` still works. This includes the password embedded in `DATABASE_URL` in **both** the `server` and `migrate` services — e.g. `postgresql://kitchenasty:${POSTGRES_PASSWORD:-kitchenasty}@postgres:5432/kitchenasty` — otherwise overriding `POSTGRES_PASSWORD` breaks the DB connection.

### 5. Convenience entrypoint

Add a root `docker:dev` script for discoverability:

```json
"docker:dev": "docker compose up --build",
```

### Alternatives Considered

- **Bake migrate/seed into the server runtime image** (entrypoint runs `prisma migrate deploy` on boot). Rejected: the runtime image is intentionally `--omit=dev`; adding the Prisma CLI + `tsx` bloats the prod image. A separate builder-target init service keeps prod lean while giving dev a working stack.

## Review Fixes (code-reviewer + docs-reviewer)

> - **[code-reviewer] Seed idempotency hole closed** — the 4 unguarded `menuOption.create()` calls (Caesar/Margherita option groups; `MenuOption` has no unique key) now sit behind `count(...) === 0` guards, so re-seeding no longer duplicates option groups.
> - **[code-reviewer] `smoke.sh`** — inlined the two `curl | grep` checks so `set -e` no longer exits before the diagnostic `fail` message.
> - **[code-reviewer] compose** — removed the redundant `server → postgres` `depends_on` (gating on `migrate` completing already implies postgres healthy).
> - **[docs-reviewer] README** — fixed the stale quickstart (`docker compose up -d postgres` for the hot-reload flow; added a full-stack Docker pointer).
> - **[docs-reviewer] `configuration/environment-variables.md`** — documented `PUBLIC_URL` + added it to the example `.env`.

## Implementation Order

> **Package tags**: `[infra]` denotes root-level infrastructure files (`docker-compose.yml`, `.env.example`, `scripts/`, root `package.json`) that have no owning workspace package — it is not one of the profile's six workspace packages. Tooling that validates tags against the package list should treat `[infra]` as root-scoped.

### Phase 1: Database lifecycle in Docker ✅
<!-- packages: server, infra -->

- [x] **T1.1** Add `db:deploy` (`prisma migrate deploy`) to `packages/server/package.json` `[server]` `[~1 LOC]`
- [x] **T1.2** Make `prisma/seed.ts` re-run-safe — orders via `createMany({ skipDuplicates: true })` (or count-guard), guard delivery-zone/mealtime/reservation creates `[server]` `[~30 LOC]`
- [x] **T1.3** Add the one-shot `migrate` service (builder target, runs deploy + seed) to `docker-compose.yml` `[infra]` `[~12 LOC]` — depends: T1.1, T1.2
- [x] **T1.4** Gate `server` on `migrate` completion; add `PUBLIC_URL` + server healthcheck; make `admin`/`storefront` wait for `server: service_healthy` `[infra]` `[~15 LOC]` — depends: T1.3

> **Session notes**: `db:deploy` added. Seed made re-run-safe via count-guards (delivery zones, reviews, reservation, orders loop condition uses `existingSeedOrders === 0`) and find-or-create for mealtimes (preserves `lunch`/`dinner` refs used by the idempotent `menuItemMealtime.createMany`). `docker-compose.yml`: one-shot `migrate` service (`target: builder`, runs `db:deploy` + `db:seed`); `server` gated on `migrate: service_completed_successfully` + postgres healthy, with a `wget` healthcheck and `PUBLIC_URL: http://localhost:5174`; `admin`/`storefront` wait for `server: service_healthy`. Verified: `docker compose config` valid, seed `tsc` clean, 306 tests pass. **Not run** (Docker daemon socket is permission-denied in this env): the actual `docker compose up`/build.

### Phase 2: Config & convenience ✅
<!-- depends: Database lifecycle in Docker | packages: infra -->

- [x] **T2.1** Add `.env.example` (POSTGRES_PASSWORD, JWT_SECRET, PUBLIC_URL) `[infra]` `[~6 LOC]`
- [x] **T2.2** Parameterise `docker-compose.yml` secrets with `${VAR:-default}` fallbacks — including the password component of `DATABASE_URL` in **both** the `server` and `migrate` services `[infra]` `[~8 LOC]` — depends: T2.1, T1.4
- [x] **T2.3** Add root `docker:dev` script to `package.json` `[infra]` `[~1 LOC]`

> **Session notes**: Root `.env.example` documents `POSTGRES_PASSWORD`, `JWT_SECRET`, `PUBLIC_URL` (with the phone-scanning LAN-IP note). Compose uses `${VAR:-default}` for all three; the `DATABASE_URL` password is parameterised in both `server` and `migrate`. Root `docker:dev` script = `docker compose up --build`. Verified override propagation with `POSTGRES_PASSWORD=… PUBLIC_URL=… docker compose config` (both change) and bare defaults.

### Phase 3: Smoke test & docs ✅
<!-- depends: Config & convenience | packages: infra, docs -->

- [x] **T3.1** Add `scripts/smoke.sh` — assert server health, storefront reachable, seeded menu, and `by-token/dev-table-1-qr` resolves `[infra]` `[~30 LOC]` — depends: T1.4, T2.2
- [x] **T3.2** Update `packages/docs/guide/installation-docker.md` (auto migrate+seed, `PUBLIC_URL`, ports, smoke check) `[docs]` `[~30 LOC]` — depends: T2.3
- [x] **T3.3** Update `packages/docs/self-hosting/docker-compose.md` to note the local-dev `migrate` service vs prod flow `[docs]` `[~15 LOC]` — depends: T3.2

> **Session notes**: `scripts/smoke.sh` (executable, `bash -n` clean) checks health, storefront, admin, seeded menu, and `by-token/dev-table-1-qr`. `installation-docker.md` rewritten: config is now optional (root `.env`), migrations+seed run automatically (**removed the previously-broken manual `docker compose exec server npx prisma/tsx` step — that CLI isn't in the `--omit=dev` runtime image**), added `PUBLIC_URL`, docs port 5175, and a smoke-test step. `self-hosting/docker-compose.md` got a callout pointing local-dev users to the auto-migrate flow (prod guide keeps manual migration; prod fix is out of scope).

### Phase 4: Runtime-verification fixes ✅
<!-- packages: server -->

Surfaced by the first real `docker compose up` (the migrate service ran cleanly — migrations + seed exit 0 — but the server then crashed):

- [x] **T4.1** Fix server crash `unable to determine transport target for "pino-pretty"` — `pino-pretty` is a dev-only dependency absent from the `--omit=dev` runtime image, but `lib/logger.ts` used it as a transport whenever `NODE_ENV !== production` (compose sets `development`). Now the pretty transport is used only when `pino-pretty` actually resolves; otherwise it falls back to pino's JSON output. `[server]` `[~12 LOC]`

> **Session notes**: Pre-existing latent bug exposed by the stack actually booting for the first time. Guarding on `require.resolve('pino-pretty')` fixes any `--omit=dev` non-production deployment (not just Docker) and keeps the runtime image lean (no need to promote `pino-pretty` to a prod dependency). Local dev (`npm run dev:server`, full deps) still gets pretty logs. 306 tests pass; server type-check clean. Requires a `docker compose up --build` (server image rebuild) to pick up.

## Testing Strategy

This is infrastructure; verification is smoke-testing the running stack rather than unit tests.

### Smoke Tests (`scripts/smoke.sh`, **NEW**)

Run after `docker compose up --build -d` and the server is healthy; each step exits non-zero on failure:

| Check | Command | Expected |
|-------|---------|----------|
| Server health | `curl -fsS http://localhost:3000/api/health` | `200` |
| Storefront served | `curl -fsS http://localhost:5174/` | `200`, HTML |
| Admin served | `curl -fsS http://localhost:5173/` | `200`, HTML |
| Seed applied (menu) | `curl -fsS http://localhost:3000/api/menu` | non-empty items |
| QR token resolves | `curl -fsS http://localhost:3000/api/locations/tables/by-token/dev-table-1-qr` | `200`, `tableName` present |

### Integration / E2E Tests

Optional but recommended: run the existing Playwright suite against the dockerized stack, in particular `e2e/storefront/dine-in.spec.ts` (visiting `/t/dev-table-1-qr` on `http://localhost:5174` should land on the menu). This is the on-a-real-stack verification the QR spec deferred.

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `migrate` builder-target image is large / slow to build first time | Reuses the server build cache; documented as a one-time cost. Dev-only, not shipped |
| Re-seeding on every `up` errors or overwrites data | Seed made re-run-safe in T1.2 (upserts + `skipDuplicates`/guards). Upsert rows use `update: {}` (no overwrite of edits); devs wanting a clean slate use `docker compose down -v` |
| `PUBLIC_URL=http://localhost:5174` QR codes don't resolve when scanned from a phone | Works for browser testing on the host; documented that real-device scanning needs `PUBLIC_URL` set to the host's LAN IP/origin |
| Port conflicts (5432/3000/5173/5174/5175) | Documented in the install guide; ports are the existing compose mappings |
| `service_completed_successfully` requires Compose v2 | Already assumed by the repo's compose usage; documented as a prerequisite |

## Out of Scope

- **Production / demo deployment** — `deploy/docker-compose.demo.yml`, GHCR image publishing, Caddy/HTTPS/reverse-proxy remain as-is.
- **Hot-reload dev containers** (vite dev / `tsx watch` inside Docker) — devs use `npm run dev:*` on the host for that; this spec deploys the built stack.
- **Mobile app** (Expo) — not containerised.
- **Cloud/remote dev environments**, CI pipeline changes.
- **Managing secrets beyond local defaults** (vaults, rotation) — dev defaults only.

## Files to Change

| File | Change |
|------|--------|
| `packages/server/package.json` | Add `db:deploy` script |
| `packages/server/src/lib/logger.ts` | Use `pino-pretty` transport only when it resolves (fixes crash in `--omit=dev` image) — finalize |
| `prisma/seed.ts` | Make re-run-safe (orders `skipDuplicates`/count-guard; guard zones/mealtimes/reservations) |
| `docker-compose.yml` | `migrate` service; server `depends_on` + healthcheck + `PUBLIC_URL`; `admin`/`storefront` wait for healthy server; `${VAR:-default}` secrets (incl. `DATABASE_URL` password) |
| `.env.example` | **NEW** — documented dev env vars |
| `package.json` (root) | Add `docker:dev` script |
| `scripts/smoke.sh` | **NEW** — post-up smoke checks |
| `packages/docs/guide/installation-docker.md` | Update local Docker quickstart |
| `packages/docs/self-hosting/docker-compose.md` | Note dev `migrate` service vs prod flow |
| `README.md` | Fix quickstart (`up -d postgres` for hot-reload; full-stack pointer) — docs-reviewer |
| `packages/docs/configuration/environment-variables.md` | Document `PUBLIC_URL` — docs-reviewer |

## Documentation Impact

- [x] `packages/docs/guide/installation-docker.md` — `docker compose up` now auto-migrates + seeds; `PUBLIC_URL`; ports; smoke check
- [x] `packages/docs/self-hosting/docker-compose.md` — local-dev `migrate` service vs the prod/demo compose
