# Delivery-Zone Query Dedup & Error i18n

## Status: Draft

<!-- Status values: Draft | In Progress | Complete | On Hold | Cancelled -->
<!-- Folder must match status: draft/ | in-progress/ | completed/ | on-hold/ | cancelled/ -->

## Objective

Eliminate a redundant delivery-zone database query in `createOrder` and fix an inconsistent German error message, both pre-existing in the delivery flow.

## Problem Statement

In `packages/server/src/controllers/order.controller.ts`, a `DELIVERY` order with coordinates runs `prisma.deliveryZone.findMany({ where: { locationId, isActive: true } })` **twice** with identical arguments:

1. Around `order.controller.ts:136` — to compute the delivery fee (`zones`/`matchedZone` are scoped inside the `if (address?.lat != null)` block).
2. Around `order.controller.ts:241` — again, to enforce the per-zone minimum order value.

The second query is a straight duplicate (extra DB round-trip per delivery order). Additionally, the minimum-order rejection message near `:280` is in **German** (`Mindestbestellwert für diese Lieferzone …`) while every other error in this controller is in English.

*(Surfaced by the `refactorer` during the `qr-ordering` work; out of that feature's scope — delivery flow only, unrelated to dine-in.)*

## Design

Hoist `zones` and `matchedZone` to the outer `DELIVERY` scope so they're fetched once, then reuse `matchedZone.minOrder` for the minimum-order check after the subtotal is computed. Translate the German error string to English to match the rest of the file.

## Implementation Order

### Phase 1: Dedup + i18n
<!-- packages: server -->

- [ ] **T1.1** Hoist `zones`/`matchedZone` fetch to a single pass in the DELIVERY branch; remove the second `deliveryZone.findMany` `[server]` `[~25 LOC]`
- [ ] **T1.2** Translate the German minimum-order error message to English `[server]` `[~2 LOC]`
- [ ] **T1.3** Add/extend integration tests asserting one zone query and the English error `[server]` `[~30 LOC]` — depends: T1.1, T1.2

## Testing Strategy

Extend `packages/server/src/__tests__/integration/order.test.ts`: assert `deliveryZone.findMany` is called once for a delivery order, and that the below-minimum rejection returns the English message.

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Refactor changes delivery-fee or minimum-order behaviour | Cover both paths (matched zone, no zone, below-minimum) with tests before refactoring |

## Out of Scope

- Any change to dine-in / pickup order paths.
- Broader i18n of server error messages beyond this one string.

## Files to Change

| File | Change |
|------|--------|
| `packages/server/src/controllers/order.controller.ts` | Single zone fetch; English error message |
| `packages/server/src/__tests__/integration/order.test.ts` | Query-count + message assertions |

## Documentation Impact

- [ ] None — internal refactor, no user-facing or API change.
