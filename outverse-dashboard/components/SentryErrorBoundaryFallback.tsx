'use client';

import { useLocale } from '@/components/LocaleProvider';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface SentryErrorBoundaryFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function SentryErrorBoundaryFallback({ error, resetErrorBoundary }: SentryErrorBoundaryFallbackProps) {
  const { t } = useLocale();
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 text-6xl">🛸</div>
        <h2 className="text-2xl font-bold text-text mb-3">
          {t('sentry.somethingWentWrong')}
        </h2>
        <p className="text-text-secondary mb-6">
          {t('sentry.errorMessage')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={resetErrorBoundary}
            className="px-6 py-3 rounded-xl font-semibold text-white"
            style={{ background: 'var(--c-vault)' }}
          >
            <ArrowPathIcon className="h-5 w-5 inline mr-2" />
            {t('sentry.tryAgain')}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl font-semibold border border-surface bg-transparent text-text"
          >
            {t('sentry.reloadPage')}
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-text-secondary">
              Error Details
            </summary>
            <pre className="mt-3 p-4 text-xs overflow-auto rounded bg-surface text-text-secondary">
              {error?.message}
              {error?.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}