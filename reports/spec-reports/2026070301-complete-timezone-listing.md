# Spec Report - Complete Timezone Listing

Date: 03 July 2026 | Session: interactive

## What Was Delivered

Admins can now choose from the browser-supported IANA timezone list in General Settings instead of a short curated sample.

- The Timezone picker on `/settings/general` is populated from `Intl.supportedValuesOf('timeZone')`, with `UTC` included explicitly.
- Timezones are ordered deterministically by region and then by name, so regions such as `Africa`, `America`, `Asia`, `Australia`, `Europe`, and `Pacific` appear in alphabetical groups.
- Existing stored timezone values that are not in the browser-supported list remain selectable, preventing the form from blanking historical or legacy values.
- The Timezone select is now associated with its visible label for more reliable accessibility and test targeting.

## Spec Phases Completed

- Phase 1: Admin Timezone Picker - complete

## How to Verify

1. Start the server and admin app with the usual Playwright web-server commands or `npm run dev:server` plus `npm run dev:admin`.
2. Log in to the admin dashboard and navigate to `/settings/general`.
3. Open the Timezone dropdown.
4. Expected: the list contains many browser-supported IANA zones, including `Australia/Perth`, and the values are grouped alphabetically by region.
5. With a saved legacy timezone value returned by `GET /api/settings/general`, open `/settings/general` again.
6. Expected: the legacy timezone remains selected and appears once in the dropdown alongside the browser-supported list.

## Technical Changes

### Admin

- `packages/admin/src/pages/SettingsGeneral.tsx`: Replaced the static timezone array with a generated browser-supported list, deterministic sorting, loaded-value preservation, typed settings response guards, and an accessible `Timezone` label/select association.

### E2E

- `e2e/admin/settings-general.spec.ts` (NEW): Adds Playwright coverage for complete browser-derived timezone options, deterministic ordering, `Australia/Perth`, `UTC`, and unknown saved timezone preservation.

### Documentation

- `packages/docs/features/settings.md`: Documents that the timezone field uses the browser-supported IANA picker ordered by region.
- `specs/in-progress/complete-timezone-listing.md`: Moves the spec into progress, records completed Phase 1 tasks, and notes local verification results.

## Test Results

- `npm run build -w packages/admin`: passed.
- `npx playwright test e2e/admin/settings-general.spec.ts --project=admin`: 2 tests attempted, 0 passed, 2 failed before assertions because the Playwright Chromium binary is missing.
- `npx playwright install chromium`: failed because Playwright reports Chromium is unsupported on `ubuntu26.04-x64` in this environment.
- `npm run lint`: failed before linting changed files because the repo has no ESLint configuration file.

## Blockers & Unresolved Issues

- Playwright browser verification is blocked locally: the Chromium executable is missing, and the Playwright installer refuses `ubuntu26.04-x64`. Run the E2E spec in a supported environment with Playwright browsers installed.
- Repository lint verification is blocked by missing ESLint configuration. This matches the existing `specs/draft/repair-eslint-config.md` work and was not changed in this spec.

## Remaining Work

All implementation phases in this spec are checked complete. The next workflow step is `wf:finalize complete-timezone-listing` for the final audit and closeout.
