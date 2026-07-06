# Settings-Group Handler Factory

## Status: Draft

<!-- Status values: Draft | In Progress | Complete | On Hold | Cancelled -->
<!-- Folder must match status: draft/ | in-progress/ | completed/ | on-hold/ | cancelled/ -->

## Objective

Collapse the eight near-identical settings-group handler pairs in `packages/server/src/controllers/settings.controller.ts` into a single `createSettingsGroupHandlers(field, schema, options?)` factory, so adding the ninth group is one line instead of ~20 duplicated ones.

## Problem Statement

`settings.controller.ts` (~480 lines) repeats the same pattern eight times — general, order, reservation, mail, payment, review, advanced, notification: a `get{Group}Settings` that calls `getSettingsGroup(field)` and an `update{Group}Settings` that Zod-`safeParse`s the body, 400s on failure, and calls `updateSettingsGroup(field, data)`. Mail and payment add secret masking (`maskSecret`/`preserveIfMasked`) on top. Flagged by the refactorer during `order-ready-notifications` (2026-07-05) as duplication that shouldn't grow further; too large to fix in that branch (~all 8 groups touched, plus `settings.routes.ts` imports).

## Implementation Order (rough)

### Phase 1: Factory & migration

- [ ] **T1.1** Add `createSettingsGroupHandlers(field, schema, { maskedFields? })` returning `{ get, update }`, with masked-field support covering the mail/payment cases `[server]` `[~50 LOC]`
- [ ] **T1.2** Migrate all eight groups to the factory; keep exported handler names (or re-export from the factory result) so `settings.routes.ts` and tests keep working `[server]` `[~-120 LOC net]`
- [ ] **T1.3** Run full server suite; confirm masked-secret round-trip behaviour unchanged for mail/payment `[server]`

## Out of Scope

- Changing any route paths, roles, or response shapes.
- The non-group branding endpoints (`getSettings`/`updateSettings`, logo/favicon uploads).
