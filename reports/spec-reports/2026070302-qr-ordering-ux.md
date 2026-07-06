# Spec Report — QR Ordering UX Polish

Date: 6 July 2026 | Session: interactive finalize

## What Was Delivered

Three usability fixes to the shipped QR / dine-in feature:

- **View a table's QR without regenerating it.** The admin Tables page now shows **View QR** once a table has a code and **Generate QR** only when there is none. **Regenerate** lives inside the modal behind the printed-code invalidation confirmation.
- **A visible, site-wide "Ordering for {table}" banner.** After a diner scans a table QR, the storefront shows a persistent banner on the menu and every page with a **Leave table** action.
- **The dine-in table binding survives a refresh.** The context is persisted to per-tab `sessionStorage`, so refreshing the menu keeps the table attached.

## Finalization Audit

No bugs, missing functionality, or regressions were found after reading the implementation and related test files end-to-end.

Files audited:

- `packages/server/src/controllers/table.controller.ts`
- `packages/server/src/routes/location.routes.ts`
- `packages/server/src/lib/qr.ts`
- `packages/server/src/__tests__/integration/table.test.ts`
- `packages/server/src/__tests__/unit/qr-token.test.ts`
- `packages/admin/src/pages/TableList.tsx`
- `packages/admin/src/lib/api.ts`
- `packages/storefront/src/context/CartContext.tsx`
- `packages/storefront/src/components/DineInBanner.tsx`
- `packages/storefront/src/components/Layout.tsx`
- `packages/storefront/src/pages/TableLanding.tsx`
- `packages/storefront/src/pages/Checkout.tsx`
- `packages/storefront/src/pages/OrderConfirmation.tsx`
- `packages/storefront/src/main.tsx`
- `packages/storefront/src/i18n/locales/en.json`
- `e2e/storefront/dine-in.spec.ts`
- `packages/docs/features/qr-ordering.md`

## Verification Results

- `npm run test -w packages/server -- src/__tests__/integration/table.test.ts` — 27 passed
- `npm run test:unit` — 51 passed
- `npm run test:integration -w packages/server` — 310 passed
- `npx tsc --noEmit -p packages/server` — passed
- `npx tsc -b` in `packages/admin` — passed
- `npx tsc -b` in `packages/storefront` — passed
- `npm run build` — passed for shared, server, admin, and storefront

Verification limitations:

- `npm run lint` does not currently run because the repository has no ESLint configuration for the configured command; ESLint exits before checking files.
- `npx playwright test e2e/storefront/dine-in.spec.ts --project=storefront` was attempted, but Playwright could not launch/install Chromium on this host because this Playwright version reports no Chromium support for `ubuntu26.04-x64`.

## How to Verify Manually

1. **Admin View QR**: Admin -> Locations -> a location -> Tables. A table with a code shows **View QR**; opening it does not rotate the token. **Regenerate** is inside the modal.
2. **Dine-in banner**: open `http://localhost:5174/t/dev-table-1-qr`; the menu shows **Ordering for Table 1** site-wide.
3. **Persistence**: refresh the menu; the banner remains. Click **Leave table**; it disappears.
4. **API**: `GET /api/locations/:locationId/tables/:tableId/qr` returns `{ qrToken, url }` without rotating and `404` if no code exists.

## Closeout

All four implementation phases are complete and the spec has been moved to `specs/completed/qr-ordering-ux.md` with status `Complete`.
