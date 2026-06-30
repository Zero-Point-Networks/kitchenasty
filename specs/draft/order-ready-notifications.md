# Order-Ready Pickup Notifications

## Status: Draft

<!-- Status values: Draft | In Progress | Complete | On Hold | Cancelled -->
<!-- Folder must match status: draft/ | in-progress/ | completed/ | on-hold/ | cancelled/ -->

## Objective

Notify a guest across their available channels (email, SMS, push) when their pickup / dine-in order is marked **READY**, so a motel guest who ordered from their room knows to collect it — without staff phoning around.

## Problem Statement

1. **The "ready" moment isn't emphasised** — `updateOrderStatus` (`packages/server/src/controllers/order.controller.ts:469`) already sends a generic `orderStatusEmail` on *every* status change (`:510`), but there's no distinct, prominent "your order is ready for pickup" message and no use of SMS or push for it.
2. **SMS is unused for order status** — `packages/server/src/lib/sms.ts` exposes `sendSMS(to, body)` but it isn't called from the order flow.
3. **Push only reaches app accounts** — `Customer.expoPushToken` (`prisma/schema.prisma:53`) exists and there's push-token plumbing, but guest QR orders (web, no account) can't receive push; they rely on email/SMS.
4. **No per-channel toggle** — there's no setting governing which channels fire for the ready event.

## Current Architecture

### Key Files

| File | Role |
|------|------|
| `packages/server/src/controllers/order.controller.ts:469` | `updateOrderStatus` — flips status, audits, emits socket event, sends status email |
| `packages/server/src/lib/email.ts:121` | `orderStatusEmail({ orderNumber, status })` template + `sendEmail` (`:70`) |
| `packages/server/src/lib/sms.ts:26` | `sendSMS(to, body)` (currently unused by orders) |
| `packages/server/src/lib/socket.ts` | `emitOrderStatusUpdate(...)` realtime push to web clients |
| `packages/server/src/controllers/push-token.controller.ts` | Expo push token registration |
| `packages/server/src/lib/actions.ts` | Action executor (existing push/notify side) |
| `prisma/schema.prisma:53` | `Customer.expoPushToken` (model at `:46`); `Customer.phone` at `:51` |
| `prisma/schema.prisma:349` | `Order` guest fields `guestEmail`, `guestPhone` |
| `prisma/schema.prisma:581` | `SiteSettings.mailSettings` (SMTP) — SMS/notification settings location TBD |

The status email already fires for free; this spec specialises the **READY** transition and fans it out to SMS + push, gated by settings.

## Design

When `updateOrderStatus` transitions an order to `READY` **and** the order is collectable (`PICKUP` or `DINE_IN`), send a dedicated "ready for pickup" notification on each enabled channel, to whichever contact details the order has.

### 1. Ready-specific notification helper

Add `notifyOrderReady(order)` in a new `packages/server/src/lib/notifications.ts` (**NEW**) that:
- Resolves recipient contacts: `order.customer?.email ?? order.guestEmail`, `order.customer?.phone ?? order.guestPhone`, and `order.customer?.expoPushToken`.
- **Email**: new `orderReadyEmail({ orderNumber, tableName? })` template in `email.ts` (distinct from the generic status email — clear "ready for collection" copy).
- **SMS**: `sendSMS(phone, "<site>: order <orderNumber> is ready for pickup")` when a phone is present and SMS is enabled.
- **Push**: send to `expoPushToken` when present (reuse the existing Expo push path in `actions.ts` / push plumbing).
- Each channel is best-effort (`.catch(() => {})`), matching the existing fire-and-forget email at `order.controller.ts:511`.

### 2. Wire into `updateOrderStatus`

After the status update, when `status === 'READY'` and `orderType` ∈ `{PICKUP, DINE_IN}`, call `notifyOrderReady(updated)`. Keep the existing generic status email for all other transitions to avoid double-emailing on READY (READY uses the dedicated template instead).

### 3. Settings — channel toggles

Add a `notificationSettings` group with `readyEmailEnabled`, `readySmsEnabled`, `readyPushEnabled` booleans. Surface it in a new `packages/admin/src/pages/SettingsNotifications.tsx` page registered in the settings nav (`packages/admin/src/pages/Settings.tsx`), consistent with the existing per-group settings pages (`SettingsOrder.tsx`, `SettingsMail.tsx`, …). Default: email on, SMS/push off (SMS has per-message cost; push only matters for app users).

### 4. Dine-in / room context

If the order has a `tableId` (from `qr-ordering.md`), include the table/room label in the message ("ready for collection — Table 4"). This is optional and degrades gracefully when `tableId` is absent.

## Implementation Order

> **Prerequisite / sequencing**: land `qr-ordering.md` first. This spec reads `Order.tableId` / `DINE_IN` from that spec, and both specs edit `packages/server/src/controllers/settings.controller.ts` (it adds `dineInEnabled`; this adds `notificationSettings`) and `packages/server/src/__tests__/integration/order.test.ts`. Sequencing avoids merge conflicts on those shared files. The table-label enrichment (§4) degrades gracefully if QR is absent, but the integration is cleanest after QR lands.

### Phase 1: Settings & template
<!-- packages: server -->

- [ ] **T1.1** Add `orderReadyEmail(...)` template to `packages/server/src/lib/email.ts` `[server]` `[~30 LOC]`
- [ ] **T1.2** Add `notificationSettings` (ready channel toggles) to settings schema + comment `[server]` `[~15 LOC]`

### Phase 2: Notification fan-out
<!-- depends: Settings & template | packages: server -->

- [ ] **T2.1** Add `notifyOrderReady(order)` helper (email + SMS + push, best-effort, settings-gated) `[server]` `[~70 LOC]` — depends: T1.1, T1.2
- [ ] **T2.2** Call `notifyOrderReady` from `updateOrderStatus` on `READY` for `PICKUP`/`DINE_IN`; avoid double-emailing `[server]` `[~15 LOC]` — depends: T2.1

### Phase 3: Admin & tests
<!-- depends: Notification fan-out | packages: admin, server -->

- [ ] **T3.1** New `SettingsNotifications.tsx` page (channel toggles) + register in `Settings.tsx` nav `[admin]` `[~50 LOC]` — depends: T1.2
- [ ] **T3.2** Integration tests: READY fires the right channels per settings; non-READY unaffected `[server]` `[~60 LOC]` — depends: T2.2

## Testing Strategy

### Unit Tests

| Test File | What It Tests |
|-----------|--------------|
| `packages/server/src/__tests__/unit/notify-order-ready.test.ts` (**NEW**) | Channel selection by available contacts + settings; message includes table label when present; channels are best-effort |

### Integration / E2E Tests

`packages/server/src/__tests__/integration/order.test.ts`:
- `PATCH /orders/:id/status` to `READY` on a `PICKUP`/`DINE_IN` order triggers email (and SMS/push when enabled + contact present); transports mocked.
- Non-READY transitions still use the generic status email and do **not** trigger the ready fan-out.
- READY on a `DELIVERY` order does not fire the pickup-ready message.

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Double-emailing on READY (generic + ready template) | READY uses the dedicated template only; generic email skips READY |
| SMS cost / misconfiguration | SMS gated by `readySmsEnabled` (default off) and only sent when a phone exists |
| Notification failure blocks status update | All channels best-effort with `.catch()`, matching existing email behaviour |
| Guest orders with no contact details | No-op gracefully; rely on the storefront realtime status page (`emitOrderStatusUpdate`) |

## Out of Scope

- QR ordering and the `tableId`/`DINE_IN` additions themselves — covered by `qr-ordering.md` (this spec consumes `tableId` if present but does not add it).
- New SMS provider integration — assumes `lib/sms.ts` is already configured.
- Notifications for other status transitions (PREPARING, OUT_FOR_DELIVERY) beyond the existing generic email.
- In-app/browser web-push (distinct from Expo push) — realtime status already covered by sockets.

## Files to Change

| File | Change |
|------|--------|
| `packages/server/src/lib/email.ts` | Add `orderReadyEmail` template |
| `packages/server/src/lib/notifications.ts` | **NEW** — `notifyOrderReady` fan-out (or co-locate in controller) |
| `packages/server/src/controllers/order.controller.ts` | Call `notifyOrderReady` on READY for PICKUP/DINE_IN |
| `packages/server/src/controllers/settings.controller.ts` | `notificationSettings` schema + masking if needed |
| `prisma/schema.prisma` | `notificationSettings` comment on `SiteSettings` (no structural change if JSON) |
| `packages/admin/src/pages/SettingsNotifications.tsx` | **NEW** — notification channel toggles |
| `packages/admin/src/pages/Settings.tsx` | Register the Notifications settings page in the nav |
| `packages/server/src/__tests__/unit/notify-order-ready.test.ts` | **NEW** |
| `packages/server/src/__tests__/integration/order.test.ts` | READY fan-out tests |
| `packages/docs/features/` | Document ready notifications |

## Documentation Impact

- [ ] `packages/docs/features/` — "Order status notifications" page: ready-for-pickup channels and toggles
- [ ] `packages/docs/configuration/` — enabling SMS/push for notifications
