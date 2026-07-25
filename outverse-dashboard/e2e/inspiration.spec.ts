import { test, expect } from '@playwright/test';

test.describe('Inspiration flows', () => {
  test('inspiration history page loads for signed-in user', async ({ page }) => {
    await page.goto('/inspiration');
    await expect(page).toHaveURL(/\/inspiration/);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
  });

  test('analytics page shows post engagement section', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page).toHaveURL(/\/analytics/);
    await expect(page.locator('body')).toContainText(/engagement|تفاعل/i, { timeout: 15000 });
  });
});
