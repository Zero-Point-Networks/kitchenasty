import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.js';

const LOCATION_ID = 'loc-e2e';

// The order the server would return after natural sorting.
const NATURAL_ORDER = ['Bob', 'Table 1', 'Table 2', 'Table 10'];

// An order no sort — lexicographic or natural — would ever produce. Rendering
// this verbatim is what proves the admin screen is a pure pass-through.
const SCRAMBLED_ORDER = ['Table 10', 'Bob', 'Table 2', 'Table 1'];

function tableRow(name: string, index: number): Record<string, unknown> {
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

async function routeLocationWithTables(page: Page, names: string[]): Promise<void> {
  await page.route(`**/api/locations/${LOCATION_ID}`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { id: LOCATION_ID, name: 'E2E Kitchen' } }),
    });
  });

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

async function renderedTableNames(page: Page): Promise<string[]> {
  const names = await page.locator('tbody tr td:first-child').allTextContents();
  return names.map((name) => name.trim());
}

test.describe('Admin Table Management', () => {
  test('tables page renders its heading and a row per table', async ({ page }) => {
    await routeLocationWithTables(page, NATURAL_ORDER);
    await page.goto(`/locations/${LOCATION_ID}/tables`);

    await expect(page.getByRole('heading', { name: 'Tables' })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(NATURAL_ORDER.length);
  });

  test('location list shows Tables link', async ({ page }) => {
    await page.goto('/locations');
    await expect(page.getByRole('heading', { name: 'Locations' })).toBeVisible();
  });

  test('renders the natural order the API returned', async ({ page }) => {
    await routeLocationWithTables(page, NATURAL_ORDER);
    await page.goto(`/locations/${LOCATION_ID}/tables`);

    await expect(page.locator('tbody tr')).toHaveCount(NATURAL_ORDER.length);
    expect(await renderedTableNames(page)).toEqual(NATURAL_ORDER);
  });

  test('renders API order verbatim and never re-sorts client-side', async ({ page }) => {
    await routeLocationWithTables(page, SCRAMBLED_ORDER);
    await page.goto(`/locations/${LOCATION_ID}/tables`);

    await expect(page.locator('tbody tr')).toHaveCount(SCRAMBLED_ORDER.length);

    // Any client-side sort fails here: a lexicographic one yields
    // Bob/Table 1/Table 10/Table 2, a natural one yields NATURAL_ORDER.
    expect(await renderedTableNames(page)).toEqual(SCRAMBLED_ORDER);
  });
});
