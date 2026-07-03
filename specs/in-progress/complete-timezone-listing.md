# Complete Timezone Listing

## Status: In Progress

## Objective

Replace the admin General Settings timezone dropdown's small hard-coded sample with a complete browser-supported IANA timezone list ordered alphabetically by region.

## Problem Statement

1. **The admin list is incomplete** - `packages/admin/src/pages/SettingsGeneral.tsx:4` defines only 18 timezone values, so common restaurant timezones such as `Australia/Perth` are not selectable.
2. **The current order is manually curated** - `packages/admin/src/pages/SettingsGeneral.tsx:4-9` mixes regions in a fixed hand-written order rather than deriving an alphabetical region order from IANA identifiers.
3. **The API accepts arbitrary timezone strings** - `packages/server/src/controllers/settings.controller.ts:171-180` validates `timezone` as an optional string, so the missing list is a client-side admin UI limitation rather than a backend schema limitation.

## Current Architecture

The admin settings index exposes the General card at `/settings/general` (`packages/admin/src/pages/Settings.tsx:12-23`). Routing mounts `SettingsGeneral` for managers and super admins (`packages/admin/src/main.tsx:121-123`).

`SettingsGeneral` fetches the current settings from `GET /api/settings/general`, loads `timezone` into local state, and sends it back through `PUT /api/settings/general` when saving (`packages/admin/src/pages/SettingsGeneral.tsx:27-56`). The dropdown renders every entry from the module-level `TIMEZONES` array (`packages/admin/src/pages/SettingsGeneral.tsx:100-104`).

The settings documentation describes the field as an IANA timezone (`packages/docs/features/settings.md:13-18`) and the API docs show the field in the general settings response (`packages/docs/api/settings.md:23-49`).

### Key Files

| File | Role |
|------|------|
| `packages/admin/src/pages/SettingsGeneral.tsx` | Renders and saves the General Settings form, including the timezone select |
| `packages/admin/src/pages/Settings.tsx` | Links the Settings index to the General Settings page |
| `packages/admin/src/main.tsx` | Registers the `/settings/general` route |
| `e2e/admin/fixtures.ts` | Logs admin Playwright tests in before visiting admin routes |
| `packages/docs/features/settings.md` | User-facing settings field documentation |

## Design

### Timezone Source and Sorting

Use `Intl.supportedValuesOf('timeZone')` in the admin bundle to source the runtime's complete supported IANA timezone list, then add `UTC` explicitly because the existing form defaults to `UTC` and existing settings may store it. Deduplicate and sort with an explicit comparator that compares the region prefix before the slash first, then the remainder:

```ts
function timezoneParts(timezone: string): [string, string] {
  const [region, ...rest] = timezone.split('/');
  return [region, rest.join('/')];
}

function compareTimezones(a: string, b: string): number {
  const [aRegion, aName] = timezoneParts(a);
  const [bRegion, bName] = timezoneParts(b);
  return aRegion.localeCompare(bRegion) || aName.localeCompare(bName) || a.localeCompare(b);
}

const TIMEZONES = Array.from(new Set(['UTC', ...Intl.supportedValuesOf('timeZone')])).sort(compareTimezones);
```

If TypeScript needs a compatibility guard for `Intl.supportedValuesOf`, keep the fallback local to `SettingsGeneral.tsx` and preserve the current small list only as an old-browser fallback. The normal path must use `supportedValuesOf('timeZone')` so modern browsers get the complete supported list.

### Preserve Existing Values

When the API returns a timezone not present in the runtime-supported list, include that current value in the rendered option set so the form does not blank out existing data. This covers stored aliases or historical IANA names without broadening backend validation in this spec.

### Documentation

Update `packages/docs/features/settings.md` to make the General Settings timezone field describe the admin picker as a browser-supported IANA timezone list ordered by region. `packages/docs/api/settings.md` does not need a contract change because the API field remains a string.

## Implementation Order

### Phase 1: Admin Timezone Picker
<!-- packages: admin, docs -->

- [x] **T1.1** Replace the hard-coded `TIMEZONES` array in `SettingsGeneral.tsx` with a browser-supported IANA timezone builder and region/name comparator `[admin]` `[~35 LOC]`
- [x] **T1.2** Preserve the loaded timezone as an option when it is absent from the generated list `[admin]` `[~10 LOC]` depends: T1.1
- [x] **T1.3** Add Playwright coverage for `/settings/general` asserting the select contains `Australia/Perth`, includes a broad list, preserves an unknown loaded timezone, and is region-sorted `[admin]` `[~55 LOC]` depends: T1.1, T1.2
- [x] **T1.4** Update settings feature documentation to mention the complete browser-supported IANA picker ordered by region `[docs]` `[~5 LOC]`

> **Session notes**: Implemented the timezone option builder in `packages/admin/src/pages/SettingsGeneral.tsx`, including deterministic region/name sorting, `UTC`, browser-supported IANA zones, and preservation of unknown stored values.
> Added `e2e/admin/settings-general.spec.ts` with browser-derived expected options for completeness, ordering, and unknown-value preservation; updated `packages/docs/features/settings.md`.
> Verification: `npm run build -w packages/admin` passed. `npx playwright test e2e/admin/settings-general.spec.ts --project=admin` is blocked locally by missing Playwright Chromium, and `npx playwright install chromium` reports unsupported `ubuntu26.04-x64`. `npm run lint` is blocked by the repo's missing ESLint config.

Task T1.4 has no code dependency and can run in parallel with the admin implementation.

## Testing Strategy

### Unit Tests

No unit tests are configured for `@kitchenasty/admin`; the package currently exposes build-only scripts in `packages/admin/package.json`.

### Integration / E2E Tests

| Test File | What It Tests |
|-----------|--------------|
| `e2e/admin/settings-general.spec.ts` | **NEW** Playwright spec visiting `/settings/general`, reading the Timezone select options, and asserting `Australia/Perth` is present, the option count is large enough to catch regression to the current 18-item list, unknown API-loaded values remain selectable, and the first comparable region transitions are alphabetically sorted |

### Verification Commands

- `npm run build -w packages/admin`
- `npx playwright test e2e/admin/settings-general.spec.ts`

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `Intl.supportedValuesOf` is unavailable in an older browser | Guard the call and fall back to the existing curated list plus any loaded value; modern supported browsers receive the complete list |
| Stored timezone aliases are not returned by the browser list | Always merge the loaded timezone into the rendered options before sorting |
| Runtime-dependent IANA data makes exact option counts brittle | E2E should assert a conservative lower bound and specific required examples rather than a fixed full count |

## Out of Scope

- Backend timezone validation or canonicalization.
- Database migrations for existing timezone values.
- Changing how timezone values affect ordering, reservation, or reporting calculations.
- Redesigning the General Settings form beyond the timezone select contents.

## Files to Change

| File | Change |
|------|--------|
| `packages/admin/src/pages/SettingsGeneral.tsx` | Replace the short static timezone array with generated browser-supported IANA options and preserve unknown current values |
| `e2e/admin/settings-general.spec.ts` | **NEW** Playwright coverage for timezone completeness and region ordering |
| `packages/docs/features/settings.md` | Document that the admin picker uses the complete browser-supported IANA timezone list ordered by region |

## Documentation Impact

- [x] `packages/docs/features/settings.md` - update the timezone field description for the complete region-ordered picker
