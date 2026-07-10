import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.js';
import {
  LOCATION_ID,
  NATURAL_TABLE_NAMES,
  SCRAMBLED_TABLE_NAMES,
  routeLocationDetail,
  routeLocationTables,
} from './table-fixtures.js';

async function routeLocationWithTables(page: Page, names: string[]): Promise<void> {
  await routeLocationDetail(page);
  await routeLocationTables(page, names);
}

async function renderedTableNames(page: Page): Promise<string[]> {
  const names = await page.locator('tbody tr td:first-child').allTextContents();
  return names.map((name) => name.trim());
}

test.describe('Admin Table Management', () => {
  test('tables page renders its heading and a row per table', async ({ page }) => {
    await routeLocationWithTables(page, NATURAL_TABLE_NAMES);
    await page.goto(`/locations/${LOCATION_ID}/tables`);

    await expect(page.getByRole('heading', { name: 'Tables' })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(NATURAL_TABLE_NAMES.length);
  });

  test('location list shows Tables link', async ({ page }) => {
    await page.goto('/locations');
    await expect(page.getByRole('heading', { name: 'Locations' })).toBeVisible();
  });

  test('renders the natural order the API returned', async ({ page }) => {
    await routeLocationWithTables(page, NATURAL_TABLE_NAMES);
    await page.goto(`/locations/${LOCATION_ID}/tables`);

    await expect(page.locator('tbody tr')).toHaveCount(NATURAL_TABLE_NAMES.length);
    expect(await renderedTableNames(page)).toEqual(NATURAL_TABLE_NAMES);
  });

  test('renders API order verbatim and never re-sorts client-side', async ({ page }) => {
    await routeLocationWithTables(page, SCRAMBLED_TABLE_NAMES);
    await page.goto(`/locations/${LOCATION_ID}/tables`);

    await expect(page.locator('tbody tr')).toHaveCount(SCRAMBLED_TABLE_NAMES.length);
    expect(await renderedTableNames(page)).toEqual(SCRAMBLED_TABLE_NAMES);
  });
});
