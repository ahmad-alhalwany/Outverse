import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Cosmory dashboard.
 *
 * Environment variables:
 * - E2E_BASE_URL: target Next.js app (default http://localhost:3000)
 * - E2E_API_URL: Django API origin (default http://127.0.0.1:8000)
 * - E2E_USERNAME / E2E_PASSWORD: existing test account credentials
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'e2e-report' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts$/, teardown: 'cleanup' },
    {
      name: 'chromium',
      testMatch: /(auth|authenticated|reels|inspiration)\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/state.json' },
      dependencies: ['setup'],
    },
    {
      name: 'smoke',
      testMatch: /(coreflows|newpages|shop|lab|search|a11y-dialogs)\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    { name: 'cleanup', testMatch: /.*\.teardown\.ts$/ },
  ],
  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
        env: {
          NEXT_PUBLIC_API_URL: process.env.E2E_API_URL || 'http://127.0.0.1:8000',
        },
      },
});
