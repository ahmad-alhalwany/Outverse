/**
 * Sentry browser integration — env-gated and safe to import even when
 * no DSN is configured.
 *
 * Set NEXT_PUBLIC_SENTRY_DSN in your environment to activate. Without
 * a DSN, Sentry.init is a no-op and every capture function returns
 * immediately, so app code can call them unconditionally.
 */
import * as Sentry from '@sentry/browser';
import type { ErrorEvent } from '@sentry/browser';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENV = process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV || 'development';
const RELEASE = process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined;

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (!DSN) return; // No-op without a DSN — never break the app.
  try {
    Sentry.init({
      dsn: DSN,
      environment: ENV,
      release: RELEASE,
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 0),
      attachStacktrace: true,
      sendDefaultPii: false,
    });
    initialized = true;
  } catch {
    /* best-effort — telemetry must never break the app */
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* best-effort */
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!initialized) return;
  try {
    Sentry.captureMessage(message, level);
  } catch {
    /* best-effort */
  }
}

export function setUserContext(user: { id?: string | number; username?: string } | null): void {
  if (!initialized) return;
  try {
    Sentry.setUser(user ? { id: String(user.id), username: user.username } : null);
  } catch {
    /* best-effort */
  }
}

export type { ErrorEvent };
