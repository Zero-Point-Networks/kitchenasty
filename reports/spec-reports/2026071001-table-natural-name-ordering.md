# Spec Report — Table Natural Name Ordering

Date: 10 July 2026 | Session: interactive

## What Was Delivered

Table lists now read the way a person would write them. A location with tables `Table 1` … `Table 10` used to render `Table 1, Table 10, Table 2` in the admin table-management screen, because the API sorted names as strings. The API now sorts them in natural order, so `Table 2` comes before `Table 10`.

- `GET /api/locations/:locationId/tables` returns tables in natural name order.
- `GET /api/locations/:id` returns its embedded `tables` array in the same order, so both API surfaces agree.
- The admin screen at `/locations/:id/tables` picks the fix up for free — it renders whatever order the API sends and does not sort client-side.
- No request or response *shape* changed. Only the order of an existing array.

Ordering rule: digit runs compare as numbers, letter runs compare case-insensitively, and a digit run sorts before a letter run — so a table named `5` precedes one named `Bob`. This is the conventional natural-sort default (`sort -V`), chosen by Russell in session over the letters-before-digits reading that the spec's objective sentence also permitted.

## Spec Phases Completed

- Phase 1: Server Natural Table Ordering ✅ (T1.1–T1.5)
- Phase 2: Finalization Fixes ✅ (T2.1–T2.4)

## How to Verify

Preconditions: PostgreSQL running and seeded (`docker compose up -d postgres`, then `npm run db:deploy -w packages/server && npm run db:seed -w packages/server` with `DATABASE_URL` set).

1. Start the server: `npm run dev:server`.
2. `curl -s http://localhost:3000/api/locations` and take the first location's `id`.
3. `curl -s http://localhost:3000/api/locations/<id>/tables | python3 -c 'import sys,json; print([t["name"] for t in json.load(sys.stdin)["data"]])'`
4. **Expected**: `['Bob', 'Table 1', 'Table 2', ..., 'Table 9', 'Table 10']` — `Table 9` before `Table 10`, not after `Table 1`.
5. `curl -s http://localhost:3000/api/locations/<id>` and check `data.tables` shows the same order.
6. In the admin dashboard, open a location's **Tables** screen and confirm the rows match.

This was actually run against a real seeded database during the session; both endpoints returned `['5', 'Bob', 'Table 1', 'Table 2', … 'Table 9', 'Table 10']` after adding a table named `5`.

## Key Decisions

- **Digits before letters.** `5` sorts before `Bob`. The spec's objective ("alphabetic names come before numbered table labels") was ambiguous on purely-numeric names; Russell chose the conventional default. Both readings agree on the canonical `Bob, Table 1, Table 2, Table 10` example, so only pure-digit names are affected.
- **Sort in memory, not in the query.** Prisma cannot express natural ordering in an `orderBy`, so the rows are sorted after fetching. The existing `orderBy: { name: 'asc' }` clauses are deliberately kept — they no longer determine the response order, but they keep the raw query's output stable for debugging. Both call sites carry a comment saying so, and an integration test asserts the clause is still passed.
- **Keep the admin UI dumb.** Sorting stays server-side, so the API, the admin screen, and any future client agree. The E2E test enforces this by feeding a scrambled fixture and asserting it renders verbatim — it fails if anyone adds a client-side sort, even a *correct* one.

## Bug Found and Fixed During Review

The first implementation compared digit runs with `Number(a) - Number(b)`. The `code-reviewer` pass found that this breaks the comparator contract `Array.prototype.sort` depends on:

- Past ~309 digits, `Number()` overflows to `Infinity`; `Infinity - Infinity` is `NaN`; and `NaN < 0 ? -1 : 1` yields `1` for **both** `cmp(a,b)` and `cmp(b,a)`. Antisymmetry breaks, and V8's sort is then free to produce an arbitrary order.
- Past ~17 significant digits, two different numbers coerce to the same double, so a genuinely smaller number could sort last.

Nothing bounds table-name length — `createTableSchema` has no `.max()` and Prisma's `Table.name` is an unbounded `String` — so an admin could reach this. Digit runs are now compared as strings: strip leading zeros, longer run wins, equal-length runs compare lexicographically. That is exact at any length and needs no `BigInt`.

## What the Finalization Audit Found

Every implementation and test file was read end-to-end, and an independent reviewer was tasked with breaking the comparator: 300,000 random fuzz triples plus a hand-built Unicode corpus (`İ`, the `ﬀ` ligature, composed vs decomposed `é`, Arabic-Indic digits, surrogate pairs).

**No bug was found in the shipped code.** That is the expected result, not luck: steps 1–2 of `compareTableNames` are lexicographic order over the canonical run tuples, and step 3 is a strict total order on the raw string, so the composition is antisymmetric and transitive by construction — regardless of what `toLowerCase()` does to any individual run. The Unicode names were added to the shipped contract corpus as regression insurance.

Three gaps were closed:

- **A second consumer nobody had documented.** `packages/admin/src/pages/ReservationDetail.tsx:53` fetches the same `listTables` endpoint to fill its "Assign Table" dropdown and renders it with no client-side sort, so it inherited the fix for free. It appeared in no spec table and had zero coverage. It now has an E2E in `e2e/admin/reservations.spec.ts`; temporarily adding a `localeCompare` sort to the component makes that test fail, so it is not vacuous.
- **The two E2E surfaces duplicated their scrambled fixture**, which would have let one drift from the other. Both now share `e2e/admin/table-fixtures.ts`.
- **No test guarded `getLocation`'s `{...location, tables}` spread** against someone later narrowing the response. One now does.

## Raised, Not Fixed

`specs/draft/express-async-error-handling.md` — Express 4.22.1 does not forward rejected promises from `async` handlers; `table.controller.ts` and `location.controller.ts` contain zero `try/catch`; and no `unhandledRejection` handler exists. A Prisma rejection on the public, unauthenticated `GET /api/locations/:id` therefore terminates the whole process, killing every concurrent request.

This is **pre-existing and not caused by this spec**: `await prisma.location.findUnique` at `table.controller.ts:17` already had the exposure. `sortTablesByName` adds no new reachable throw path — `Table.name` is `NOT NULL` in Prisma, Zod-validated as a string, and the comparator is pure and total over strings. Wrapping only the two new call sites in `try/catch` would be theatre while the `await` above them stays unguarded, so the fix belongs in its own spec. That draft also carries the `.max()` bound on table-name length, which this spec's Out of Scope explicitly forbade changing.

## Testing

| Suite | Result |
|---|---|
| `packages/server` (full) | 412 passed (24 files) |
| `packages/shared` | 17 passed |
| `e2e/admin/tables.spec.ts` + `reservations.spec.ts` (Playwright, chromium) | 11 passed |
| `tsc --noEmit -p packages/server` | clean |
| `tsc -b` in `packages/admin` | clean |
| `npm run lint` | **could not run** — see below |

`npm run lint` is broken repo-wide and was never run. See "Follow-Up Raised". Reporting it as "clean" would be false.

23 unit tests live in `packages/server/src/__tests__/unit/table-name-sort.test.ts`, including a five-test comparator-contract block that asserts antisymmetry, reflexivity, transitivity, totality and order-independence across an adversarial corpus (empty strings, leading zeros, case-only ties, 400-digit runs, mid-name digit/letter clashes). Reverting the overflow fix fails 5 of them, so they are not vacuous — this was checked, not assumed.

Two sub-agent findings materially changed the tests before implementation:

- `test-auditor` caught that the E2E fixture was already in sorted order, meaning a *correct* client-side sort would have slipped through. The fixture is now genuinely scrambled.
- `test-auditor` also caught that an early unit test asserted `compareTableNames('PATIO', 'patio') === 0`, which contradicts the spec's own promise that the sort never depends on input order. Case-only differences now fall through to the deterministic tie-break.

## Follow-Up Raised

**`npm run lint` cannot be run in this repo.** No ESLint config is tracked anywhere (`git ls-files | grep eslint` is empty, on this branch and on `main`), ESLint is not a declared dependency, and the `lint` script still passes `--ext`, which ESLint v9 removed. So the Refactor phase's lint step could not be performed, and no lint rule has ever been enforced here — the `no-explicit-any` and explicit-return-type conventions in the project profile are upheld by review alone.

This is pre-existing and unrelated to this spec. Raised as `specs/draft/restore-eslint-flat-config.md` rather than left as a comment.

## Files Changed

| File | Change |
|------|--------|
| `packages/server/src/lib/table-name-sort.ts` | **NEW** — `compareTableNames`, `sortTablesByName` |
| `packages/server/src/controllers/table.controller.ts` | `listTables` sorts its response |
| `packages/server/src/controllers/location.controller.ts` | `getLocation` sorts its embedded tables |
| `packages/server/src/__tests__/unit/table-name-sort.test.ts` | **NEW** — 23 unit tests |
| `packages/server/src/__tests__/integration/table.test.ts` | Ordering + `orderBy`-retained coverage |
| `packages/server/src/__tests__/integration/location.test.ts` | Embedded-table ordering coverage |
| `e2e/admin/tables.spec.ts` | Rewritten: API-order pass-through coverage |
| `specs/draft/restore-eslint-flat-config.md` | **NEW** — follow-up draft spec |

## Status

Complete. Both phases are closed — T1.1–T1.5 (implementation) and T2.1–T2.4 (finalization fixes), 9 tasks, 0 unchecked. `/wf:finalize` ran the deep audit, added the `CHANGELOG.md` entry under `### Fixed`, and moved the spec to `specs/completed/`.

Not yet merged to `main`, and not deployed.
