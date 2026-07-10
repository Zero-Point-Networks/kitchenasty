import { test, expect } from './fixtures.js';
import { LOCATION_ID, SCRAMBLED_TABLE_NAMES, routeLocationTables } from './table-fixtures.js';

test.describe('Admin Reservation List', () => {
  test('navigates to reservations page via sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Reservations' }).click();
    await expect(page).toHaveURL('/reservations');
    await expect(page.getByRole('heading', { name: 'Reservations' })).toBeVisible();
  });

  test('displays status filter dropdown', async ({ page }) => {
    await page.goto('/reservations');
    const statusSelect = page.locator('select').first();
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toContainText('All Statuses');
    await expect(statusSelect).toContainText('Pending');
    await expect(statusSelect).toContainText('Confirmed');
  });

  test('displays date filter input', async ({ page }) => {
    await page.goto('/reservations');
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();
  });

  test('shows empty state or reservation table', async ({ page }) => {
    await page.goto('/reservations');
    await page.waitForTimeout(1000);
    const noReservations = page.getByText('No reservations found.');
    const table = page.locator('table');
    const error = page.locator('.bg-red-50');
    const isVisible = await noReservations.isVisible() || await table.isVisible() || await error.isVisible();
    expect(isVisible).toBeTruthy();
  });
});

test.describe('Admin Reservation Detail', () => {
  test('shows error for non-existent reservation', async ({ page }) => {
    await page.goto('/reservations/non-existent-id');
    await page.waitForTimeout(1000);
    const backLink = page.getByText('Back to Reservations');
    const error = page.locator('.bg-red-50');
    const isVisible = await backLink.isVisible() || await error.isVisible();
    expect(isVisible).toBeTruthy();
  });

  test('back link navigates to reservation list', async ({ page }) => {
    await page.goto('/reservations/some-id');
    await page.waitForTimeout(1000);
    await page.getByText('Back to Reservations').click();
    await expect(page).toHaveURL('/reservations');
  });
});

test.describe('Admin Reservation Table Assignment', () => {
  const RESERVATION_ID = 'res-e2e';

  test('assign-table dropdown renders API order verbatim', async ({ page }) => {
    await page.route(`**/api/reservations/${RESERVATION_ID}`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: RESERVATION_ID,
            date: '2026-07-10T00:00:00.000Z',
            time: '19:00',
            partySize: 2,
            status: 'CONFIRMED',
            comment: null,
            customer: { id: 'cus-1', name: 'Ada', email: 'ada@example.com', phone: null },
            location: { id: LOCATION_ID, name: 'E2E Kitchen' },
            table: null,
          },
        }),
      });
    });

    await routeLocationTables(page, SCRAMBLED_TABLE_NAMES);
    await page.goto(`/reservations/${RESERVATION_ID}`);

    const assignTable = page.getByLabel('Assign table');
    await expect(assignTable).toBeVisible();

    const options = await assignTable.locator('option').allTextContents();
    expect(options).toEqual([
      'No table assigned',
      ...SCRAMBLED_TABLE_NAMES.map((name) => `${name} (seats 4)`),
    ]);
  });
});
