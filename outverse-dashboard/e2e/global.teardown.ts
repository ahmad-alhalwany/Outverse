/**
 * Global E2E teardown.
 *
 * Currently a no-op placeholder; add cleanup calls here when test artifacts
 * need to be removed from the backend.
 */
import { FullConfig } from '@playwright/test';

async function globalTeardown(_config: FullConfig) {
  /* Intentionally minimal. Individual tests clean up their own data. */
}

export default globalTeardown;
