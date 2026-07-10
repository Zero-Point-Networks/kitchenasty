# Express Async Error Handling and Input Bounds

## Status: Draft

## Objective

Stop a single rejected promise in any async Express handler from taking down the whole server process, and bound the request input that those handlers parse.

## Problem Statement

Found during the `/wf:finalize` audit of `table-natural-name-ordering`. Neither issue was introduced by that spec; both are pre-existing.

1. **Express 4 does not forward async rejections, and nothing else catches them** — the server runs `express@4.22.1` (`packages/server/package.json`). Express 4 only routes *synchronous* throws to error middleware; a rejected promise returned from an `async` handler is ignored. There is no `express-async-errors` import, no `asyncHandler` wrapper, and no `process.on('unhandledRejection', …)` anywhere under `packages/server/src` — verified by grep, all three return nothing.
2. **Controllers `await` Prisma with no `try/catch`** — `packages/server/src/controllers/table.controller.ts` and `packages/server/src/controllers/location.controller.ts` contain **zero** `try` blocks. `listTables` awaits `prisma.location.findUnique` at `table.controller.ts:17` and `prisma.table.findMany` at `:26`; `getLocation` awaits `prisma.location.findUnique` at `location.controller.ts:81`. If Postgres drops a connection, times out, or the query is malformed, the returned promise rejects, the rejection is unhandled, and on Node ≥15 the default `unhandledRejection` behaviour terminates the process. One failing request kills every in-flight request for every other user.
3. **The affected endpoints are unauthenticated** — `router.get('/:id', getLocation)` (`packages/server/src/routes/location.routes.ts:32`) and `router.get('/:locationId/tables', listTables)` (`:51`) carry no `authenticate` middleware. So the blast radius of a DB blip is reachable from an anonymous request.
4. **Table names have no length bound** — `createTableSchema` (`packages/server/src/controllers/table.controller.ts:7-11`) declares `name: z.string().min(1)` with no `.max()`, and Prisma's `Table.name` is an unbounded `String`. `express.json()` caps a body at 100kb, so one name can be tens of kilobytes. Since `table-natural-name-ordering` moved sorting out of Postgres and into the Node event loop, every read of the two public endpoints above now regex-splits and lowercases those names once per comparison, so the CPU cost scales with input an operator controls. Writing such a name requires `SUPER_ADMIN` or `MANAGER`, so this is an operator footgun rather than an anonymous attack, which is why it is a low-severity companion to items 1–3 rather than its own spec.

## Current Architecture

`packages/server/src/app.ts` builds the Express app, mounts `helmet`, `cors`, a global rate limiter (100 requests / 15 minutes / IP), `express.json()`, then the routers, and finally an error-handling middleware. That middleware only ever fires for synchronous throws and for errors passed to `next(err)` — which no controller does.

Every controller in `packages/server/src/controllers/` is an `async (req, res) => void` mounted directly on a route. `reservation.controller.ts` is the sole file with a `try` block, and it is scoped to one handler.

### Key Files

| File | Role |
|------|------|
| `packages/server/src/app.ts` | Builds the app; hosts the error-handling middleware that async rejections never reach |
| `packages/server/src/index.ts` | Process entry point; registers no `unhandledRejection` handler |
| `packages/server/src/routes/*.routes.ts` | Mount async controllers directly on routes |
| `packages/server/src/controllers/*.controller.ts` | ~15 files of unguarded `async` handlers |
| `packages/server/src/controllers/table.controller.ts` | Also hosts the unbounded `createTableSchema.name` |

## Design

### Wrap Async Handlers

Add `packages/server/src/lib/async-handler.ts` exporting:

```ts
export function asyncHandler<P>(
  fn: (req: Request<P>, res: Response, next: NextFunction) => Promise<void>
): RequestHandler
```

It invokes `fn` and attaches `.catch(next)`, so a rejection reaches the existing error middleware and becomes a 500 instead of a process exit. Apply it at the route-mount sites, which keeps the controllers themselves unchanged and makes the wrapping auditable in one place per router.

**Alternative considered and rejected**: upgrading to Express 5, which forwards async rejections natively. That is the better long-term answer, but it is a breaking major with its own migration surface (path-to-regexp syntax changes, `req.query` becoming a getter). Track it separately; this spec should be safe to land in an afternoon.

### Register a Process-Level Backstop

In `packages/server/src/index.ts`, register `process.on('unhandledRejection', …)` to log via the existing Pino logger and, for an unhandled rejection specifically, keep the process alive. This is a backstop, not the fix — the wrapper is the fix. Without it, any handler missed by the wrapper still kills the process silently.

### Harden the Error Middleware

Confirm the error middleware in `app.ts` never leaks a stack trace or a Prisma error message to the client. Prisma errors embed the query and sometimes column values.

### Bound Table Name Length

Add `.max(120)` to `name` in `createTableSchema`, which `updateTableSchema` inherits via `.partial()`. Choose the bound so it cannot reject any name already in the database — check `SELECT max(length(name)) FROM tables;` during implementation and raise the bound if a real name exceeds it. Do not add a Prisma `@db.VarChar` constraint in this spec; that needs a migration and would fail on existing rows.

## Implementation Order

### Phase 1: Async Handler Wrapper
<!-- packages: server -->

- [ ] **T1.1** Add `asyncHandler` in `packages/server/src/lib/async-handler.ts` `[server]` `[~20 LOC]`
- [ ] **T1.2** Add unit tests proving a rejected handler calls `next(err)` rather than rejecting `[server]` `[~40 LOC]` - depends: T1.1
- [ ] **T1.3** Wrap every async handler at its route-mount site across `packages/server/src/routes/` `[server]` `[~120 LOC]` - depends: T1.1
- [ ] **T1.4** Add an integration test asserting a Prisma rejection yields a 500, not an unhandled rejection `[server]` `[~35 LOC]` - depends: T1.3

### Phase 2: Backstop and Hardening
<!-- packages: server -->

- [ ] **T2.1** Register an `unhandledRejection` logger in `packages/server/src/index.ts` `[server]` `[~15 LOC]` - depends: T1.3
- [ ] **T2.2** Verify the error middleware never returns a stack trace or Prisma message to the client; add a test `[server]` `[~30 LOC]`
- [ ] **T2.3** Add `.max(120)` to `createTableSchema.name` after confirming no existing row exceeds it; add a 400 test `[server]` `[~20 LOC]`

## Testing Strategy

### Unit Tests

`packages/server/src/__tests__/unit/async-handler.test.ts` — a handler that rejects calls `next` with the error; a handler that resolves does not.

### Integration Tests

| Test File | What It Tests |
|-----------|--------------|
| `packages/server/src/__tests__/integration/error-handling.test.ts` | Mock `prisma.location.findUnique` to reject; assert `GET /api/locations/:id` returns 500 and the process survives |
| `packages/server/src/__tests__/integration/table.test.ts` | `POST` a name over the bound returns 400 |

### Verification Commands

- `npm run test -w packages/server`
- `npx tsc --noEmit -p packages/server`

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Wrapping ~15 routers by hand misses a handler | Add a test that walks the router stack and asserts every layer is wrapped, or lint for bare `async` in route mounts |
| `.max(120)` rejects an existing table name on edit | Query `max(length(name))` before choosing the bound; raise it if needed |
| Keeping the process alive on `unhandledRejection` masks a corrupt state | Log at `fatal`, include the stack, and treat recurring hits as a bug to fix rather than a steady state |

## Out of Scope

- Upgrading to Express 5 (tracked separately; the wrapper makes it non-urgent).
- Adding a Prisma `@db.VarChar` migration for `Table.name`.
- Auditing authorization on the two public GET endpoints — they are intentionally public for the storefront.
- Rate-limit tuning.

## Files to Change

| File | Change |
|------|--------|
| `packages/server/src/lib/async-handler.ts` | **NEW** — the wrapper |
| `packages/server/src/routes/*.routes.ts` | Wrap async handlers at mount sites |
| `packages/server/src/index.ts` | Register the `unhandledRejection` backstop |
| `packages/server/src/app.ts` | Confirm the error middleware leaks nothing |
| `packages/server/src/controllers/table.controller.ts` | `.max(120)` on `createTableSchema.name` |
| `packages/server/src/__tests__/unit/async-handler.test.ts` | **NEW** |
| `packages/server/src/__tests__/integration/error-handling.test.ts` | **NEW** |

## Documentation Impact

- [ ] None expected — internal robustness. Revisit if the `.max()` bound becomes user-visible in the admin UI.
