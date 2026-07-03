# Spec Report — QR Ordering UX Polish

Date: 3 July 2026 | Session: interactive

## What Was Delivered

Three usability fixes to the shipped QR / dine-in feature, found while actually using it:

- **View a table's QR without regenerating it.** The admin Tables page now shows **View QR** once a table has a code (opens the existing QR, no rotation) and **Generate QR** only when there's none. **Regenerate** moved *inside* the modal, behind its "invalidates printed codes" confirm. Previously the only action always rotated the token — so you couldn't reprint a code without invalidating it.
- **A visible, site-wide "Ordering for {table}" banner.** After a diner scans a table QR, a banner now appears on the menu and every page (with a **Leave table** action), so it's obvious the scan worked. Before, the scan silently redirected to the menu with no feedback — it looked broken even though it wasn't.
- **The dine-in table binding survives a refresh.** The context is persisted to `sessionStorage`, so refreshing the menu or reopening the QR link keeps the table attached instead of silently dropping it.

## Spec Phases Completed

- Phase 1: Server — read-only QR endpoint ✅
- Phase 2: Admin — view vs regenerate ✅
- Phase 3: Storefront — visible & durable dine-in context ✅
- Phase 4: Tests & docs ✅

All phases complete. (Spec remains `In Progress`; `/wf:finalize` closes it out.)

## How to Verify

Rebuild admin + storefront from `feat/qr-ordering-ux` (or `npm run dev:admin` / `dev:storefront` for hot-reload against the running Dockerized API+DB):

1. **Admin View QR**: Admin → Locations → a location → Tables. A table with a code shows **View QR** → modal opens with the *existing* QR (token unchanged). **Regenerate** is inside the modal.
2. **Dine-in banner**: open `http://localhost:5174/t/dev-table-1-qr` → the menu shows an **"Ordering for Table 1"** banner site-wide.
3. **Persistence**: refresh the menu → the banner is still there. Click **Leave table** → it disappears.
4. **API**: `GET /api/locations/:locationId/tables/:tableId/qr` (staff) returns `{ qrToken, url }` without rotating; `404` if no code yet.

## Technical Changes

### Server (packages/server)
- `src/controllers/table.controller.ts`: add `getTableQr` (read-only; 404 when no token / table missing).
- `src/routes/location.routes.ts`: `GET /:locationId/tables/:tableId/qr` (staff), registered before the POST rotate route.
- `src/__tests__/integration/table.test.ts`: 4 tests for the GET endpoint (returns url + no `update`; 404s; auth).

### Admin (packages/admin)
- `src/pages/TableList.tsx`: **View QR** (GET) vs **Generate QR** (POST) by `qrToken`; `handleViewQr`; **Regenerate** button in the modal; `QrModalState` gains `table`.

### Storefront (packages/storefront)
- `src/context/CartContext.tsx`: `dineIn` persisted to `sessionStorage` (lazy hydrate, write-through wrapper, cleared via `clear()`).
- `src/components/DineInBanner.tsx` **(NEW)**: site-wide banner.
- `src/components/Layout.tsx`: render `DineInBanner` under the header.
- `src/i18n/locales/en.json`: `dineInBanner.ordering/leave`.

### Tests / Docs
- `e2e/storefront/dine-in.spec.ts`: banner visible after scan + survives reload.
- `packages/docs/features/qr-ordering.md`: View-QR flow, Regenerate-in-modal, read-only `GET .../qr`.

## Test Results

- Full suite (`npm test`): 310 passed, 0 failed (306 + 4 new GET-qr tests).
- Type-checks: server, admin, storefront all clean.
- **Not run** (needs a running stack): the Playwright e2e (including the new banner test).

## Blockers & Unresolved Issues

- **Concurrent-session incident**: a second Claude session sharing the same git working tree ran a `git checkout` mid-Phase-3, switching this session's tree to its branch. No committed work was lost (Phases 1–2 were already committed/pushed). Recovered by moving to a dedicated **git worktree** (`/home/russell/kitchenasty-qrux`) with symlinked `node_modules`; Phases 3–4 completed there. Recommendation stands: parallel agent sessions need separate worktrees or clones.

## Remaining Work

All phases complete. This branch (`feat/qr-ordering-ux`) is stacked on `feat/local-docker-dev` → `feat/qr-ordering`. Recommended: run the storefront/admin live to confirm the banner + View QR, then `/wf:finalize qr-ordering-ux`. Sub-agent review passes (`code-reviewer`, `refactorer`, `docs-reviewer`) were not run this pass and can be run at finalize.
