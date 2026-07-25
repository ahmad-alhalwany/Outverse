import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  debug: process.env.NODE_ENV === 'development',
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  beforeSend(event) {
    if (event.exception) {
      for (const value of event.exception.values || []) {
        if (value.type === 'ChunkLoadError' || value.type === 'NetworkError') {
          return null;
        }
      }
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;