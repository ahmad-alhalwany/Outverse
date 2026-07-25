import { test, expect } from '@playwright/test';

test.describe('Authenticated flows', () => {
  test('settings page loads for signed-in user', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });

  test('notifications page loads', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page).toHaveURL(/\/notifications/);
    await expect(page.locator('body')).toContainText(/notification/i, { timeout: 15000 });
  });

  test('shop page loads while authenticated', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.locator('body')).toContainText(/shop|madness|store/i, { timeout: 15000 });
  });

  test('lab page loads while authenticated', async ({ page }) => {
    await page.goto('/lab');
    await expect(page.locator('body')).toContainText(/lab|challenge|weirdness/i, { timeout: 15000 });
  });
});
