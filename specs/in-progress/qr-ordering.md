# QR Ordering (Dine-In / Scan-to-Order)

## Status: In Progress

<!-- Status values: Draft | In Progress | Complete | On Hold | Cancelled -->
<!-- Folder must match status: draft/ | in-progress/ | completed/ | on-hold/ | cancelled/ -->

## Objective

Let a guest scan a per-table QR code to open the storefront menu pre-bound to that table, place an order without staff involvement, and either pay online or pay at the counter on pickup — freeing front-of-house staff from taking orders.

## Problem Statement

1. **Ordering requires staff or a delivery/pickup address flow** — `OrderType` (`prisma/schema.prisma:333`) is only `DELIVERY | PICKUP`; there is no dine-in / scan-to-order channel.
2. **Orders aren't associated with a table** — the `Order` model (`prisma/schema.prisma:349`) has no `tableId`, even though a `Table` model already exists (`prisma/schema.prisma:472`) and is used by reservations.
3. **There is no QR entry point** — `Table` has no scannable identifier, and the storefront router (`packages/storefront/src/main.tsx:34`) has no route that resolves a table and seeds the cart with dine-in context.
4. **The create-order endpoint rejects dine-in** — `createOrderSchema` (`packages/server/src/controllers/order.controller.ts:24`) hardcodes `z.enum(['DELIVERY', 'PICKUP'])` and the delivery/pickup branches assume an address or zone.

## Current Architecture

### Key Files

| File | Role |
|------|------|
| `prisma/schema.prisma:333` | `OrderType` enum (`DELIVERY | PICKUP`) |
| `prisma/schema.prisma:349` | `Order` model (no `tableId`); supports guest fields `guestName/guestEmail/guestPhone` |
| `prisma/schema.prisma:472` | `Table` model (`locationId`, `name`, `capacity`, `isActive`), `@@unique([locationId, name])` |
| `packages/server/src/controllers/table.controller.ts` | Existing Table CRUD (mounted under `/api/locations`, see `app.ts:107`) |
| `packages/server/src/controllers/order.controller.ts:24` | `createOrderSchema`; delivery/pickup branching at `:60`, `:134` |
| `packages/storefront/src/main.tsx:34` | Storefront route table |
| `packages/storefront/src/pages/Checkout.tsx` | Checkout — order-type + payment selection |
| `packages/admin/src/pages/TableList.tsx` | Admin table management |
| `prisma/schema.prisma:581` | `SiteSettings.orderSettings` JSON (order feature toggles) |

Guest checkout already works (`optionalAuth` on `POST /api/orders`, `order.routes.ts:8`), and payment is a separate step from order creation — so "pay at counter" needs no new payment primitive: the order is simply created without an online payment, and staff settle it later (cash flow already exists via `markCashPayment`, `payment.controller.ts:245`).

## Design

A QR code encodes a stable, opaque table token in a storefront URL: `https://<storefront>/t/<qrToken>`. Scanning lands on a `TableLanding` page that resolves the token to a location + table, stores dine-in context, and forwards into the menu. At checkout the order is created as `DINE_IN` with `tableId` set; the guest chooses **pay now** (any enabled online provider) or **pay at counter** (order placed unpaid).

### 1. Schema changes

```prisma
enum OrderType {
  DELIVERY
  PICKUP
  DINE_IN
}

model Order {
  // ...existing...
  tableId String?
  table   Table?  @relation(fields: [tableId], references: [id])
}

model Table {
  // ...existing...
  qrToken String? @unique   // opaque, regenerable; encoded in the QR URL
  orders  Order[]
}
```

`SiteSettings.orderSettings` gains `dineInEnabled: boolean` to gate the feature.

`qrToken` is a random URL-safe string (e.g. 16+ bytes base64url), **not** the `Table.id`, so codes are unguessable and can be rotated without changing the primary key. Regenerating a token invalidates printed codes — surfaced in the admin UI.

### 2. Token resolution endpoint (public)

`GET /api/locations/tables/by-token/:qrToken` → `{ locationId, locationName, tableId, tableName }` (404 if not found or table inactive). Public (no auth) — it only exposes the table label and its location, no sensitive data. Add to `table.controller.ts` + the location routes.

### 3. Create-order: accept dine-in

In `order.controller.ts`:
- `createOrderSchema.orderType` → `z.enum(['DELIVERY', 'PICKUP', 'DINE_IN'])`; add optional `tableToken: z.string().optional()`.
- For `DINE_IN`: skip the address requirement (`:60`) and delivery-zone logic (`:134`, `:241`); resolve `tableToken` → `Table` (must belong to the order's location and be active) and set `order.tableId`. Reject `DINE_IN` without a valid table token (400).
- Guest dine-in needs no email by default; keep `guestName` optional so a walk-in can order anonymously. (If `orderSettings` later requires contact for ready-notifications, that's handled in the notifications spec.)

### 4. Admin — QR generation & printing

Extend `TableList.tsx`:
- Show each table's QR status; **Generate / Regenerate QR** action calls a new `POST /api/locations/:locationId/tables/:tableId/qr` that sets/rotates `qrToken` and returns the storefront URL.
- Render the QR client-side from the URL using a small dependency (`qrcode` or `qrcode.react`) — **new admin dependency** — with a print-friendly view (table name + code) so staff can print and place codes.

### 5. Storefront — landing + dine-in context

- New route `path="/t/:token"` → `TableLanding` page (`main.tsx:34`).
- `TableLanding` calls `by-token`, sets the dine-in context (see §6), then redirects to `/menu`.
- Cart/checkout (`Checkout.tsx`) reads the dine-in context: shows "Dine-in — {tableName}", hides the address step, and offers **Pay now** (enabled online providers) or **Pay at counter** (submits the order with no online payment). `tableToken` is included in the create-order payload.

### 6. Dine-in context — extend the existing `CartContext`

The storefront already has a central cart store: `packages/storefront/src/context/CartContext.tsx` exposes `CartContextType` (`items`, `addItem`, `subtotal`, `clear`, …) via `CartProvider`, already wired in `main.tsx:32`. **Extend it** rather than adding a parallel context (which would fragment cart state):

- Add `dineIn` to `CartContextType`: `{ locationId: string; tableId: string; tableName: string } | null`, plus `setDineIn(ctx)` and clear it in `clear()`.
- Add `useState` for `dineIn` in `CartProvider` and include it in the provider `value`.
- `TableLanding` calls `setDineIn(...)`; `Checkout` reads `dineIn` to switch to the dine-in variant and derive `orderType: 'DINE_IN'` + `tableToken`.

No new context module is created; `CartContext.tsx` is modified.

## Implementation Order

### Phase 1: Schema & contracts ✅
<!-- packages: server -->

- [x] **T1.1** Add `DINE_IN` to `OrderType`; add `Order.tableId` + relation; add `Table.qrToken` (unique) + `orders` relation `[server]` `[~10 LOC]`
- [x] **T1.2** Add `dineInEnabled` to `orderSettings` (schema comment + settings schema) `[server]` `[~4 LOC]`
- [x] **T1.3** Generate migration; verify additive `[server]` `[~10 LOC]` — depends: T1.1

> **Session notes**: Schema edits in `prisma/schema.prisma` — `OrderType.DINE_IN`, `Order.tableId` + `table` relation, `Table.qrToken @unique` + `orders` relation, `orderSettings` comment. `dineInEnabled: z.boolean().optional()` added to `orderSettingsSchema` (`settings.controller.ts:191`). Migration `prisma/migrations/20260630083351_add_qr_dine_in_ordering/migration.sql` generated via `prisma migrate diff` (datamodel-to-datamodel; no DB in env) — fully additive: `ADD VALUE 'DINE_IN'`, two nullable columns, one unique index, one `ON DELETE SET NULL` FK. `prisma validate` passes; client regenerated. No DB available to run `migrate dev`, so the migration is unapplied — it will apply on first `prisma migrate deploy`/`dev` in a real env.

### Phase 2: Server — tokens & dine-in orders ✅
<!-- depends: Schema & contracts | packages: server -->

- [x] **T2.1** `GET /api/locations/tables/by-token/:qrToken` resolver in `table.controller.ts` + route `[server]` `[~35 LOC]` — depends: T1.1
- [x] **T2.2** `POST /api/locations/:locationId/tables/:tableId/qr` to set/rotate `qrToken`, returns storefront URL `[server]` `[~30 LOC]` — depends: T1.1
- [x] **T2.3** Accept `DINE_IN` + `tableToken` in `createOrderSchema`; branch out of address/zone logic; set `tableId` `[server]` `[~50 LOC]` — depends: T1.1

> **Session notes**: New `packages/server/src/lib/qr.ts` (`generateQrToken` = 18 random bytes base64url; `tableQrUrl` from `PUBLIC_URL`). `table.controller.ts` gained `resolveTableByToken` (public, returns location+table labels) and `generateTableQr` (staff, sets/rotates `qrToken`, returns scannable URL). Routes added in `location.routes.ts` — public `/tables/by-token/:qrToken` registered **before** the parameterised `/:locationId/tables/...` group to avoid shadowing; QR-generate gated by `SUPER_ADMIN`/`MANAGER`. `order.controller.ts`: `createOrderSchema` accepts `DINE_IN` + optional `tableToken`; dine-in is exempt from the guest name/email requirement (anonymous walk-in); table resolved (active + same location) and `tableId` persisted. **TDD**: tests written first (Red confirmed), then implementation. Unit `qr-token.test.ts` (5), dine-in cases in `order.test.ts` (+3), QR cases in `table.test.ts` (+6). Full server suite green: **339 tests pass**. Type-check clean. (Lint not runnable — eslint absent from the repo, pre-existing.) This satisfies T5.1 (server integration tests for dine-in + token resolution).

### Phase 5 note
> T5.1 (server integration tests for dine-in order creation + token resolution) was completed as part of Phase 2's TDD cycle — see the Phase 2 session notes. Marked complete below.

### Phase 3: Admin — QR management ✅
<!-- depends: Server — tokens & dine-in orders | packages: admin -->

- [x] **T3.1** Add `qrcode`/`qrcode.react` dependency to admin `[admin]` `[~2 LOC]`
- [x] **T3.2** QR generate/regenerate + print view in `TableList.tsx` (regenerate warns codes are invalidated) `[admin]` `[~80 LOC]` — depends: T2.2, T3.1

> **Session notes**: Used `qrcode` (`^1.5.4`, + `@types/qrcode`) rather than `qrcode.react` — `QRCode.toDataURL()` yields a data URL that prints cleanly in a new window. `TableList.tsx`: per-row "Generate QR" / "Regenerate QR" button (regenerate `confirm()`s that printed copies are invalidated), `handleGenerateQr` POSTs to `/locations/:id/tables/:id/qr`, renders the returned URL as a QR in a modal with a Print action (`handlePrintQr` opens a print window with the data-URL image + table name + URL). `Table` interface gained `qrToken`. Admin `tsc -b` clean. No admin unit-test runner in repo; UI is covered by the e2e flow (T5.2).

### Phase 4: Storefront — scan-to-order flow ✅
<!-- depends: Server — tokens & dine-in orders | packages: storefront -->

- [x] **T4.1** Extend `CartContext.tsx` with `dineIn` state + `setDineIn` (clear on `clear()`) `[storefront]` `[~25 LOC]` — depends: T2.1
- [x] **T4.2** `TableLanding` page + `/t/:token` route; resolves token, calls `setDineIn`, redirects to menu `[storefront]` `[~50 LOC]` — depends: T4.1
- [x] **T4.3** Dine-in checkout in `Checkout.tsx`: table banner, no address step, Pay-now vs Pay-at-counter, send `tableToken` `[storefront]` `[~70 LOC]` — depends: T4.1, T2.3

> **Session notes**: `DineInContext` = `{ token, locationId, tableId, tableName }` — the raw `token` is kept so checkout can submit it as `tableToken` (the resolver discards it otherwise). `CartContext` extended with `dineIn` + `setDineIn`, cleared in `clear()`. New `TableLanding` page (`/t/:token`) fetches the by-token resolver, calls `setDineIn`, redirects to `/menu` (shows a recoverable error on invalid token). `Checkout`: when `dineIn` is set it forces `orderType: 'DINE_IN'`, hides the order-type selector + address (shows a "Dine-in — {tableName}" banner), forces delivery fee to 0, relabels cash as "Pay at Counter", makes guest contact optional, and submits `tableToken`. New i18n keys added to `en.json` (`checkout.payAtCounter/dineInTitle/dineInSubtitle`, `tableLanding.*`); other 5 locales fall back to `en` (`fallbackLng: 'en'`) — run `npm run translate -w packages/storefront` to localize. `tsc -b` clean for admin + storefront.

### Phase 5 note (T5.2)
> T5.2 (e2e) added as `e2e/storefront/dine-in.spec.ts` — covers the deterministic dine-in entry behaviour (invalid token recovery + valid-token resolution to `/menu`). Seeded a fixed token `dev-table-1-qr` on Table 1 in `prisma/seed.ts` to make it runnable. The full menu-modal → add-to-cart → place-order path is not e2e'd (the existing suite doesn't build carts); dine-in order creation is covered by server integration tests. E2E requires a running stack (server + storefront + DB) — not executed in this environment.

### Phase 5: Tests & docs
<!-- depends: Storefront — scan-to-order flow | packages: server, storefront, docs -->

- [x] **T5.1** Integration tests for dine-in order creation + token resolution `[server]` `[~80 LOC]` — depends: T2.3 (done in Phase 2 TDD)
- [x] **T5.2** E2E: scan-link → menu → dine-in checkout (pay-at-counter) in `e2e/storefront/dine-in.spec.ts` (**NEW**) `[storefront]` `[~60 LOC]` — depends: T4.3 (entry flow; see Phase 5 note)
- [x] **T5.3** Docs: QR ordering setup + table QR printing `[docs]` `[~30 LOC]` — depends: T3.2, T4.3

## Testing Strategy

### Unit Tests

| Test File | What It Tests |
|-----------|--------------|
| `packages/server/src/__tests__/unit/qr-token.test.ts` (**NEW**) | `qrToken` generation is URL-safe and unique; storefront URL composition |

### Integration / E2E Tests

`packages/server/src/__tests__/integration/order.test.ts`:
- `DINE_IN` order with a valid `tableToken` persists with `tableId` set, no address required.
- `DINE_IN` without/with invalid `tableToken` → 400.
- `GET .../by-token/:qrToken` returns location+table for active tables; 404 for unknown/inactive.

`packages/server/src/__tests__/integration/reservation.test.ts` or a new `table.test.ts`:
- QR generate/regenerate sets and rotates `qrToken`.

E2E (`e2e/storefront/`): visiting `/t/<token>` lands on the menu with the table banner; placing a pay-at-counter dine-in order creates an unpaid order.

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Storefront cart-state mechanism unclear (no central store found) | T4.1 verifies the existing mechanism and integrates rather than duplicating |
| Guessable QR tokens would let anyone order against a table | Use random 16+ byte URL-safe tokens, not `Table.id`; allow rotation |
| Dine-in branch breaks existing delivery/pickup validation | Branch explicitly on `orderType`; integration tests cover all three types |
| Pay-at-counter orders never get settled | Reuse existing staff `markCashPayment` flow; unpaid dine-in orders remain visible in the admin order list |
| Reused `Table` model is shared with reservations | Additive fields only (`qrToken`, `orders` relation); no change to reservation behaviour |

## Out of Scope

- Online payment provider work — covered by `pinch-payments-provider.md` (this spec only routes to whichever providers are enabled, plus pay-at-counter).
- "Order ready" notifications — covered by `order-ready-notifications.md`.
- Per-table open tabs / split-the-bill / add-to-existing-order — single order per checkout for now.
- A new dine-in-specific `OrderStatus` (e.g. `SERVED`) — reuse existing statuses; revisit if needed.
- Mobile app dine-in flow — storefront (web) only.

## Files to Change

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `DINE_IN`; `Order.tableId`; `Table.qrToken` + `orders`; `orderSettings.dineInEnabled` |
| `prisma/migrations/<new>/migration.sql` | **NEW** — additive migration |
| `packages/server/src/controllers/table.controller.ts` | `by-token` resolver + QR generate/rotate |
| `packages/server/src/routes/location.routes.ts` | New table QR routes |
| `packages/server/src/controllers/order.controller.ts` | Accept `DINE_IN` + `tableToken`; branch validation |
| `packages/server/src/controllers/settings.controller.ts` | `dineInEnabled` in order settings schema |
| `packages/admin/src/pages/TableList.tsx` | QR generate/regenerate + print view |
| `packages/admin/package.json` | Add `qrcode`/`qrcode.react` |
| `packages/storefront/src/main.tsx` | `/t/:token` route |
| `packages/storefront/src/pages/TableLanding.tsx` | **NEW** — landing/resolver |
| `packages/storefront/src/context/CartContext.tsx` | Extend with `dineIn` state + `setDineIn` |
| `packages/storefront/src/pages/Checkout.tsx` | Dine-in checkout variant |
| `packages/server/src/__tests__/unit/qr-token.test.ts` | **NEW** |
| `packages/server/src/__tests__/integration/order.test.ts` | Dine-in + token tests |
| `e2e/storefront/dine-in.spec.ts` | **NEW** — scan-to-order e2e spec |
| `packages/docs/features/` | QR ordering docs |

## Documentation Impact

- [x] `packages/docs/features/qr-ordering.md` — new "QR / Dine-in Ordering" feature page (registered in the VitePress sidebar)
- [x] `packages/docs/features/ordering.md` — added `DINE_IN` to the Order Types table
- [ ] `packages/docs/guide/` — operator guide on creating tables / printing QR codes folded into the feature page's "Generating & printing" section; no separate guide page added
