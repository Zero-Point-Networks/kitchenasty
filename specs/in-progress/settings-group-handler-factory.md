# Settings-Group Handler Factory

## Status: In Progress

<!-- Status values: Draft | In Progress | Complete | On Hold | Cancelled -->
<!-- Folder must match status: draft/ | in-progress/ | completed/ | on-hold/ | cancelled/ -->

## Objective

Collapse the eight near-identical settings-group handler pairs in `packages/server/src/controllers/settings.controller.ts` into a single `createSettingsGroupHandlers(field, schema, options?)` factory, so adding the ninth group is one factory call instead of ~20 duplicated lines — with **zero behavioural change** to any endpoint.

## Problem Statement

`settings.controller.ts` (480 lines) repeats the same pattern eight times — general, order, reservation, mail, payment, review, advanced, notification: a `get{Group}Settings` that calls `getSettingsGroup(field)` and an `update{Group}Settings` that Zod-`safeParse`s the body, 400s on failure, and calls `updateSettingsGroup(field, data)`. Flagged by the refactorer during `order-ready-notifications` (2026-07-05) as duplication that shouldn't grow further; too large to fix in that branch (~all 8 groups touched).

The eight groups come in **three behavioural variants** the factory must reproduce exactly:

1. **Plain** (general `:252`, order `:271`, reservation `:290`, review `:426`, advanced `:467`): GET returns the stored group; PUT validates and **replaces** the whole group.
2. **Masked** (mail `:309` — `smtpPass`; payment `:382` — `stripeSecretKey`, `stripeWebhookSecret`, `paypalClientSecret`): GET masks each secret via `maskSecret` (`first4...last4`); PUT runs `preserveIfMasked` per secret (a submitted value containing `...` keeps the stored one), replaces the group, and masks the secrets in the response.
3. **Merge-on-update** (notification `:445`): PUT merges `{ ...existing, ...parsed.data }` before writing, so a partial body can't reset omitted toggles.

## Current Architecture

### Key Files

| File | Role |
|------|------|
| `packages/server/src/controllers/settings.controller.ts:145` | `SettingsField` union (`:145-153`); `getSettingsGroup`/`updateSettingsGroup` generic helpers (`:155-167`) |
| `packages/server/src/controllers/settings.controller.ts:127-139` | `maskSecret` / `isMasked` / `preserveIfMasked` utilities |
| `packages/server/src/controllers/settings.controller.ts:173-246` | The eight Zod group schemas |
| `packages/server/src/routes/settings.routes.ts` | Imports the 16 named handlers; role-gated routes (MANAGER+ or SUPER_ADMIN-only per group) |
| `packages/server/src/__tests__/integration/settings.test.ts` | Notification-group coverage: auth, roles, validation, merge-on-update |

`sendTestEmail` (`:340`) and the branding endpoints (`getSettings`/`updateSettings`, logo/favicon uploads) are separate one-offs and stay untouched.

## Design

Add one factory above the group schemas:

```ts
interface SettingsGroupOptions {
  maskedFields?: string[];   // GET + PUT-response masking, preserve-if-masked on PUT
  mergeOnUpdate?: boolean;   // PUT merges over the stored group instead of replacing
}

function createSettingsGroupHandlers(
  field: SettingsField,
  schema: z.ZodType<Record<string, unknown>>,
  options: SettingsGroupOptions = {},
): { get: RequestHandler; update: RequestHandler }
```

- `get`: reads the group, applies `maskSecret` to each `maskedFields` entry, responds `{ success: true, data }`.
- `update`: `safeParse` → 400 with `parsed.error.errors` on failure; applies `preserveIfMasked` per masked field against the stored group; merges over the stored group when `mergeOnUpdate`; writes via `updateSettingsGroup`; responds with masked data.
- Exported handler **names are preserved** so `settings.routes.ts` needs no changes:

```ts
export const { get: getGeneralSettings, update: updateGeneralSettings } =
  createSettingsGroupHandlers('generalSettings', generalSettingsSchema);
// … ×8; mail passes { maskedFields: ['smtpPass'] }, payment its three secrets,
// notification { mergeOnUpdate: true }
```

Ordering note: the `function` declaration for the factory is hoist-safe, but the `export const … = createSettingsGroupHandlers(…)` calls reference the schema `const`s and must sit **after** them (TDZ) — i.e. exactly where the hand-written handlers live today.

Behaviour deliberately **not** standardised in this spec: plain/masked groups keep replace-on-PUT semantics (switching them to merge would change what a full-body PUT with omitted keys does); only the notification group merges, as today.

This is a **pure refactor**: the Red phase writes *characterization tests* against the current implementation (they must pass **before** the refactor), then the factory lands and they must still pass. There is no failing-test step.

## Implementation Order

### Phase 1: Characterization tests ✅
<!-- packages: server -->

- [x] **T1.1** Extend `settings.test.ts` with characterization coverage: plain-group round-trip (review), masked-group GET masking + preserve-if-masked + new-value round-trip (mail, payment), replace semantics for plain groups, role gating for a SUPER_ADMIN-only group `[server]` `[~90 LOC]`

### Phase 2: Factory & migration ✅
<!-- depends: Characterization tests | packages: server -->

- [x] **T2.1** Add `createSettingsGroupHandlers(field, schema, options?)` with `maskedFields` + `mergeOnUpdate` support `[server]` `[~55 LOC]` — depends: T1.1
- [x] **T2.2** Migrate all eight groups to factory calls, deleting the sixteen hand-written handlers; keep exported names; `settings.routes.ts` unchanged `[server]` `[~120 LOC removed]` — depends: T2.1
- [x] **T2.3** Full server suite green; type-check clean; confirm masked-secret round-trip unchanged for mail/payment `[server]` — depends: T2.2

> **Session notes**: Phase 1 — 13 characterization tests added to `settings.test.ts` (review replace semantics + Zod-array 400 envelope; mail masking/preserve/fresh/omitted-secret-drops; payment 3-secret masking + mixed preserve/fresh PUT; MANAGER 403 for mail & payment); test-auditor's gaps (error envelope, payment gating, omitted-secret) all covered; `vi.resetAllMocks()` used in new describes. Phase 2 — `createSettingsGroupHandlers<T extends object>(field, schema, { maskedFields?, mergeOnUpdate? })` sits between the generic helpers and the schemas; 16 handlers replaced by 8 destructured `export const` calls (file 480→373 lines); `sendTestEmail` untouched; `settings.routes.ts` unchanged. 399 server tests green, tsc clean.

## Testing Strategy

### Integration Tests

`packages/server/src/__tests__/integration/settings.test.ts` (extend):
- Plain group (review): GET returns stored group; PUT replaces the whole group (omitted keys dropped); invalid body → 400, no write.
- Masked group (mail): GET masks `smtpPass`; PUT with a masked (`abcd...wxyz`) value preserves the stored secret; PUT with a fresh value stores it and masks it in the response.
- Masked group (payment): same for all three secrets in one PUT.
- Role gating: mail/payment reject MANAGER (403), accept SUPER_ADMIN.
- Existing notification tests (merge-on-update, validation, roles) keep passing untouched.

All tests must pass against the **current** implementation before the factory lands (characterization), and after (regression).

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Subtle behaviour drift (mask format, 400 error shape, merge vs replace) | Characterization tests written first against the current code; factory must keep them green |
| Route imports break when function declarations become consts | Exported names preserved via destructured factory results; `tsc` + route-level integration tests catch misses |
| Notification schema's `z.ZodType<Partial<ReadyChannelToggles>>` typing conflicts with the factory's schema parameter | Factory accepts `z.ZodType<Record<string, unknown>>`-compatible schemas; verify the existing annotation still compiles |

## Out of Scope

- Changing any route paths, roles, response shapes, or merge/replace semantics.
- The non-group branding endpoints (`getSettings`/`updateSettings`, logo/favicon uploads) and `sendTestEmail`.
- Moving schemas or the factory to a separate module (stays in `settings.controller.ts`; the file shrinks well under 400 lines).

## Files to Change

| File | Change |
|------|--------|
| `packages/server/src/controllers/settings.controller.ts` | Add factory; replace 16 handlers with 8 factory calls (~-120 LOC net) |
| `packages/server/src/__tests__/integration/settings.test.ts` | Characterization tests for plain + masked groups, role gating |

## Documentation Impact

- [x] None — internal refactor, no API change. `docs-reviewer` confirmed (2026-07-06): all settings docs describe the user-facing contract only, which is unchanged. **No documentation changes required.**
