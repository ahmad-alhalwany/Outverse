import { test, expect } from '@playwright/test';

test.describe('Shop smoke', () => {
  test('shop page loads', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.locator('body')).toContainText(/shop|madness|store/i, { timeout: 15000 });
  });

  test('order history page loads', async ({ page }) => {
    await page.goto('/shop/orders');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });
});
