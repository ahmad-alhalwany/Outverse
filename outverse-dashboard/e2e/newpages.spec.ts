import { test, expect } from '@playwright/test';

// Smoke tests for the Phase 2/3 feature pages. These verify routing and
// the public shell render — auth-gated content is covered by coreflows.spec.ts.
// Mirrors the anonymous-nav style of the existing suite.

test.describe('New feature pages render their shell', () => {
  test('rooms page loads with title', async ({ page }) => {
    await page.goto('/rooms');
    await expect(page.locator('body')).toContainText(/rooms|prompt rooms/i, { timeout: 10000 });
  });

  test('capsules page loads with title', async ({ page }) => {
    await page.goto('/capsules');
    await expect(page.locator('body')).toContainText(/capsule/i, { timeout: 10000 });
  });

  test('year page renders the Cosmory header', async ({ page }) => {
    await page.goto('/year');
    await expect(page.locator('body')).toContainText(/cosmory|year/i, { timeout: 10000 });
  });

  test('legal pages are reachable', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('body')).toContainText(/terms|cosmory/i, { timeout: 10000 });
    await page.goto('/privacy');
    await expect(page.locator('body')).toContainText(/privacy|cosmory/i, { timeout: 10000 });
  });

  test('PWA manifest is served with correct type', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.ok(), 'manifest.json should be served').toBeTruthy();
    expect(res.headers()['content-type'] || '').toMatch(/application\/manifest\+json|application\/json/);
    const body = await res.json();
    expect(body.name).toMatch(/cosmory/i);
    expect(body.icons.length).toBeGreaterThan(0);
  });

  test('service worker script is served', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.ok(), 'sw.js should be served').toBeTruthy();
  });

  test('global navigation includes the new worlds', async ({ page }) => {
    await page.goto('/');
    for (const label of ['Rooms', 'Capsules', 'Your Year']) {
      await expect(
        page.getByRole('link', { name: new RegExp(label, 'i') }).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
