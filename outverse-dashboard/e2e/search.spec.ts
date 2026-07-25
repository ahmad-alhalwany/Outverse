import { test, expect } from '@playwright/test';

test.describe('Search smoke', () => {
  test('search page loads', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('body')).toContainText(/explore|search/i, { timeout: 15000 });
  });

  test('search with query param', async ({ page }) => {
    await page.goto('/search?q=art');
    await expect(page.locator('body')).toContainText(/art|explore|search/i, { timeout: 15000 });
  });
});
