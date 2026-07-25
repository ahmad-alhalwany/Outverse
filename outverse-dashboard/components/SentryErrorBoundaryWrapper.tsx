'use client';

import { ErrorBoundary } from '@sentry/nextjs';
import { SentryErrorBoundaryFallback } from '@/components/SentryErrorBoundaryFallback';

interface SentryFallbackData {
  error: unknown;
  componentStack: string;
  eventId: string;
  resetError(): void;
}

export default function SentryErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, componentStack, eventId, resetError }: SentryFallbackData) => (
        <SentryErrorBoundaryFallback
          error={error instanceof Error ? error : new Error(String(error))}
          resetErrorBoundary={resetError}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}