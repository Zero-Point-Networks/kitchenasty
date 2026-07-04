# Table Natural Name Ordering

## Status: Draft

## Objective

Sort tables in location table menus by natural name order so alphabetic names come before numbered table labels and numeric suffixes sort by number.

## Problem Statement

1. **Numeric table names sort lexicographically today** - `packages/server/src/controllers/table.controller.ts:22-28` asks Prisma for `orderBy: { name: 'asc' }`, so names such as `Table 1`, `Table 10`, and `Table 2` are returned in string order rather than the expected natural order.
2. **Location detail embeds the same lexicographic table order** - `packages/server/src/controllers/location.controller.ts:80-86` includes `tables: { orderBy: { name: 'asc' } }`, so callers that load a location with tables can see the same incorrect order.
3. **The admin table screen trusts API order** - `packages/admin/src/pages/TableList.tsx:32-40` stores `tableRes.data` directly and `packages/admin/src/pages/TableList.tsx:218-245` renders `tables.map(...)` without additional sorting, so the API order is the visible order in the location table menu.

## Current Architecture

Tables are nested under location routes in `packages/server/src/routes/location.routes.ts:41-46`. `GET /api/locations/:locationId/tables` is handled by `listTables` in `packages/server/src/controllers/table.controller.ts`, which verifies the location exists and returns matching tables with reservation counts. The admin table management page at `/locations/:locationId/tables` fetches both the location and the table list, then renders the rows in the received order.

The `GET /api/locations/:id` endpoint in `packages/server/src/controllers/location.controller.ts` also includes tables in the response. Even if the admin table page primarily uses `listTables`, location detail consumers should receive the same natural table ordering to keep the API contract consistent.

### Key Files

| File | Role |
|------|------|
| `packages/server/src/controllers/table.controller.ts` | Lists, creates, updates, and deletes tables for a location |
| `packages/server/src/controllers/location.controller.ts` | Returns location details with embedded tables |
| `packages/server/src/__tests__/integration/table.test.ts` | Existing integration coverage for table endpoints with mocked Prisma |
| `packages/server/src/__tests__/integration/location.test.ts` | Existing integration coverage for location endpoints with mocked Prisma |
| `packages/admin/src/pages/TableList.tsx` | Renders the admin table management list in API order |
| `e2e/admin/tables.spec.ts` | Existing admin table management smoke coverage |

## Design

### Natural Table Name Comparator

Add a small server-side helper that compares table names using deterministic natural ordering:

- Compare alphabetic text case-insensitively first.
- Compare numeric runs as numbers, so `Table 2` sorts before `Table 10`.
- Keep a deterministic final tie-breaker using the original string.

The desired example order is:

```ts
['Bob', 'Table 1', 'Table 2', 'Table 3', 'Table 10']
```

Implementation should keep the database query simple and sort the returned rows in memory after Prisma fetches the location's tables. A helper local to the server package is enough unless another existing server utility location is a better fit during implementation.

### Apply the Same Ordering to Both Table Surfaces

Use the helper in:

- `listTables` after `prisma.table.findMany(...)` returns rows.
- `getLocation` after loading the location with included tables, before returning the response.

Do not sort in `TableList.tsx`; the admin UI should continue to render API order. Keeping the behavior server-side makes API responses, admin UI, and future clients consistent.

## Implementation Order

### Phase 1: Server Natural Table Ordering
<!-- packages: server, admin -->

- [ ] **T1.1** Add a natural table-name comparator/helper in the server package `[server]` `[~45 LOC]`
- [ ] **T1.2** Apply the comparator to `listTables` responses and `getLocation` embedded tables `[server]` `[~20 LOC]` - depends: T1.1
- [ ] **T1.3** Add server integration tests for `Bob`, `Table 1`, `Table 2`, `Table 10` ordering on table list and location detail responses `[server]` `[~45 LOC]` - depends: T1.1, T1.2
- [ ] **T1.4** Add or update admin E2E coverage to assert the table management screen renders API-provided natural order without client-side lexicographic sorting `[admin]` `[~35 LOC]` - depends: T1.2

Tasks T1.3 and T1.4 can be worked after T1.2 and do not depend on each other.

## Testing Strategy

### Unit Tests

No dedicated server unit test is required if the comparator is covered through integration tests. If the helper becomes exported from a standalone utility, add focused unit cases in `packages/server/src/__tests__/unit/table-name-sort.test.ts` for mixed names such as `Bob`, `Table 1`, `Table 2`, `Table 10`, and case variants.

### Integration / E2E Tests

| Test File | What It Tests |
|-----------|--------------|
| `packages/server/src/__tests__/integration/table.test.ts` | Extend `GET /api/locations/:locationId/tables` tests to mock rows in lexicographic or scrambled order and assert the API returns `Bob`, `Table 1`, `Table 2`, `Table 10` |
| `packages/server/src/__tests__/integration/location.test.ts` | Extend `GET /api/locations/:id` tests to assert embedded `tables` use the same natural order |
| `e2e/admin/tables.spec.ts` | Mock or seed table rows and assert the admin table management list displays `Bob` above `Table 1`, and `Table 2` before `Table 10` |

### Verification Commands

- `npm run test -w packages/server -- src/__tests__/integration/table.test.ts src/__tests__/integration/location.test.ts`
- `npx playwright test e2e/admin/tables.spec.ts --project=admin`
- `npm run build -w packages/server`
- `npm run build -w packages/admin`

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| In-memory sorting could interact poorly with pagination | Table lists for a single restaurant location are small; keep sorting scoped to the already-fetched location table list and do not introduce pagination changes in this spec |
| Natural ordering semantics may be locale-dependent | Use deterministic ASCII and numeric-token comparison, not default locale sorting |
| Location detail and table list could drift | Add tests for both `listTables` and `getLocation` so both API surfaces use the same helper |

## Out of Scope

- Adding a new table sort-order field or migration.
- Reordering reservations, orders, locations, categories, or other non-table entities.
- Changing table create/update validation or uniqueness rules.
- Redesigning the admin table management UI.

## Files to Change

| File | Change |
|------|--------|
| `packages/server/src/controllers/table.controller.ts` | Sort listed tables with natural table-name order |
| `packages/server/src/controllers/location.controller.ts` | Sort embedded location tables with the same natural table-name order |
| `packages/server/src/__tests__/integration/table.test.ts` | Add natural ordering coverage for table list responses |
| `packages/server/src/__tests__/integration/location.test.ts` | Add natural ordering coverage for embedded location tables |
| `e2e/admin/tables.spec.ts` | Add admin UI ordering coverage |
| `packages/server/src/lib/table-name-sort.ts` | **NEW** if implementation uses a shared server helper |

## Documentation Impact

- [ ] None - this fixes ordering behavior in an existing admin/API workflow and does not change user-facing docs or API shapes.
