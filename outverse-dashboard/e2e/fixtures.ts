import { test as base, expect, request as playwrightRequest, APIRequestContext } from '@playwright/test';

/**
 * Shared fixtures for Cosonova E2E tests.
 */
export type TestFixtures = {
  apiUrl: string;
  apiRequest: APIRequestContext;
};

export const test = base.extend<TestFixtures>({
  apiUrl: async ({}, use) => {
    await use((process.env.E2E_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, ''));
  },
  // Use a dedicated API context so tests can bypass the browser for seed/cleanup.
  apiRequest: async ({ apiUrl }, use) => {
    const ctx = await playwrightRequest.newContext({
      baseURL: apiUrl,
      extraHTTPHeaders: { Accept: 'application/json' },
    });
    await use(ctx);
    await ctx.dispose();
  },
});

export { expect };
