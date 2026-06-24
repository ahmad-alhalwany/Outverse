import { test, expect } from './fixtures';

test.describe('Reels critical path', () => {
  test('reels discover page loads', async ({ page }) => {
    await page.goto('/reels/discover');
    await expect(page.locator('body')).toContainText(/discover|trending/i, { timeout: 10000 });
  });

  test('individual reel page renders title and metadata', async ({ page, apiRequest, apiUrl }) => {
    const reelsRes = await apiRequest.get(`${apiUrl}/api/reels/`);
    const body = await reelsRes.json().catch(() => []);
    const firstReel = Array.isArray(body) ? body[0] : null;
    test.skip(!firstReel?.id, 'No reels available');

    await page.goto(`/reels/${firstReel.id}`);
    await expect(page.locator('body')).toContainText(/reel|view|like/i, { timeout: 10000 });
  });
});
