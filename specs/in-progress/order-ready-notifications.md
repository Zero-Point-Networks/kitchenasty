# Order-Ready Pickup Notifications

## Status: In Progress

<!-- Status values: Draft | In Progress | Complete | On Hold | Cancelled -->
<!-- Folder must match status: draft/ | in-progress/ | completed/ | on-hold/ | cancelled/ -->

## Objective

Notify a guest across their available channels (email, SMS, push) when their pickup / dine-in order is marked **READY**, so a motel guest who ordered from their room knows to collect it — without staff phoning around.

## Problem Statement

1. **The "ready" moment isn't emphasised** — `updateOrderStatus` (`packages/server/src/controllers/order.controller.ts:499`) already sends a generic `orderStatusEmail` on *every* status change (`:540`), but there's no distinct, prominent "your order is ready for pickup" message and no use of SMS for it.
2. **SMS is unused for order status** — `packages/server/src/lib/sms.ts` exposes `sendSMS(to, body)` but it isn't called from the order flow.
3. **Push only reaches app accounts, with generic copy** — `Customer.expoPushToken` (`prisma/schema.prisma:53`) exists, and `emitOrderStatusUpdate` → `sendPushNotification` (`packages/server/src/lib/socket.ts:46,65`) already pushes "Your order is ready." on every status change for account customers. But guest QR orders (web, no account) can't receive push and rely on email/SMS, and the READY push has no pickup/table context.
4. **No per-channel toggle** — there's no setting governing which channels fire for the ready event.

## Current Architecture

### Key Files

| File | Role |
|------|------|
| `packages/server/src/controllers/order.controller.ts:499` | `updateOrderStatus` — flips status, audits, emits socket event, sends status email |
| `packages/server/src/lib/email.ts:121` | `orderStatusEmail({ orderNumber, status })` template + `sendEmail` (`:70`) |
| `packages/server/src/lib/sms.ts:26` | `sendSMS(to, body)` (currently unused by orders; no-ops when Twilio unconfigured or `NODE_ENV=test`) |
| `packages/server/src/lib/socket.ts:46` | `emitOrderStatusUpdate(...)` — realtime socket events **and** unconditional Expo push via `sendPushNotification` (`:65`) on every status change |
| `packages/server/src/controllers/push-token.controller.ts` | Expo push token registration |
| `prisma/schema.prisma:53` | `Customer.expoPushToken` (model at `:46`); `Customer.phone` at `:51` |
| `prisma/schema.prisma:387` | `Order` guest fields `guestEmail` (`:387`), `guestPhone` (`:388`) |
| `prisma/schema.prisma:604` | `SiteSettings.mailSettings` — settings-group pattern: one `Json?` column per group + Zod schema + get/update handlers in `settings.controller.ts` (`SettingsField` union at `:144`) + routes in `settings.routes.ts` |

The status email already fires for free; this spec specialises the **READY** transition and fans it out to SMS + push, gated by settings.

## Design

When `updateOrderStatus` transitions an order to `READY` **and** the order is collectable (`PICKUP` or `DINE_IN`), send a dedicated "ready for pickup" notification on each enabled channel, to whichever contact details the order has.

### 1. Ready-specific notification helper

Add `notifyOrderReady(order)` in a new `packages/server/src/lib/notifications.ts` (**NEW**) that:
- Resolves recipient contacts: `order.customer?.email ?? order.guestEmail`, `order.customer?.phone ?? order.guestPhone`, and `order.customer?.expoPushToken`.
- **Email**: new `orderReadyEmail({ orderNumber, tableName? })` template in `email.ts` (distinct from the generic status email — clear "ready for collection" copy).
- **SMS**: `sendSMS(phone, "<site>: order <orderNumber> is ready for pickup")` when a phone is present and SMS is enabled.
- **Push**: send to `expoPushToken` when present, with the ready-specific copy (table label included). The Expo send lives in `socket.ts` (`sendPushNotification`); extract/reuse that Expo client path rather than duplicating it. **Note**: `actions.ts` has no push handling — the existing push plumbing is `socket.ts` only.
- Each channel is best-effort (`.catch(() => {})`), matching the existing fire-and-forget email at `order.controller.ts:540`.

### 2. Wire into `updateOrderStatus`

After the status update, when `status === 'READY'` and `orderType` ∈ `{PICKUP, DINE_IN}`, call `notifyOrderReady(updated)`. Keep the existing generic status email for all other transitions to avoid double-emailing on READY (READY uses the dedicated template instead).

**Avoid double-push**: `emitOrderStatusUpdate` currently pushes unconditionally on every status change (`socket.ts:60-62`), so the READY fan-out would double-notify app customers. Give `emitOrderStatusUpdate` a `suppressPush` option and set it when `notifyOrderReady` will run — the socket room events still fire (web realtime status is unaffected), but the push for that transition comes only from `notifyOrderReady`'s dedicated message. Non-collectable orders (DELIVERY) and all other transitions keep the existing generic push.

### 3. Settings — channel toggles

Add a `notificationSettings` group with `readyEmailEnabled`, `readySmsEnabled`, `readyPushEnabled` booleans, following the existing settings-group pattern end-to-end: new `notificationSettings Json?` column on `SiteSettings` (**Prisma migration required** — each group is its own column), `SettingsField` union member + Zod schema + get/update handlers in `settings.controller.ts`, and `GET/PUT /settings/notifications` routes (`SUPER_ADMIN`, `MANAGER` — same as order settings). Surface it in a new `packages/admin/src/pages/SettingsNotifications.tsx` page registered in the settings nav (`packages/admin/src/pages/Settings.tsx`), consistent with the existing per-group settings pages (`SettingsOrder.tsx`, `SettingsMail.tsx`, …).

Defaults: **email on, push on, SMS off**. SMS has per-message cost so it's opt-in; push defaults on because app customers already receive a READY push today via `emitOrderStatusUpdate` — defaulting it off would regress that. Turning `readyPushEnabled` off suppresses the READY push entirely (that's the point of the toggle).

### 4. Dine-in / room context

If the order has a `tableId` (from `qr-ordering.md`), include the table/room label in the message ("ready for collection — Table 4"). This is optional and degrades gracefully when `tableId` is absent.

## Implementation Order

> **Prerequisite / sequencing**: land `qr-ordering.md` first. This spec reads `Order.tableId` / `DINE_IN` from that spec, and both specs edit `packages/server/src/controllers/settings.controller.ts` (it adds `dineInEnabled`; this adds `notificationSettings`) and `packages/server/src/__tests__/integration/order.test.ts`. Sequencing avoids merge conflicts on those shared files. The table-label enrichment (§4) degrades gracefully if QR is absent, but the integration is cleanest after QR lands.

### Phase 1: Settings & template
<!-- packages: server -->

- [x] **T1.1** Add `orderReadyEmail(...)` template to `packages/server/src/lib/email.ts` `[server]` `[~30 LOC]`
- [x] **T1.2** Add `notificationSettings` group: `Json?` column on `SiteSettings` + Prisma migration, `SettingsField` member, Zod schema, get/update handlers, `/settings/notifications` routes `[server]` `[~40 LOC]`

> **Session notes**: `orderReadyEmail({ orderNumber, tableName? })` in `email.ts` (after `orderStatusEmail`); table label renders as "Collect at: <label>" only when truthy — template contains no other "Table" text (tests assert its absence). `notificationSettings Json?` column on `SiteSettings` + handwritten migration `20260705134500_add_notification_settings` (no local DB; SQL matches generator output style). Controller follows the generic group pattern (`SettingsField` union + Zod + get/update handlers); routes `GET/PUT /settings/notifications` at MANAGER+ like order settings. Tests: 5 new in `unit/email.test.ts` (39 unit total, green). Defaults (email/push on, SMS off) are NOT stored in the DB — Phase 2's helper owns default resolution.

### Phase 2: Notification fan-out ✅
<!-- depends: Settings & template | packages: server -->

- [x] **T2.1** Add `notifyOrderReady(order)` helper (email + SMS + push, best-effort, settings-gated) `[server]` `[~70 LOC]` — depends: T1.1, T1.2
- [x] **T2.2** Call `notifyOrderReady` from `updateOrderStatus` on `READY` for `PICKUP`/`DINE_IN`; skip the generic status email for that case and pass `suppressPush` to `emitOrderStatusUpdate` (no double email, no double push) `[server]` `[~20 LOC]` — depends: T2.1

> **Session notes**: `lib/notifications.ts` exports `notifyOrderReady(order)`, `OrderReadyInfo`, and `READY_NOTIFICATION_DEFAULTS` (email/push on, SMS off) — defaults merge over the stored `notificationSettings` JSON, and a failed settings read falls back to defaults. `socket.ts` now exports `sendExpoPush(token, title, body, data?)` (used by both the generic push and the ready push) and `emitOrderStatusUpdate` takes `{ suppressPush }`. `updateOrderStatus` computes `readyForCollection` (READY + PICKUP/DINE_IN), suppresses generic push + email for that case, and the update query now includes `customer {email, phone, expoPushToken}` and `table {name}` (route is staff-only). Tests: 14 in `unit/notify-order-ready.test.ts` mocking db/email/sms/socket; 53 unit + 310 integration green.

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
- READY on a `DELIVERY` order does not fire the pickup-ready message (generic email/push unchanged).
- READY on a collectable order sends exactly one email and at most one push (generic paths suppressed).

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Double-emailing on READY (generic + ready template) | READY uses the dedicated template only; generic email skips READY |
| Double-push on READY (existing `emitOrderStatusUpdate` push + ready fan-out) | `emitOrderStatusUpdate` gains a `suppressPush` option, set when `notifyOrderReady` handles the transition; `readyPushEnabled` defaults **on** to preserve today's READY push for app customers |
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
| `packages/server/src/lib/socket.ts` | `suppressPush` option on `emitOrderStatusUpdate`; expose the Expo send path for reuse |
| `packages/server/src/controllers/order.controller.ts` | Call `notifyOrderReady` on READY for PICKUP/DINE_IN; suppress generic email + push for that case |
| `packages/server/src/controllers/settings.controller.ts` | `notificationSettings` `SettingsField` member, Zod schema, get/update handlers |
| `packages/server/src/routes/settings.routes.ts` | `GET/PUT /settings/notifications` routes |
| `prisma/schema.prisma` | `notificationSettings Json?` column on `SiteSettings` + migration |
| `packages/admin/src/pages/SettingsNotifications.tsx` | **NEW** — notification channel toggles |
| `packages/admin/src/pages/Settings.tsx` | Register the Notifications settings page in the nav |
| `packages/server/src/__tests__/unit/notify-order-ready.test.ts` | **NEW** |
| `packages/server/src/__tests__/integration/order.test.ts` | READY fan-out tests |
| `packages/docs/features/` | Document ready notifications |

## Documentation Impact

- [ ] `packages/docs/features/` — "Order status notifications" page: ready-for-pickup channels and toggles
- [ ] `packages/docs/configuration/` — enabling SMS/push for notifications
