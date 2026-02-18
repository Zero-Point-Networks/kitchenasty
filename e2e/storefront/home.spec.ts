import { test, expect } from '@playwright/test';

test.describe('Storefront Home Page', () => {
  test('loads the storefront home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('KitchenAsty - Order Online');
  });

  test('displays the navigation bar with brand name', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    await expect(nav).toContainText('KitchenAsty');
  });

  test('displays navigation links', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Menu', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reservations' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
  });

  test('displays hero section with heading', async ({ page }) => {
    await page.goto('/');
    const heading = page.getByRole('heading', { name: 'Order Delicious Food Online' });
    await expect(heading).toBeVisible();
  });

  test('displays description text', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByText('Browse our menu, place your order for delivery or pickup, and enjoy!')
    ).toBeVisible();
  });

  test('displays View Menu CTA button', async ({ page }) => {
    await page.goto('/');
    const ctaButton = page.getByRole('link', { name: 'View Menu' });
    await expect(ctaButton).toBeVisible();
    await expect(ctaButton).toHaveAttribute('href', '/menu');
  });

  test('Menu nav link points to /menu', async ({ page }) => {
    await page.goto('/');
    const menuLink = page.getByRole('link', { name: 'Menu' }).first();
    await expect(menuLink).toHaveAttribute('href', '/menu');
  });

  test('Reservations nav link points to /reservations', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: 'Reservations' });
    await expect(link).toHaveAttribute('href', '/reservations');
  });

  test('Login nav link points to /login', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: 'Login' });
    await expect(link).toHaveAttribute('href', '/login');
  });
});
