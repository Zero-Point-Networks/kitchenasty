# Spec Report — Coolgardie Gold Rush Motel Branding & Menu Seed (Finalization)

Date: 04 July 2026 | Session: interactive
Updated: supersedes `2026070301-coolgardie-branding-menu-seed.md` | finalization pass after `qr-ordering` landed on main

## What Was Delivered

Finalization of the venue seed. The deep code audit found the implementation clean (no bugs, no edge cases, no test gaps) but surfaced one significant gap: **QR dine-in ordering** — the venue's primary flow — had landed on main after this branch diverged, and the cross-spec contract to extend the venue seed had no owner. That gap is now closed:

- **Main merged into the branch** — the venue branch now includes QR dine-in ordering, the local Docker setup, and everything else on main (35 commits)
- **Every seeded table gets a random, printable QR token** — a diner scanning any of the 10 tables' codes lands on the menu bound to that table. Unlike the demo seed's public `dev-table-1-qr`, tokens are random (repo-committed tokens would be guessable in production); reseeding never rotates them, so printed codes stay valid
- **Dine-in ordering is switched on** in the seeded order settings
- Databases seeded before this change are **backfilled** with tokens on the next reseed

## Spec Phases Completed

- Phases 1–4 (scaffold/branding/location, menu, verification/docs, placeholder imagery) — completed previously ✅
- Phase 5: Finalization fixes (QR dine-in provisioning) ✅ — added and completed this session

## How to Verify

1. `npm run db:seed:coolgardie -w packages/server` against a migrated DB
2. Log into admin → **Locations → Tables**: each table shows a QR code ready to print
3. Open a table's QR URL (`/t/{token}`) in the storefront. **Expected**: menu opens bound to that table; a dine-in order can be placed
4. Re-run the seed. **Expected**: tokens unchanged (printed codes still valid)
5. `DATABASE_URL=... npm run test:integration -w packages/server -- src/__tests__/integration/seed-coolgardie.test.ts` — **Expected**: 21 tests pass

## Technical Changes

### Root / Prisma
- `prisma/seed-coolgardie.ts`: table seeding switched from upsert to find/create-with-token/backfill-if-null; `newTableQrToken()` matching `lib/qr.ts` format; `orderSettings.dineInEnabled: true`; stale qr-ordering comments refreshed

### Server
- `packages/server/src/__tests__/integration/seed-coolgardie.test.ts`: +3 tests (unique random tokens, dine-in flag, token stability across reseed)

### Documentation
- `packages/docs/configuration/database.md`: venue-seed section notes QR tokens and never-rotate semantics
- `CHANGELOG.md`: venue-seed entry merged with main's Unreleased section; now mentions QR provisioning
- `specs/completed/coolgardie-branding-menu-seed.md`: Phase 5 added and checked; Design/Out of Scope updated

## Test Results

- DB-gated suite against live PostgreSQL (embedded, port 5433): **21/21 passed** (TDD: the 2 new assertions were red before the fix)
- Full server suite post-merge: **344 passed, 21 skipped** (DB-gated, when run without `DATABASE_URL`), 0 failed
- Typechecks: server `tsc --noEmit` clean; ad-hoc strict typecheck of the seed clean
- VitePress docs build: green
- `npm run lint`: still broken repo-wide (pre-existing, no ESLint config; tracked in `specs/draft/repair-eslint-config.md`)

## Decisions Made During the Session

- **Random token per table instead of `dev-table-1-qr`** (user-confirmed): the deterministic dev token is committed to the repo — seeding it in production would let anyone spoof Table 1.
- **Merge main rather than defer**: the extension contract had no owner (qr-ordering executed on main where this seed doesn't exist); per the no-deferring policy it was pulled into this spec as Phase 5.
- **Merge conflict resolutions**: CHANGELOG — both Unreleased sections kept; spec file — kept on the branch (main deliberately deletes it per `2fa0614 "keep Coolgardie seed spec off main"`).

## Remaining Work

All 5 spec phases complete (0 unchecked tasks). Spec is ready to close.

**Branch-strategy note (outside spec scope)**: main deliberately excludes the Coolgardie spec file; this branch now carries all of main plus the venue seed. If the venue seed itself is meant to reach main eventually, that's a separate decision — everything is merge-ready.
