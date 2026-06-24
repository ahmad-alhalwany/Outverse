import { test, expect } from '@playwright/test';

test.describe('Core user flows', () => {
  test('home feed loads with header navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /home/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /lab/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /bazaar/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /vault/i }).first()).toBeVisible();
  });

  test('reels page renders loading or reel content', async ({ page }) => {
    await page.goto('/reels');
    await expect(page.locator('body')).toContainText(/reels/i, { timeout: 10000 });
  });

  test('notifications bell opens the panel', async ({ page }) => {
    await page.goto('/');
    const bell = page.locator('button').filter({ has: page.locator('svg') }).first();
    await bell.click().catch(() => page.getByRole('button', { name: /notifications/i }).click());
    await expect(page.locator('body')).toContainText(/notification/i, { timeout: 5000 });
  });

  test('settings page is reachable', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h1, h2').filter({ hasText: /settings/i }).first()).toBeVisible();
  });

  test('global navigation covers all product worlds', async ({ page }) => {
    await page.goto('/');
    const links = ['Lab', 'Bazaar', 'Vault', 'Forge', 'Shop', 'Chat', 'Reels'];
    for (const label of links) {
      await expect(page.getByRole('link', { name: new RegExp(label, 'i') }).first()).toBeVisible();
    }
  });
});
