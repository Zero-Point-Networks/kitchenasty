# Table Natural Name Ordering

## Status: In Progress

## Objective

Sort tables in location table menus by natural name order so alphabetic names come before numbered table labels and numeric suffixes sort by number.

## Problem Statement

1. **Numeric table names sort lexicographically today** - `packages/server/src/controllers/table.controller.ts:22-28` asks Prisma for `orderBy: { name: 'asc' }`, so names such as `Table 1`, `Table 10`, and `Table 2` are returned in string order rather than the expected natural order.
2. **Location detail embeds the same lexicographic table order** - `packages/server/src/controllers/location.controller.ts:80-86` includes `tables: { orderBy: { name: 'asc' } }`, so callers that load a location with tables can see the same incorrect order.
3. **The admin table screen trusts API order** - `packages/admin/src/pages/TableList.tsx:42-54` stores `tableRes.data` directly (line 50) and `packages/admin/src/pages/TableList.tsx:284` renders `tables.map(...)` without additional sorting, so the API order is the visible order in the location table menu.

## Current Architecture

Tables are nested under location routes in `packages/server/src/routes/location.routes.ts:50-57`. `GET /api/locations/:locationId/tables` is handled by `listTables` in `packages/server/src/controllers/table.controller.ts`, which verifies the location exists and returns matching tables with reservation counts. The admin table management page at `/locations/:locationId/tables` fetches both the location and the table list, then renders the rows in the received order.

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

Add a server-side helper at `packages/server/src/lib/table-name-sort.ts` (named exports, matching the other `lib/` modules) that compares table names using deterministic natural ordering. Each name is split into alternating runs of digits and non-digits, and the runs are compared pairwise:

- Compare alphabetic runs case-insensitively.
- Compare numeric runs as numbers, so `Table 2` sorts before `Table 10`.
- When an alphabetic run meets a numeric run, the **numeric run sorts first**. This is the conventional natural-sort default (`sort -V`, Windows Explorer), so a table named `5` precedes `Bob`. The Objective's "alphabetic names come before numbered table labels" is still satisfied for the realistic cases — `Bob` precedes `Table 1` because `B` < `T`, not because of any letters-before-digits rule.
- When one name is a prefix of the other, the shorter name sorts first.
- Keep a deterministic final tie-breaker comparing the original strings, so the sort never depends on input order.

The desired example order is:

```ts
['Bob', 'Table 1', 'Table 2', 'Table 3', 'Table 10']
```

Implementation should keep the database query simple and sort the returned rows in memory after Prisma fetches the location's tables.

**Decision — keep the existing Prisma `orderBy: { name: 'asc' }` clauses.** They become non-authoritative once the in-memory sort runs, but they keep the rows Prisma returns deterministic before sorting, which keeps the tie-breaker meaningful and avoids a behaviour change if a caller ever bypasses the helper. Removing them is not in scope.

### Apply the Same Ordering to Both Table Surfaces

Use the helper in:

- `listTables` after `prisma.table.findMany(...)` returns rows.
- `getLocation` after loading the location with included tables, before returning the response.

Do not sort in `TableList.tsx`; the admin UI should continue to render API order. Keeping the behavior server-side makes API responses, admin UI, and future clients consistent.

## Implementation Order

### Phase 1: Server Natural Table Ordering ✅
<!-- packages: server, admin -->

- [x] **T1.1** Add a natural table-name comparator in `packages/server/src/lib/table-name-sort.ts` `[server]` `[~45 LOC]`
- [x] **T1.2** Apply the comparator to `listTables` responses and `getLocation` embedded tables `[server]` `[~20 LOC]` - depends: T1.1
- [x] **T1.3** Add server unit tests for the comparator in `packages/server/src/__tests__/unit/table-name-sort.test.ts` `[server]` `[~50 LOC]` - depends: T1.1
- [x] **T1.4** Add server integration tests for `Bob`, `Table 1`, `Table 2`, `Table 10` ordering on table list and location detail responses `[server]` `[~45 LOC]` - depends: T1.1, T1.2
- [x] **T1.5** Add or update admin E2E coverage to assert the table management screen renders API-provided natural order without client-side lexicographic sorting `[admin]` `[~35 LOC]` - depends: T1.2

Tasks T1.3, T1.4 and T1.5 can be worked after T1.2 and do not depend on each other.

> **Session notes**: Comparator lives in `packages/server/src/lib/table-name-sort.ts` (55 LOC, named exports `compareTableNames` / `sortTablesByName`). It tokenizes each name into alternating digit/non-digit runs and compares pairwise, falling back to a raw-string tie-break.
>
> **Decision (Russell, in session)**: a numeric run sorts *before* an alphabetic one, so a table named `5` precedes `Bob` — the conventional natural-sort default (`sort -V`), not the letters-before-digits reading the Objective sentence also permits. Recorded in Design.
>
> **Bug caught in Refactor by `code-reviewer`**: the first implementation compared digit runs with `Number(a) - Number(b)`. Past ~309 digits `Number()` overflows to `Infinity`, so `Infinity - Infinity` is `NaN` and both `cmp(a,b)` and `cmp(b,a)` returned `1`, breaking the antisymmetry `Array.prototype.sort` requires; names beyond ~17 digits also lost precision. Digit runs are now compared as strings (strip leading zeros → longer run wins → lexicographic), which is exact at any length. Nothing bounds table-name length: `createTableSchema` has no `.max()` and Prisma's `Table.name` is an unbounded `String`.
>
> **Tests**: 23 unit tests in `packages/server/src/__tests__/unit/table-name-sort.test.ts`, including a five-test comparator-contract block (antisymmetry, reflexivity, transitivity, totality, order-independence) over an adversarial corpus. Reverting the fix fails 5 of them, so they are not vacuous. Integration coverage added to `integration/table.test.ts` and `integration/location.test.ts`; the table test also asserts the Prisma `orderBy` is still passed, guarding the Design decision to keep it.
>
> **E2E**: `e2e/admin/tables.spec.ts` now feeds a *scrambled* fixture and asserts the admin screen renders it verbatim — proving the UI is a pure pass-through and would fail even if someone added a *correct* client-side sort. The earlier pre-sorted fixture (flagged by `test-auditor`) could not catch that.
>
> **Blocked check**: `npm run lint` cannot run — no ESLint config is tracked anywhere in the repo and ESLint is not a dependency. Pre-existing on `main`, not caused by this spec. Raised as `specs/draft/restore-eslint-flat-config.md`.

## Testing Strategy

### Unit Tests

The comparator is a standalone exported utility, so it carries dedicated unit tests in `packages/server/src/__tests__/unit/table-name-sort.test.ts`: the canonical `Bob` / `Table 1` / `Table 2` / `Table 10` ordering, case variants, alphabetic-before-numeric names, names with no digits, names that are pure digits, prefix names (`Table` vs `Table 1`), and stability of the tie-breaker on equal names.

### Integration / E2E Tests

| Test File | What It Tests |
|-----------|--------------|
| `packages/server/src/__tests__/integration/table.test.ts` | Extend `GET /api/locations/:locationId/tables` tests to mock rows in lexicographic or scrambled order and assert the API returns `Bob`, `Table 1`, `Table 2`, `Table 10` |
| `packages/server/src/__tests__/integration/location.test.ts` | Extend `GET /api/locations/:id` tests to assert embedded `tables` use the same natural order |
| `e2e/admin/tables.spec.ts` | Intercept the location and table API calls with `page.route` (the pattern already used in `e2e/admin/settings-general.spec.ts:36`), fulfil them with rows in scrambled order, and assert the admin table list renders `Bob`, `Table 1`, `Table 2`, `Table 10` in that order — proving the UI preserves API order rather than re-sorting lexicographically |

### Verification Commands

- `npm run test -w packages/server -- src/__tests__/unit/table-name-sort.test.ts src/__tests__/integration/table.test.ts src/__tests__/integration/location.test.ts`
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
| `packages/server/src/lib/table-name-sort.ts` | **NEW** — natural table-name comparator |
| `packages/server/src/__tests__/unit/table-name-sort.test.ts` | **NEW** — unit coverage for the comparator |

## Documentation Impact

- [x] None - this fixes ordering behavior in an existing admin/API workflow and does not change user-facing docs or API shapes.

Verified by `docs-reviewer`: `packages/docs/api/locations.md:35-41` (Get Location) and `:127-131` (List Tables) document both affected endpoints but carry no response examples, so nothing states or implies the old lexicographic order. No OpenAPI/Swagger spec exists to regenerate. The `availability` endpoint in `packages/docs/api/reservations.md:18-20` also returns tables but orders by capacity and is untouched. A `CHANGELOG.md` entry under `### Fixed` belongs to `/wf:finalize`, not to this pass.
