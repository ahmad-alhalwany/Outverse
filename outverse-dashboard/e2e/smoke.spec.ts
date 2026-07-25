import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should allow user to register', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveTitle(/Cosmory/);
    
    // Check page loaded
    await expect(page.locator('h1')).toContainText('Sign up');
  });

  test('should allow user to login', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Cosmory/);
    
    // Check page loaded
    await expect(page.locator('h1')).toContainText('Sign in');
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe('Home Feed', () => {
  test('should load home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Cosmory/);
    
    // Check main content loads
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('should show feed tabs', async ({ page }) => {
    await page.goto('/');
    
    // Check feed tabs are visible
    await expect(page.locator('button:has-text("For You")')).toBeVisible();
    await expect(page.locator('button:has-text("Following")')).toBeVisible();
  });
});

test.describe('Create Post', () => {
  test('should show create post form on home', async ({ page }) => {
    await page.goto('/');
    
    // Check create post form is visible
    await expect(page.locator('[data-testid="create-post-form"], #create-post')).toBeVisible({ timeout: 10000 });
  });
});