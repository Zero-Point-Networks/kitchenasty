# Spec Report — Local Docker Dev Environment

Date: 3 July 2026 | Session: interactive

## What Was Delivered

`docker compose up --build` (or `npm run docker:dev`) now brings up a **fully working, migrated, and seeded** KitchenAsty stack on a developer's machine — no manual database setup. Previously the stack started against an empty database (nothing ran migrations or the seed), and the documented manual fix was itself broken (it told you to run the Prisma CLI / `tsx` inside the server container, which the lean production image doesn't include).

- Bring the whole stack up with one command; a one-shot `migrate` service applies migrations and seeds demo data automatically before the API starts.
- The stack is now usable end-to-end out of the box — including the dine-in QR flow (the seed provides table `dev-table-1-qr` and enables dine-in), which is exactly what the QR spec's e2e/migration verification needed a real stack for.
- Zero-config by default; override `POSTGRES_PASSWORD`, `JWT_SECRET`, or `PUBLIC_URL` via a root `.env`.
- A `scripts/smoke.sh` one-shot verifies the running stack.

## Spec Phases Completed

- Phase 1: Database lifecycle in Docker ✅
- Phase 2: Config & convenience ✅
- Phase 3: Smoke test & docs ✅

All phases complete. (Spec remains `In Progress`; `/wf:finalize` closes it out.)

## How to Verify

On a machine with Docker (the authoring sandbox's Docker daemon was not accessible):

1. `docker compose up --build` (or `npm run docker:dev`).
2. **Expected**: `migrate` runs deploy + seed and exits 0; `server` becomes healthy; admin (5173), storefront (5174), docs (5175) come up.
3. `./scripts/smoke.sh` → **Expected**: all checks pass (server health, storefront/admin reachable, seeded menu, `by-token/dev-table-1-qr` resolves).
4. Re-run `docker compose up` (volume preserved) → **Expected**: `migrate` re-runs the seed **without error** (idempotency) and the server starts.
5. Optionally run the dine-in Playwright e2e against the stack: visiting `http://localhost:5174/t/dev-table-1-qr` lands on the menu.

## Technical Changes

### Database / seed
- `prisma/seed.ts`: made re-run-safe — count-guards on delivery zones, menu-option groups (Caesar/Margherita), reviews, reservation; `existingSeedOrders === 0` guard on the sample-orders loop; find-or-create for `Lunch`/`Dinner` mealtimes (preserves refs used by `menuItemMealtime.createMany`).

### Server (packages/server)
- `package.json`: add `db:deploy` (`prisma migrate deploy`).

### Infrastructure (root)
- `docker-compose.yml`: one-shot `migrate` service (builds the server Dockerfile `builder` target; runs `db:deploy` + `db:seed`); `server` gated on `migrate: service_completed_successfully` with a `wget` healthcheck and `PUBLIC_URL`; `admin`/`storefront` wait for `server: service_healthy`; `${VAR:-default}` interpolation for `POSTGRES_PASSWORD` (incl. `DATABASE_URL`), `JWT_SECRET`, `PUBLIC_URL`.
- `.env.example` **(NEW)**: documented dev env vars.
- `package.json` (root): add `docker:dev`.
- `scripts/smoke.sh` **(NEW)**: post-up smoke checks.

### Documentation
- `packages/docs/guide/installation-docker.md`: rewritten — optional root `.env`, automatic migrate+seed (removed the broken manual `exec` step), `PUBLIC_URL`, docs port 5175, smoke-test step.
- `packages/docs/self-hosting/docker-compose.md`: dev-vs-prod callout.
- `README.md`: fixed quickstart (`docker compose up -d postgres` for hot-reload; full-stack Docker pointer).
- `packages/docs/configuration/environment-variables.md`: documented `PUBLIC_URL`.

## Test Results

- Unit + integration suite (`npm test`): 306 passed, 0 failed.
- `prisma/seed.ts` type-checks clean; `scripts/smoke.sh` passes `bash -n`.
- `docker compose config` valid; env-var override propagation verified.
- Type-checks: server clean.
- **Not run** (Docker daemon socket permission-denied in the authoring environment): `docker compose up` / image build, `scripts/smoke.sh` against a live stack, and the Playwright e2e. These are the on-a-real-daemon verification steps.

## Blockers & Unresolved Issues

- The authoring environment cannot reach the Docker daemon, so the full runtime path (build + up + smoke + e2e) was validated statically only. Requires one manual run on a machine with Docker.

## Remaining Work

All spec phases are complete. Recommended before merge: run `docker compose up --build` + `./scripts/smoke.sh` on a Docker-capable machine, and (optionally) the dine-in e2e. Then `/wf:finalize local-docker-dev-environment`. Note: this branch (`feat/local-docker-dev`) is stacked on `feat/qr-ordering` (PR #1); it should merge after — or together with — the QR feature.
