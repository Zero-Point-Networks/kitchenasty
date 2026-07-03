import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.js';

async function timezoneOptions(page: Page): Promise<string[]> {
  return page.getByLabel('Timezone').locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value)
  );
}

async function expectedTimezoneOptions(page: Page, currentTimezone: string): Promise<string[]> {
  return page.evaluate((timezone) => {
    function timezoneParts(value: string): [string, string] {
      const [region, ...rest] = value.split('/');
      return [region, rest.join('/')];
    }

    function compareTimezones(a: string, b: string): number {
      const [aRegion, aName] = timezoneParts(a);
      const [bRegion, bName] = timezoneParts(b);
      return compareAscii(aRegion, bRegion) || compareAscii(aName, bName) || compareAscii(a, b);
    }

    function compareAscii(a: string, b: string): number {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    }

    return Array.from(new Set(['UTC', ...Intl.supportedValuesOf('timeZone'), timezone]))
      .filter(Boolean)
      .sort(compareTimezones);
  }, currentTimezone);
}

async function routeGeneralSettings(page: Page, timezone: string): Promise<void> {
  await page.route('**/api/settings/general', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          contactEmail: 'info@example.com',
          contactPhone: '+1-555-0123',
          timezone,
          distanceUnit: 'km',
          defaultCurrency: 'USD',
          currencySymbol: '$',
          currencyPosition: 'before',
          googleMapsApiKey: '',
        },
      }),
    });
  });
}

test.describe('Admin General Settings timezone picker', () => {
  test('lists browser-supported IANA timezones ordered by region', async ({ page }) => {
    await routeGeneralSettings(page, 'UTC');
    await page.goto('/settings/general');
    await expect(page.getByRole('heading', { name: 'General Settings' })).toBeVisible();

    const options = await timezoneOptions(page);
    const expectedOptions = await expectedTimezoneOptions(page, 'UTC');
    expect(options.length).toBeGreaterThan(100);
    expect(options).toContain('Australia/Perth');
    expect(options).toContain('UTC');
    expect(options).toEqual(expectedOptions);
  });

  test('keeps a saved timezone selectable when it is absent from the browser-supported list', async ({ page }) => {
    await routeGeneralSettings(page, 'Custom/Legacy_Zone');

    await page.goto('/settings/general');

    const timezoneSelect = page.getByLabel('Timezone');
    const options = await timezoneOptions(page);
    const expectedOptions = await expectedTimezoneOptions(page, 'Custom/Legacy_Zone');

    await expect(timezoneSelect).toHaveValue('Custom/Legacy_Zone');
    await expect(timezoneSelect.locator('option[value="Custom/Legacy_Zone"]')).toHaveCount(1);
    expect(options).toContain('Australia/Perth');
    expect(options).toContain('UTC');
    expect(options).toEqual(expectedOptions);
  });
});
