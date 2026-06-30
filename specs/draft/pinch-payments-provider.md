# Pinch Payments Provider

## Status: Draft

<!-- Status values: Draft | In Progress | Complete | On Hold | Cancelled -->
<!-- Folder must match status: draft/ | in-progress/ | completed/ | on-hold/ | cancelled/ -->

## Objective

Add [Pinch Payments](https://getpinch.com.au) as a first-class, toggleable online payment provider alongside the existing Stripe and PayPal integrations, following the established provider pattern so it is generic and upstreamable.

## Problem Statement

1. **Only Stripe and PayPal are supported** — `packages/server/src/lib/` has `stripe.ts` and `paypal.ts`; `PaymentMethod` (`prisma/schema.prisma:432`) is `CASH | STRIPE | PAYPAL`. There is no Australian gateway, and Pinch is the gateway this deployment wants (it drives the operator's commission).
2. **Payment provider config is closed-set** — `paymentSettingsSchema` (`packages/server/src/controllers/settings.controller.ts:213`) and the admin UI (`packages/admin/src/pages/SettingsPayments.tsx`) only know about Stripe/PayPal/cash keys.
3. **Checkout offers a fixed provider list** — `packages/storefront/src/pages/Checkout.tsx` only surfaces the existing providers.

## Current Architecture

The codebase has a clean, repeatable per-provider pattern. Adding a provider touches the same six layers each time (PayPal is the closest analogue — a REST gateway integrated via `fetch`, not an SDK).

### Key Files

| File | Role |
|------|------|
| `prisma/schema.prisma:432` | `PaymentMethod` enum (`CASH | STRIPE | PAYPAL`) |
| `prisma/schema.prisma:445` | `Payment` model — `method`, `status`, `amount`, `transactionId`, `metadata` |
| `packages/server/src/lib/paypal.ts` | Provider lib: reads config from `siteSettings.paymentSettings`, `fetch`-based REST calls, `create`/`capture` |
| `packages/server/src/controllers/payment.controller.ts:271` | `createPayPalPayment` / `capturePayPalPayment` controller pattern |
| `packages/server/src/routes/payment.routes.ts:21` | `POST /paypal/create`, `POST /paypal/capture` route pattern |
| `packages/server/src/controllers/settings.controller.ts:213` | `paymentSettingsSchema`; secret masking at `:378` and `preserveIfMasked` at `:395` |
| `packages/admin/src/pages/SettingsPayments.tsx` | Admin UI for provider credentials + enable toggles |
| `packages/storefront/src/pages/Checkout.tsx` | Storefront payment-method selection |
| `packages/server/src/__tests__/integration/payment.test.ts` | Integration tests for the payment endpoints |

Config flows through `siteSettings.paymentSettings` (a JSON blob, see `prisma/schema.prisma:581`). Each provider lib reads its keys from there with an env-var fallback (`paypal.ts:3-23`). Secrets are masked on read and preserved on write when the client echoes back the mask.

## Design

Mirror the PayPal integration. Pinch is a token-authenticated REST gateway; we use its **hosted Payment Link** flow (the closest analogue to the existing Stripe Checkout): mint an access token from credentials, create/look-up a payer, create a payment link for the order total in AUD, redirect the customer to the link, and confirm via a signed webhook that flips `Order.status` to `CONFIRMED` — exactly as the Stripe webhook and PayPal capture paths do.

API details below are taken from the [Pinch API docs](https://docs.getpinch.com.au/) (`reference/save-payer`, `reference/create-payment-link`, `docs/webhooks`, `docs/application-authentication`).

> ⚠️ **Two values to confirm in the Pinch portal/docs at implementation time**: the exact **API base URL** (live + test) and the **access-token endpoint** (the auth docs describe exchanging Merchant Id + Secret *or* Application Id + Secret for an access token, but don't fix the host in the pages reviewed). Everything else below (endpoints, fields, webhook verification) is grounded in the docs. Every request must include the `pinch-version` header.

### 1. Schema — add `PINCH` to `PaymentMethod`

```prisma
enum PaymentMethod {
  CASH
  STRIPE
  PAYPAL
  PINCH
}
```

Additive enum value → a non-destructive migration.

### 2. Provider lib — `packages/server/src/lib/pinch.ts`

Same structure as `paypal.ts` — config from `siteSettings.paymentSettings` with env fallback, then `fetch`-based REST calls. Auth parallels PayPal: exchange credentials for an access token, then send it as a Bearer token (plus the required `pinch-version` header) on every call.

```ts
async function getPinchConfig() {
  // merchantId/secretKey (or appId/secret), sandbox, webhookSecret — from
  // paymentSettings, falling back to PINCH_* env vars (mirror paypal.ts:3-23)
  // baseUrl: live vs test  ⚠️ confirm hosts
  // pinchVersion: required 'pinch-version' header value  ⚠️ confirm
}

async function getAccessToken(): Promise<{ token: string; baseUrl: string }> {
  // POST credentials -> access token  ⚠️ confirm token endpoint (like paypal.ts:25)
}

// POST /payers  { firstName, emailAddress } -> { id: 'pyr_…' }
async function ensurePayer(name: string, email: string): Promise<string> { /* returns payerId */ }

// POST /payment-links
//   { amount: <cents int>, currency: 'AUD', payerId, description,
//     allowedPaymentMethods: [...], returnUrl, metadata: { orderId, orderNumber } }
// -> { id: 'plk_…', url }   (customer is redirected to `url`)
export async function createPinchPaymentLink(order): Promise<{ linkId: string; url: string }> { … }

// Verify the `pinch-signature` header: format `t=<ts>,v2=<hmac>` where
// v2 = HMAC(`${t}.${rawBody}`, webhookSecret); reject if ts outside tolerance.
export function verifyPinchSignature(rawBody: Buffer, header: string, secret: string): boolean { … }
```

**Currency & amount**: Pinch `amount` is an **integer in cents**; `currency` accepts `"AUD"` (defaults to the merchant's currency if omitted). Use `Math.round(order.total * 100)` and pass `currency: 'AUD'`. The existing hardcoded `'eur'`/`'USD'` in the other providers is a pre-existing inconsistency (see Risks); this spec uses AUD for Pinch and does not refactor the others.

**Order reference**: pass our `orderId`/`orderNumber` in the payment-link `metadata` — the docs state metadata transfers onto the resulting Payment object, so the webhook can resolve our order.

### 3. Controller — `payment.controller.ts`

Add `createPinchPayment` and `handlePinchWebhook`. `createPinchPayment` reuses the existing guards verbatim — 400 when `orderId` missing, 404 when order not found, 409 when a `COMPLETED` payment already exists (`payment.controller.ts:285-291`) — then `ensurePayer` → `createPinchPaymentLink`, creates a `Payment` row (`method: 'PINCH'`, `status: 'PENDING'`, `transactionId: linkId`), and returns `{ url }` for the client to redirect to (mirrors `createPayPalPayment` returning `approvalUrl`, and `createCheckoutSession` returning a redirect `url`).

`handlePinchWebhook` verifies the `pinch-signature`, and on the payment-success event (`event.Type`) resolves the order via `Data`/`Metadata` (our `orderId`), flips the `Payment` to `COMPLETED` and `Order.status` to `CONFIRMED` — structurally identical to the Stripe `payment_intent.succeeded` case (`payment.controller.ts:192-209`). ⚠️ confirm the exact success/failure event-type names on the Pinch Events page.

### 4. Routes — `payment.routes.ts`

```ts
router.post('/pinch/create', optionalAuth, createPinchPayment);
// Raw body for signature verification — mount like the Stripe webhook (app.ts:78, payment.routes.ts:9)
router.post('/pinch/webhook', express.raw({ type: 'application/json' }), handlePinchWebhook);
```

The Pinch webhook URL must be registered (Pinch portal or `create-or-update-webhook` API) pointing at `/api/payments/pinch/webhook`.

### 5. Settings — `settings.controller.ts`

Extend `paymentSettingsSchema` with `pinchEnabled`, `pinchMerchantId` (or `pinchAppId`), `pinchSecretKey`, `pinchWebhookSecret`, `pinchSandbox` (all `.optional()`). Mask `pinchSecretKey` and `pinchWebhookSecret` in `getPaymentSettings` (`:378`) and run them through `preserveIfMasked` in `updatePaymentSettings` (`:395`). Update the `paymentSettings` field comment in `prisma/schema.prisma:581` to list the new keys.

### 6. Admin UI — `SettingsPayments.tsx`

Add a Pinch card mirroring the PayPal card: enable toggle, Merchant Id, Secret Key (masked), Webhook Secret (masked), sandbox toggle.

### 7. Storefront — `Checkout.tsx`

Add Pinch to the payment-method options, gated on `pinchEnabled`. On selection, call `POST /api/payments/pinch/create`, redirect the browser to the returned Pinch payment-link `url`; Pinch redirects back to `returnUrl` (`/order/:id?paid=true`, with `paymentLinkId`/`paymentId` appended) while the webhook does the authoritative status flip — same redirect-then-webhook shape as the Stripe Checkout path.

## Implementation Order

### Phase 1: Schema & contracts
<!-- packages: server -->

- [ ] **T1.1** Add `PINCH` to `PaymentMethod` enum in `prisma/schema.prisma` `[server]` `[~1 LOC]`
- [ ] **T1.2** Generate migration (`npm run db:migrate -w packages/server`) and verify it is additive `[server]` `[~5 LOC]` — depends: T1.1
- [ ] **T1.3** Update `paymentSettings` field comment with the new pinch keys `[server]` `[~1 LOC]`

### Phase 2: Server provider integration
<!-- depends: Schema & contracts | packages: server -->

- [ ] **T2.1** Create `packages/server/src/lib/pinch.ts`: `getPinchConfig`, `getAccessToken`, `ensurePayer` (`POST /payers`), `createPinchPaymentLink` (`POST /payment-links`), `verifyPinchSignature`. Confirm base URL + token endpoint against the portal `[server]` `[~110 LOC]`
- [ ] **T2.2** Add `createPinchPayment` (guards + payer + link + Payment row, returns `url`) to `payment.controller.ts` `[server]` `[~55 LOC]` — depends: T2.1
- [ ] **T2.3** Add `handlePinchWebhook` (verify signature, resolve order via metadata, flip Payment+Order) `[server]` `[~50 LOC]` — depends: T2.1
- [ ] **T2.4** Add `/pinch/create` and raw-body `/pinch/webhook` routes to `payment.routes.ts` `[server]` `[~6 LOC]` — depends: T2.2, T2.3
- [ ] **T2.5** Extend `paymentSettingsSchema` + masking + `preserveIfMasked` for pinch keys `[server]` `[~14 LOC]` — depends: T1.1

### Phase 3: Clients
<!-- depends: Server provider integration | packages: admin, storefront -->

- [ ] **T3.1** Add Pinch credentials card to `SettingsPayments.tsx` `[admin]` `[~50 LOC]` — depends: T2.4
- [ ] **T3.2** Add Pinch payment option + create/capture flow to `Checkout.tsx`, gated on `pinchEnabled` `[storefront]` `[~60 LOC]` — depends: T2.3

### Phase 4: Tests & docs
<!-- depends: Server provider integration | packages: server, docs -->

- [ ] **T4.1** Integration tests in `payment.test.ts` for create + webhook confirmation, 404/409 guards, signature rejection, and order-status flip (Pinch HTTP mocked) `[server]` `[~80 LOC]` — depends: T2.4
- [ ] **T4.2** Document Pinch setup under `packages/docs/configuration/` `[docs]` `[~30 LOC]` — depends: T3.1, T3.2

## Testing Strategy

### Unit Tests

| Test File | What It Tests |
|-----------|--------------|
| `packages/server/src/__tests__/unit/pinch.test.ts` (**NEW**) | `getPinchConfig` precedence (settings over env), AUD amount formatting, base-URL selection by sandbox flag |

### Integration / E2E Tests

Extend `packages/server/src/__tests__/integration/payment.test.ts` (Pinch HTTP layer mocked):
- `POST /api/payments/pinch/create` creates a `PENDING` `PINCH` payment and returns the approval handle.
- Returns 404 for unknown `orderId`, 409 when a `COMPLETED` payment already exists.
- Capture/webhook flips `Payment.status → COMPLETED` and `Order.status → CONFIRMED`.
- Masked `pinchApiKey` round-trips through settings without being overwritten by the mask.

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Pinch API shape assumed here is wrong | Endpoints/fields marked ⚠️; confirm against Pinch docs in T2.1 before wiring controllers |
| Currency mismatch — other providers hardcode EUR/USD, Pinch uses AUD | Scope Pinch to AUD; log a follow-up to make currency configurable from `generalSettings.defaultCurrency` (Out of Scope) |
| Webhook vs. capture confirmation model unknown | Implement whichever Pinch uses; if webhook, reuse the raw-body + signature-verification pattern already proven for Stripe (`app.ts:78`) |
| API key leakage | Reuse existing `maskSecret`/`preserveIfMasked` so the key is never returned in plaintext |

## Out of Scope

- Refactoring Stripe/PayPal to a shared provider interface — note the duplication but don't unify it here (own spec if desired).
- Making payment currency configurable across all providers (currently EUR/USD hardcoded) — separate spec.
- Pinch recurring/direct-debit or subscription features — only one-off order payment is in scope.
- Refunds via Pinch (the `REFUNDED` status exists but no provider currently issues refunds programmatically).

## Files to Change

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `PINCH` to `PaymentMethod`; update `paymentSettings` comment |
| `prisma/migrations/<new>/migration.sql` | **NEW** — additive enum migration |
| `packages/server/src/lib/pinch.ts` | **NEW** — provider lib |
| `packages/server/src/controllers/payment.controller.ts` | Add `createPinchPayment` / `capturePinchPayment` |
| `packages/server/src/routes/payment.routes.ts` | Add Pinch routes |
| `packages/server/src/controllers/settings.controller.ts` | Extend schema + masking |
| `packages/admin/src/pages/SettingsPayments.tsx` | Pinch credentials card |
| `packages/storefront/src/pages/Checkout.tsx` | Pinch payment option + flow |
| `packages/server/src/__tests__/unit/pinch.test.ts` | **NEW** — unit tests |
| `packages/server/src/__tests__/integration/payment.test.ts` | Pinch integration tests |
| `packages/docs/configuration/` | **NEW** Pinch setup page |

## Documentation Impact

- [ ] `packages/docs/configuration/` — new "Pinch Payments" setup/config page (API key, sandbox, enabling)
- [ ] `packages/docs/features/` — add Pinch to the list of supported payment providers
