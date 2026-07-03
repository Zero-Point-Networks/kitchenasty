# Spec Report — Local Docker Dev Environment

Date: 3 July 2026 | Session: interactive
Updated: 3 July 2026 | `/wf:finalize` — deep audit (no fixes needed)

## Finalization (3 July 2026)

Read every implementation file end-to-end. **No bugs, gaps, or edge cases found.** Verified exhaustively that the seed is re-run-safe: all 10 `prisma.*.create()` calls are guarded (count-checks, find-or-create, or the orders loop condition), and both `createMany` calls (`menuItemAllergen`, `menuItemMealtime`) carry `skipDuplicates: true` over composite primary keys. `docker-compose.yml`, `scripts/smoke.sh`, and the `db:deploy` script are correct. Regression check: the removed manual-migrate doc step was broken (improvement, not a loss); the README `up -d` → `up -d postgres` change fixes a pre-existing hot-reload port conflict.

Post-finalization: 306 tests pass; seed `tsc`, `bash -n`, and `docker compose config` all clean.

**Runtime verified (3 Jul 2026)** on the operator's machine (after switching from snap Docker to Docker-from-apt): `docker compose up --build` → `migrate` applied migrations + seed and exited 0; server healthy; `./scripts/smoke.sh` **all green** (health, storefront, admin, seeded menu, and the dine-in QR token `dev-table-1-qr` resolving in the live stack). Two first-boot issues were found and fixed during verification:
- **Server crash** `unable to determine transport target for "pino-pretty"` — `pino-pretty` (dev-only dep) was used as a log transport in the `--omit=dev` runtime image. Fixed `lib/logger.ts` to use it only when it resolves, else fall back to JSON logs. (Phase 4 / T4.1)
- **Smoke script** hit a non-existent `/api/menu` route (404) — corrected to `/api/menu/items`.

Spec closed out and moved to `specs/completed/`.

---

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
