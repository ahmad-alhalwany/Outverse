import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: process.env.NODE_ENV === 'development',
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  beforeSend(event) {
    // Filter out known non-critical errors
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