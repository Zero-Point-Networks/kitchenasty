# Spec Report — Order-Ready Pickup Notifications

Date: 05 July 2026 | Session: interactive

## What Was Delivered

Guests are now told the moment their pickup or dine-in order is ready to collect — by email, SMS, and mobile push — instead of relying on staff phoning around. This is the piece that lets a Coolgardie motel guest order from their room via QR code and know when to walk over.

- When staff mark a pickup/dine-in order **READY**, the customer gets a dedicated "ready for collection" message on every enabled channel they have contact details for (email uses a new purpose-built template; SMS reads like "KitchenAsty: order KA-123 is ready for pickup — Table 4").
- Dine-in orders include the table/room label in every channel so guests know the message applies to them.
- A new **Settings → Notifications** page in the admin dashboard lets managers toggle each channel. Defaults: email and push on, SMS off (SMS costs money per message).
- Customers never get duplicate messages: the generic status email/push are suppressed for that transition, and repeating the same status (double-click, client retry) fires nothing — so a billed SMS can't be sent twice.
- Delivery orders and all other status changes behave exactly as before.

## Spec Phases Completed

- Phase 1: Settings & template ✅
- Phase 2: Notification fan-out ✅
- Phase 3: Admin & tests ✅

## How to Verify

Preconditions: dev environment running (server + admin), SMTP pointed at Mailhog (`SMTP_HOST=localhost`, `SMTP_PORT=1025`), and the new Prisma migration applied (`npx prisma migrate dev`).

1. In the admin dashboard, open **Settings** — a new **Notifications** card appears. Open it; three checkboxes show (Email ✓, SMS ✗, Push ✓). Toggle and save; reload to confirm persistence.
2. Place a storefront pickup order as a guest with an email address.
3. In admin **Orders**, walk the order to **READY**.
4. **Expected**: Mailhog shows one email with subject `Order #<n> is ready for collection` (not the generic "Order Update" one).
5. Set the same order to READY again (send the same PATCH twice).
6. **Expected**: no second email.
7. Repeat with a QR dine-in order at a named table — the email body includes "Collect at: <table name>".
8. SMS requires Twilio env vars plus turning on the SMS toggle; push requires a mobile-app account with a registered Expo token.

## Technical Changes

### Server
- `packages/server/src/lib/notifications.ts` **(NEW)**: `notifyOrderReady` fan-out, `READY_NOTIFICATION_DEFAULTS`, `resolveContactEmail`
- `packages/server/src/lib/email.ts`: `orderReadyEmail` template
- `packages/server/src/lib/socket.ts`: exported `sendExpoPush`; `emitOrderStatusUpdate` gained `{ suppressPush }`
- `packages/server/src/controllers/order.controller.ts`: READY fan-out wiring, idempotency guard (`statusChanged`), response stripped of customer/table
- `packages/server/src/controllers/settings.controller.ts`: `notificationSettings` group (Zod schema typed against `ReadyChannelToggles`, merge-on-partial-PUT handlers)
- `packages/server/src/routes/settings.routes.ts`: `GET/PUT /api/settings/notifications` (MANAGER+)

### Database
- `prisma/schema.prisma`: `SiteSettings.notificationSettings Json?`
- `prisma/migrations/20260705134500_add_notification_settings/migration.sql` **(NEW)**

### Admin
- `packages/admin/src/pages/SettingsNotifications.tsx` **(NEW)**: channel-toggle page
- `packages/admin/src/pages/Settings.tsx`: Notifications nav card
- `packages/admin/src/main.tsx`: `/settings/notifications` route

### Tests
- `packages/server/src/__tests__/unit/notify-order-ready.test.ts` **(NEW)**: 17 tests — channel/contact/toggle matrix, table labels, best-effort resilience
- `packages/server/src/__tests__/unit/socket.test.ts` **(NEW)**: 5 tests — real `suppressPush` guard and `sendExpoPush` token validation
- `packages/server/src/__tests__/unit/email.test.ts`: 5 `orderReadyEmail` tests
- `packages/server/src/__tests__/integration/order.test.ts`: 10-test READY fan-out matrix incl. READY→READY idempotency, automation payload sanitization, and response sanitization
- `packages/server/src/__tests__/integration/settings.test.ts` **(NEW)**: 5 tests — notification settings auth, RBAC, validation, and partial-update merge behavior

### Documentation
- `packages/docs/features/order-notifications.md` **(NEW)** + VitePress sidebar entry (`.vitepress/config.ts`)
- `packages/docs/configuration/email-sms.md`, `packages/docs/features/ordering.md`, `packages/docs/features/settings.md`, `packages/docs/api/settings.md`, `packages/docs/api/orders.md`, `packages/docs/mobile-app/push-notifications.md`, `README.md`: updated for the new group and READY behaviour

### Specs
- `specs/completed/order-ready-notifications.md`: all tasks checked, phase summaries added, final audit complete
- `specs/draft/settings-group-handler-factory.md` **(NEW)**: follow-up refactor spec for the 8×-duplicated settings-group handler pattern

## Test Results

- Tests run: 386 (server: 61 unit + 325 integration)
- Passed: 386
- Failed: 0
- Type checks clean (`tsc` server + admin); docs build clean. ESLint could not run — config broken repo-wide, pre-existing, tracked by `specs/draft/repair-eslint-config.md`.

## Finalization

Final audit found and fixed two medium issues: unchanged status PATCHes no longer write the order or audit noise, and automation `order.statusChanged` payloads no longer expose notification-only customer contact fields or table data. The user-facing changelog was updated, and the spec has been moved to `specs/completed/order-ready-notifications.md`.

The settings-handler duplication remains captured in `specs/draft/settings-group-handler-factory.md`, keeping that refactor separate from this user-visible notification feature.
