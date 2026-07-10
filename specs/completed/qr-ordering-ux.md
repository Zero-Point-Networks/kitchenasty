# QR Ordering UX Polish

## Status: Complete

<!-- Status values: Draft | In Progress | Complete | On Hold | Cancelled -->
<!-- Folder must match status: draft/ | in-progress/ | completed/ | on-hold/ | cancelled/ -->

## Objective

Make the shipped QR / dine-in feature usable in practice: let admins **view** a table's existing QR code without regenerating it, and give diners a **visible, persistent** indication they're ordering for a table (surviving a page refresh) — the mechanics already work, but nothing surfaces them.

## Problem Statement

The `qr-ordering` feature is functionally complete (verified end-to-end: a `DINE_IN` order with the seeded token creates an order with `tableId` set), but real use exposed three UX gaps:

1. **Can't view an existing QR without rotating it** — the admin already labels the button "Generate QR" vs "Regenerate QR" by `table.qrToken` (`packages/admin/src/pages/TableList.tsx:287`), but **both** paths call `handleGenerateQr` (`:94`), which always `POST`s to `/api/locations/:locationId/tables/:tableId/qr` and rotates `qrToken` (`packages/server/src/controllers/table.controller.ts` `generateTableQr`), **invalidating any printed code**. There's no read-only way to see the current code.
2. **No on-screen dine-in indication** — `dineIn` context is only read on the checkout page (`packages/storefront/src/pages/Checkout.tsx:14`), and only visible once the cart has items. After a scan, the menu and the rest of the site show nothing, so a diner cannot tell the scan worked. The site layout (`packages/storefront/src/components/Layout.tsx`) has no indicator.
3. **Dine-in context is lost on refresh** — `dineIn` is in-memory React state (`packages/storefront/src/context/CartContext.tsx:49`); refreshing the menu or reopening the link silently drops the table binding.

## Current Architecture

### Key Files

| File | Role |
|------|------|
| `packages/server/src/controllers/table.controller.ts` | `generateTableQr` (POST, set/rotate), `resolveTableByToken` (public) |
| `packages/server/src/routes/location.routes.ts` | Table routes; `POST /:locationId/tables/:tableId/qr` for generate |
| `packages/server/src/lib/qr.ts` | `tableQrUrl(token)` composes the storefront URL from `PUBLIC_URL` |
| `packages/admin/src/pages/TableList.tsx` | Admin table management; `Table.qrToken`, `handleGenerateQr`, `QrModalState`, QR modal |
| `packages/admin/src/lib/api.ts` | `api.get<T>(path)`, `api.post<T>(path, body)` |
| `packages/storefront/src/context/CartContext.tsx` | `dineIn` / `setDineIn`, cleared in `clear()` |
| `packages/storefront/src/components/Layout.tsx` | `<Header/>` + `<Outlet/>` — site chrome |
| `packages/storefront/src/pages/TableLanding.tsx` | `/t/:token` → `setDineIn` → redirect to `/menu` |
| `packages/storefront/src/pages/Checkout.tsx` | Reads `dineIn`; renders the only current dine-in banner |

The admin table LIST endpoint already returns `qrToken` per table, but the admin has no way to compose the scannable URL client-side (it doesn't know `PUBLIC_URL`), so viewing needs the server to return the composed URL.

## Design

### 1. Read-only QR endpoint (server)

Add `getTableQr` to `table.controller.ts` and a route — a side-effect-free counterpart to the existing rotate action:

```
GET /api/locations/:locationId/tables/:tableId/qr   (staff)
→ 200 { qrToken, url }   when the table has a token
→ 404                    when the table has no token yet, or doesn't exist
```

```ts
export async function getTableQr(
  req: Request<{ locationId: string; tableId: string }>,
  res: Response,
): Promise<void> {
  const { locationId, tableId } = req.params;
  const table = await prisma.table.findFirst({ where: { id: tableId, locationId } });
  if (!table || !table.qrToken) {
    res.status(404).json({ success: false, error: 'No QR code for this table' });
    return;
  }
  res.json({ success: true, data: { qrToken: table.qrToken, url: tableQrUrl(table.qrToken) } });
}
```

Route (method-distinct from the existing `POST .../qr`, so no conflict):

```ts
router.get('/:locationId/tables/:tableId/qr', authenticate, requireStaff, requireRole('SUPER_ADMIN', 'MANAGER'), getTableQr);
```

### 2. Admin — view vs. regenerate (TableList)

Split the single action by intent, driven by `table.qrToken`:

- Token **present** → **"View QR"** → `api.get` the read-only endpoint → open the modal (no rotation).
- Token **absent** → **"Generate QR"** → existing `POST` path.
- Inside the modal → a **"Regenerate"** button → existing `POST` path, keeping the "this invalidates printed codes" `confirm()`.

`handleGenerateQr` stays for generate/regenerate; add `handleViewQr(table)` that GETs `{ qrToken, url }`, renders the QR via `QRCode.toDataURL(url)`, and opens the same `QrModalState`. The modal gains a Regenerate button that calls `handleGenerateQr(table)`.

### 3. Storefront — durable dine-in context (CartContext)

Persist `dineIn` to `sessionStorage` (per-tab, ephemeral — the right lifetime for a dine-in session):

- Initialise `dineIn` state by hydrating from `sessionStorage` (`kitchenasty.dineIn`).
- On `setDineIn`, write-through to `sessionStorage` (or remove when set to `null`).
- `clear()` continues to null it (and removes the key).

```ts
const DINE_IN_KEY = 'kitchenasty.dineIn';
const [dineIn, setDineInState] = useState<DineInContext | null>(() => {
  try { const raw = sessionStorage.getItem(DINE_IN_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
});
const setDineIn = useCallback((ctx: DineInContext | null) => {
  setDineInState(ctx);
  try { ctx ? sessionStorage.setItem(DINE_IN_KEY, JSON.stringify(ctx)) : sessionStorage.removeItem(DINE_IN_KEY); }
  catch { /* storage unavailable — degrade to in-memory */ }
}, []);
```

`clear()` must call the **wrapper** (not the raw `setDineInState`) so the `sessionStorage` key is removed on order placement:

```ts
const clear = useCallback(() => {
  setItems([]);
  setDineIn(null); // wrapper → also clears sessionStorage
}, [setDineIn]);
```

### 4. Storefront — persistent dine-in banner (Layout)

New `DineInBanner` component rendered in `Layout.tsx` above `<Outlet/>`, shown whenever `dineIn` is set (so it's visible on the menu and every page):

- Copy: "Ordering for **{tableName}**" (i18n key), with a small **"Leave table"** action that calls `clear()` (or a lighter `setDineIn(null)`).
- Uses `useCart()`; renders nothing when `dineIn` is null.

This directly fixes the "scan just goes to the menu with no feedback" confusion.

## Implementation Order

> `[infra]` is not used here. Tags are workspace packages from the profile.

### Phase 1: Server — read-only QR endpoint ✅
<!-- packages: server -->

- [x] **T1.1** Add `getTableQr` to `table.controller.ts` + `GET /:locationId/tables/:tableId/qr` route in `location.routes.ts` `[server]` `[~25 LOC]`
- [x] **T1.2** Integration tests in `table.test.ts`: GET returns `{qrToken,url}` for a table with a token; 404 for a table without one / unknown table; staff-auth required `[server]` `[~30 LOC]` — depends: T1.1

> **Session notes**: `getTableQr` (read-only) returns `{ qrToken, url: tableQrUrl(qrToken) }`, 404 when the table has no token or doesn't exist; asserts `table.update` is never called. `GET .../qr` route registered before `POST .../qr` (method-distinct, no collision). TDD: 4 tests written first (Red), then impl. 27 table tests pass; server type-check clean.

### Phase 2: Admin — view vs regenerate ✅
<!-- depends: Server — read-only QR endpoint | packages: admin -->

- [x] **T2.1** `TableList.tsx`: `View QR` (GET) when `qrToken` present, `Generate QR` (POST) when absent, and a `Regenerate` button inside the modal (POST + confirm) `[admin]` `[~50 LOC]` — depends: T1.1

> **Session notes**: Row action is now **View QR** (GET, no rotation) when the table has a token, else **Generate QR** (POST). `handleViewQr` GETs `{qrToken,url}` and renders the QR; the modal gained a **Regenerate** button that calls `handleGenerateQr` (keeps the "invalidates printed copies" confirm). `QrModalState` gained `table` so Regenerate has its target. Admin `tsc -b` clean. (No admin unit-test runner; covered by type-check + e2e/manual.)

### Phase 3: Storefront — visible & durable dine-in context
<!-- packages: storefront -->
<!-- Independent of Phases 1-2 (client-only) — can be worked in parallel. -->

- [x] **T3.1** Persist `dineIn` to `sessionStorage` in `CartContext.tsx` (hydrate on init, write-through on set, remove on clear) `[storefront]` `[~20 LOC]`
- [x] **T3.2** `DineInBanner` component rendered in `Layout.tsx`; shows "Ordering for {tableName}" + "Leave table"; i18n keys in `en.json` `[storefront]` `[~40 LOC]` — depends: T3.1

> **Session notes**: `CartContext` now hydrates `dineIn` from `sessionStorage` (lazy init, try/catch) and write-throughs via a `setDineIn` wrapper; `clear()` calls the wrapper so the key is removed on order placement. New `DineInBanner` (default export, `useCart`) renders "Ordering for **{tableName}**" + a "Leave table" action (`setDineIn(null)`, keeps the cart), or nothing when not dine-in; mounted in `Layout` under `<Header/>`. i18n keys `dineInBanner.ordering/leave` in `en.json` (other locales fall back to en). Storefront `tsc -b` clean.

### Phase 4: Tests & docs
<!-- depends: Storefront — visible & durable dine-in context | packages: storefront, docs -->

- [x] **T4.1** Extend `e2e/storefront/dine-in.spec.ts`: after visiting `/t/dev-table-1-qr`, the "Ordering for Table 1" banner is visible on `/menu` `[storefront]` `[~20 LOC]` — depends: T3.2
- [x] **T4.2** Update `packages/docs/features/qr-ordering.md`: admins can View a table's QR without regenerating; note the on-screen dine-in banner `[docs]` `[~15 LOC]` — depends: T2.1, T3.2

> **Session notes**: e2e adds a "persistent dine-in banner" test (banner visible on `/menu` after scan + survives reload). Docs: updated How-it-works (banner), the QR admin actions (View vs Generate; Regenerate moved into the modal), and added the read-only `GET .../qr` to the API reference. E2E requires a running stack; not executed here. Full suite: **310 tests pass**; server/admin/storefront type-check clean.

### Phase 5: Finalization fixes
<!-- packages: storefront, admin -->

- [x] Fix: translate the dine-in i18n keys (`checkout.payAtCounter/dineInTitle/dineInSubtitle`, `tableLanding.*`, `dineInBanner.*` — 9 keys) into `de/es/fr/it/pt.json`, which previously fell back to English mid-page for non-English diners `[storefront]` `[~45 LOC]`
- [x] Fix: drop the redundant `QrModalState.tableName` field in `TableList.tsx` (always mirrored `table.name`) `[admin]` `[~6 LOC]`

> **Session notes** (finalize audit, 2026-07-10): Deep audit of all 10 implementation files found **no bugs** — routes registered, wrapper used at every `setDineIn`/`clear()` call site (incl. `OrderConfirmation`'s Stripe `?paid=true` return), stale-token checkout fails gracefully (400 "Invalid or inactive table", "Leave table" is the escape hatch). The two items above were the only findings (both minor). Locale key parity with `en.json` verified programmatically; each locale matches its existing formality (de=Sie, fr=vous, es/it=tu, pt=você) and reuses its own `browseMenu` wording. Full suite 338 server + 61 shared + 17 e2e-adjacent pass; server/admin/storefront `tsc` clean. Root `npm run lint` is broken repo-wide (no ESLint config has ever existed) — pre-existing, not from this spec.

### Environment note
> Developed in a dedicated **git worktree** (`/home/russell/kitchenasty-qrux`) after a second concurrent session switched the shared main working tree mid-Phase-3. Phases 1-2 were already committed/pushed; Phases 3-4 completed in the isolated worktree. No work lost.

## Testing Strategy

### Unit / Integration Tests

| Test File | What It Tests |
|-----------|--------------|
| `packages/server/src/__tests__/integration/table.test.ts` | `GET .../qr` returns `{qrToken,url}` for a tokened table; 404 otherwise; requires staff auth |

### E2E Tests

`e2e/storefront/dine-in.spec.ts`: after `/t/dev-table-1-qr` → `/menu`, assert the persistent "Ordering for Table 1" banner is visible (requires the running stack).

Admin (`TableList`) has no unit-test runner in the repo; covered by `tsc -b` + manual/e2e.

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `sessionStorage` unavailable (private mode / SSR) | Guarded in try/catch; degrades to in-memory (current behaviour) |
| Stale `sessionStorage` dine-in context sticks around across unrelated visits | Per-tab `sessionStorage` (not `localStorage`) clears when the tab closes; "Leave table" action + `clear()` on order placement remove it |
| Admin `View QR` for a token created before this change | Works — reads the stored `qrToken`; no migration needed |
| GET `/qr` route colliding with existing routes | Method-distinct (`GET` vs `POST .../qr`) and 4-segment path; no collision with `by-token` or `:tableId` |

## Out of Scope

- Changing the QR token format or the public `by-token` resolver.
- Bulk QR printing (all tables at once) — single-table view/print only.
- Persisting the cart itself across refresh (only the dine-in table context).
- `localStorage` (cross-tab / permanent) persistence — `sessionStorage` is the intended lifetime.
- Any change to the dine-in order API or pay-at-counter flow.

## Files to Change

| File | Change |
|------|--------|
| `packages/server/src/controllers/table.controller.ts` | Add `getTableQr` |
| `packages/server/src/routes/location.routes.ts` | Add `GET .../qr` route |
| `packages/server/src/__tests__/integration/table.test.ts` | GET-qr tests |
| `packages/admin/src/pages/TableList.tsx` | View / Generate / Regenerate split |
| `packages/storefront/src/context/CartContext.tsx` | `sessionStorage` persistence for `dineIn` |
| `packages/storefront/src/components/Layout.tsx` | Render `DineInBanner` |
| `packages/storefront/src/components/DineInBanner.tsx` | **NEW** — persistent banner |
| `packages/storefront/src/i18n/locales/en.json` | Banner strings |
| `packages/storefront/src/i18n/locales/{de,es,fr,it,pt}.json` | Dine-in key translations (finalization) |
| `e2e/storefront/dine-in.spec.ts` | Banner assertion |
| `packages/docs/features/qr-ordering.md` | Document View-QR + banner |

## Documentation Impact

- [x] `packages/docs/features/qr-ordering.md` — admins can view a table's QR without regenerating; diners see a persistent "Ordering for {table}" banner
