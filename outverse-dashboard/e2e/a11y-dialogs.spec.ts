import { test, expect } from '@playwright/test';

// Covers useDialogA11y (lib/hooks/useDialogA11y.ts) via the "More" navigation
// sheet — the one dialog wired to the hook that needs no auth. Verifies the
// behavior the sheet was previously missing entirely: focus moves into the
// dialog on open, Escape closes it, and focus returns to the trigger button.
test.describe('Mobile "More" navigation sheet accessibility', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Escape closes the sheet and restores focus to the trigger', async ({ page }) => {
    await page.goto('/');

    // Fresh browser profile always shows the cookie banner first (it mounts
    // one client render tick after hydration) — it overlaps the bottom nav
    // and would otherwise intercept the click below.
    const cookieBanner = page.getByRole('dialog', { name: 'Cookies & privacy' });
    const bannerShown = await cookieBanner
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (bannerShown) {
      await cookieBanner.getByRole('button').first().click();
      await expect(cookieBanner).toBeHidden();
    }

    const trigger = page.getByRole('button', { name: 'More navigation' });
    await trigger.waitFor({ state: 'visible' });
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'More navigation' });
    await expect(dialog).toBeVisible();

    // Focus should have moved into the dialog, not stayed on the trigger.
    await expect(trigger).not.toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
