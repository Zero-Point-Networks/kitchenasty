import { test, expect } from '@playwright/test';

test.describe('API Health Check E2E', () => {
  test('GET /api/health returns healthy status', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(body.data.version).toBe('0.1.0');
    expect(body.data.timestamp).toBeDefined();

    // Timestamp should be a valid ISO date
    const date = new Date(body.data.timestamp);
    expect(date.getTime()).not.toBeNaN();
  });

  test('GET /api/nonexistent returns 404', async ({ request }) => {
    const response = await request.get('/api/nonexistent');

    expect(response.status()).toBe(404);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Not Found');
  });

  test('API accepts JSON content type on validation-only endpoints', async ({ request }) => {
    // Test a route that validates before hitting DB
    const response = await request.post('/api/auth/customer/login', {
      data: { email: 'not-valid-email', password: 'p' },
    });

    // Should get 400 (validation error), meaning JSON was parsed correctly
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});
