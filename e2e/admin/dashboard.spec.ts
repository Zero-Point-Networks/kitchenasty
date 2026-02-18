import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test('loads the admin dashboard page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('KitchenAsty Admin');
  });

  test('displays the navigation bar with app name', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    await expect(nav).toContainText('KitchenAsty Admin');
  });

  test('displays the Dashboard heading', async ({ page }) => {
    await page.goto('/');
    const heading = page.getByRole('heading', { name: 'Dashboard' });
    await expect(heading).toBeVisible();
  });

  test('displays all four metric cards', async ({ page }) => {
    await page.goto('/');

    const cards = ['Orders Today', 'Revenue', 'Reservations', 'Active Items'];
    for (const cardLabel of cards) {
      await expect(page.getByText(cardLabel)).toBeVisible();
    }
  });

  test('metric cards show placeholder values', async ({ page }) => {
    await page.goto('/');

    // All cards should show "--" as placeholder
    const placeholders = page.getByText('--');
    await expect(placeholders.first()).toBeVisible();
    expect(await placeholders.count()).toBe(4);
  });

  test('has correct page structure', async ({ page }) => {
    await page.goto('/');

    // Should have nav and main elements
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });
});
