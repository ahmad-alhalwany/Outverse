import { test, expect } from '@playwright/test';

test.describe('Lab smoke', () => {
  test('lab page loads', async ({ page }) => {
    await page.goto('/lab');
    await expect(page.locator('body')).toContainText(/lab|challenge|weirdness/i, { timeout: 15000 });
  });

  test('lab history page loads', async ({ page }) => {
    await page.goto('/lab/history');
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });
});
