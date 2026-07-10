# Spec Report — Coolgardie Gold Rush Motel Branding & Menu Seed

Date: 03 July 2026 | Session: interactive

## What Was Delivered

The platform can now be provisioned with the real Coolgardie Gold Rush Motel restaurant in one command, instead of the fictional "Saffron & Sage" demo. Running `npm run db:seed:coolgardie -w packages/server` against a fresh database sets up:

- **Real venue branding** — site name/title, the prospector logo, gold (`#d4a017`) and saddle-brown (`#7c4a21`) colours, the `rustic` storefront template, and venue-written hero/features/CTA copy ("Home-Style Dining in the Heart of the Goldfields")
- **Australian operational settings** — AUD currency, Australia/Perth timezone, GST-inclusive pricing (tax rate 0), tipping off, ordering and reservations on
- **The venue itself** — 49-53 Bayley Street, Coolgardie WA, pickup only (no delivery), dinner hours 5:30–7:30 PM seven nights, one Dinner mealtime, 10 tables (44 seats)
- **The complete June 2025 menu** — 9 categories, 41 items with exact names, prices, and descriptions from the venue's PDF; choice-of-sides options on 5 mains, steak add-ons (garlic prawns +$12, sauces +$6), wings sauce and ice-cream topping choices; allergen tags on unambiguous items
- **Generated staging imagery** — 41 generic placeholder menu images stored as WebP files under `prisma/seed-assets/coolgardie-menu/`; the seed copies them to `uploads/coolgardie-menu/` and stores `/uploads/coolgardie-menu/{slug}.webp` on each menu item until venue-owned photos are uploaded
- **A venue admin account** — `admin@coolgardiegoldrushmotel.com.au` with a randomly generated password printed once to the console

The demo seed is untouched; the venue seed is additive, idempotent (safe to re-run), and its `SiteSettings` write fully overwrites existing branding so the venue always wins. Re-running the seed refreshes placeholder files but preserves non-placeholder menu image URLs, so real venue photos uploaded through admin are not overwritten.

## Spec Phases Completed

- Phase 1: Seed scaffold, branding, location ✅
- Phase 2: Menu data ✅
- Phase 3: Verification and docs ✅
- Phase 4: Generated placeholder menu imagery ✅

## How to Verify

Preconditions: a running PostgreSQL with migrations applied (`DATABASE_URL` set) — the local Docker dev environment spec (`specs/draft/local-docker-dev-environment.md`) is not yet implemented, so bring your own DB.

1. `npm run db:seed:coolgardie -w packages/server`
2. **Expected**: console prints the admin login with a one-time password and "Coolgardie seed complete — 41 menu items across 9 categories."
3. `DATABASE_URL=... npm run test:integration -w packages/server -- src/__tests__/integration/seed-coolgardie.test.ts`
4. **Expected**: 18 tests pass (they skip without `DATABASE_URL`).
5. Start the server and storefront; open the storefront.
6. **Expected**: rustic template with gold/brown branding, prospector logo, and the full menu in PDF order; each item has a generated placeholder image; Grilled Sirloin Steak shows Sides/garlic-prawns/sauce options.
7. Upload a real menu item image through admin, then re-run step 1. **Expected**: no duplicates (same counts), admin password unchanged, uploaded image URL preserved.

## Technical Changes

### Root / Prisma
- `prisma/seed-coolgardie.ts` **(NEW)**: venue seed — exported `seedCoolgardie(prisma)` plus a CLI entry guarded by `process.argv[1]` so test imports don't trigger it
- `prisma/seed-assets/coolgardie-menu/*.webp` **(NEW)**: generated placeholder source assets (41 files, 3.1 MB total) copied into runtime uploads by the seed

### Server
- `packages/server/package.json`: added `db:seed:coolgardie` script
- `packages/server/src/__tests__/integration/seed-coolgardie.test.ts` **(NEW)**: 18-test suite gated on `DATABASE_URL` (branding, settings, location/hours/tables, category/item counts, placeholder image paths and copied files, real-photo preservation, option-group content, mealtime/allergen links, admin user, idempotency snapshot)

### Documentation
- `packages/docs/configuration/database.md`: "Venue seed: Coolgardie Gold Rush Motel" section with fresh-DB usage note and generated-placeholder image behavior
- `CHANGELOG.md`: `[Unreleased]` Added entry, including generated placeholder menu imagery
- `specs/completed/coolgardie-branding-menu-seed.md`: moved from draft, aligned with current schema (see Decisions), all 15 tasks checked, session notes per phase
- `specs/draft/repair-eslint-config.md` **(NEW)**: draft spec for the pre-existing repo-wide ESLint breakage found this session

## Test Results

- Full server suite: 343 tests — **325 passed, 18 skipped** (the DB-gated seed suite; no `DATABASE_URL` in this environment), 0 failed
- TDD red confirmed: the new test failed on unresolved import before the seed existed
- Typechecks: `tsc --noEmit -p packages/server` clean
- Asset check: 41 item slugs matched 41 generated WebP files, no missing or extra assets
- VitePress docs build: green
- `npm run lint`: **fails repo-wide (pre-existing)** — no ESLint config exists anywhere in the repo; tracked in `specs/draft/repair-eslint-config.md`

## Decisions Made During the Session

- **Spec corrected against the codebase**: the spec assumed `Table.qrToken`/`dev-table-1-qr` and `orderSettings.dineInEnabled` exist — both belong to the unimplemented `specs/draft/qr-ordering.md`. Stripped from scope with cross-references; `qr-ordering.md` must extend this seed when it lands. (Independently confirmed by `spec-reviewer`.)
- **Slug collision avoided**: the venue's Grilled Salmon uses `grilled-salmon-gold-rush` because the demo seed owns the globally-unique `grilled-salmon` slug — the spec's "all slugs disjoint" claim missed this.
- **No demo+venue coexistence test**: `prisma/seed.ts` runs `main()` as an un-awaitable import side effect and stays untouched per spec; coexistence is covered by the disjoint-slug verification and the salmon-slug assertion.
- **Generated placeholders use WebP**: the first generated assets were PNG, but they were converted to compressed 900px-wide WebP files before commit (3.1 MB total instead of about 101 MB) and the seed/test/docs contract was updated to `.webp`.
- **Reseed preserves real photos**: placeholder URLs are refreshed only when the current item image is null or already under `/uploads/coolgardie-menu/`; non-placeholder image URLs uploaded through admin are left intact.

## Blockers & Unresolved Issues

- **No live database run in this environment** — no Docker daemon access, no local PostgreSQL, no passwordless sudo. The seed compiles, loads, and is fully covered by the DB-gated test suite, but the seed run + storefront walkthrough (spec's manual verification) needs to be performed against a real DB — see How to Verify.

## Remaining Work

All spec phases are complete (0 unchecked tasks). Next step: run the manual verification above, then `/wf:finalize coolgardie-branding-menu-seed` — note the CHANGELOG entry already exists per this spec's T3.2, so finalize should not duplicate it.
