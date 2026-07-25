/**
 * Global E2E setup.
 *
 * Ensures a deterministic test user exists in the Django backend and logs the
 * dashboard in via the API so browser tests start with an authenticated session.
 */
import { chromium, expect, FullConfig } from '@playwright/test';

const API_URL = (process.env.E2E_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const USERNAME = process.env.E2E_USERNAME || 'e2e_test_user';
const PASSWORD = process.env.E2E_PASSWORD || 'CosmoryE2E!2026';

async function ensureUser() {
  const res = await fetch(`${API_URL}/api/users/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: USERNAME,
      email: `${USERNAME}@test.local`,
      password: PASSWORD,
      first_name: 'E2E',
      last_name: 'Tester',
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (!data.username?.some((m: string) => m.toLowerCase().includes('already'))) {
      throw new Error(`Failed to create test user: ${JSON.stringify(data)}`);
    }
  }
}

async function globalSetup(config: FullConfig) {
  await ensureUser().catch((err) => {
    // E2E setup logs are intentional for CI debugging.
    // eslint-disable-next-line no-console
    console.warn('[e2e setup] User creation skipped or failed:', err.message);
  });

  const browser = await chromium.launch();
  const page = await browser.newPage({ ignoreHTTPSErrors: true });

  // Seed the backend session cookie and localStorage user object.
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.evaluate(
    async ({ apiUrl, username, password }) => {
      const res = await fetch(`${apiUrl}/api/users/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error(`Login failed: ${res.status}`);
      const data = await res.json();
      if (data.user) localStorage.setItem('cosmory_user', JSON.stringify(data.user));
    },
    { apiUrl: API_URL, username: USERNAME, password: PASSWORD },
  );

  // Wait for client-side hydration redirect to confirm login state.
  await expect(page).toHaveURL(/^(?!.*login).+/, { timeout: 10000 });

  await page.context().storageState({ path: config.projects[0]?.use?.storageState as string ?? 'e2e/.auth/state.json' });
  await browser.close();
}

export default globalSetup;
