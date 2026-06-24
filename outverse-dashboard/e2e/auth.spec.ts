import { test, expect, Page } from '@playwright/test';

const API_URL = (process.env.E2E_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const USERNAME = process.env.E2E_USERNAME || 'e2e_test_user';
const PASSWORD = process.env.E2E_PASSWORD || 'OutverseE2E!2026';

test.describe('Authentication', () => {
  async function clearSession(page: Page) {
    await page.goto('/login');
    await page.evaluate(() => localStorage.removeItem('outverse_user'));
    const context = page.context();
    await context.clearCookies();
  }

  test('anonymous user is redirected to login from protected routes', async ({ page }) => {
    await clearSession(page);
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('user can log in and lands on home feed', async ({ page }) => {
    await clearSession(page);
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(USERNAME);
    await page.getByPlaceholder(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in$/i }).click();
    await expect(page).toHaveURL(/(^|\/)$/);
  });
});
