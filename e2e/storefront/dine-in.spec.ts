import { test, expect } from '@playwright/test';

// Dine-in QR ordering entry flow. Relies on the seeded Table 1 QR token
// ('dev-table-1-qr') created by prisma/seed.ts.
//
// These cover the dine-in-specific behaviour that is deterministic without
// building a cart (the existing suite does not exercise the menu-modal →
// add-to-cart → place-order path). Order creation with a table token is
// covered by the server integration tests (order.test.ts / table.test.ts).
test.describe('Storefront Dine-in (QR ordering)', () => {
  test('an invalid QR token shows a recoverable error', async ({ page }) => {
    await page.goto('/t/definitely-not-a-real-token');
    await expect(page.getByRole('heading', { name: 'Table not found' })).toBeVisible();
    await page.getByRole('link', { name: 'Browse Menu' }).click();
    await expect(page).toHaveURL(/\/menu/);
  });

  test('scanning a valid table QR resolves the token and lands on the menu', async ({ page }) => {
    await page.goto('/t/dev-table-1-qr');
    await expect(page).toHaveURL(/\/menu/);
    await expect(page.getByRole('heading', { name: 'Our Menu' })).toBeVisible();
  });
});
