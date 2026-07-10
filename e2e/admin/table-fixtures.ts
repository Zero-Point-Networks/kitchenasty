import type { Page } from '@playwright/test';

export const LOCATION_ID = 'loc-e2e';

/** The order the server returns once it has sorted names naturally. */
export const NATURAL_TABLE_NAMES = ['Bob', 'Table 1', 'Table 2', 'Table 10'];

/**
 * An order no sort would ever produce — a lexicographic sort yields
 * Bob/Table 1/Table 10/Table 2, a natural one yields NATURAL_TABLE_NAMES.
 * Rendering this verbatim is what proves an admin surface passes API order
 * through untouched. Shared so both surfaces stay pinned to the same case.
 */
export const SCRAMBLED_TABLE_NAMES = ['Table 10', 'Bob', 'Table 2', 'Table 1'];

/** Mirrors the `Table` shape the admin pages consume, so a renamed field fails to compile. */
interface TableFixtureRow {
  id: string;
  locationId: string;
  name: string;
  capacity: number;
  isActive: boolean;
  qrToken: string | null;
  _count: { reservations: number };
}

function tableRow(name: string, index: number): TableFixtureRow {
  return {
    id: `tbl-${index}`,
    locationId: LOCATION_ID,
    name,
    capacity: 4,
    isActive: true,
    qrToken: null,
    _count: { reservations: 0 },
  };
}

/** Intercepts GET /api/locations/:id/tables and returns `names` in the given order. */
export async function routeLocationTables(page: Page, names: string[]): Promise<void> {
  await page.route(`**/api/locations/${LOCATION_ID}/tables`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: names.map(tableRow) }),
    });
  });
}

/** Intercepts GET /api/locations/:id (the location detail the table screen loads). */
export async function routeLocationDetail(page: Page): Promise<void> {
  await page.route(`**/api/locations/${LOCATION_ID}`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { id: LOCATION_ID, name: 'E2E Kitchen' } }),
    });
  });
}
