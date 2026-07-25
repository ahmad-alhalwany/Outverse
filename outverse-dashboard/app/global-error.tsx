'use client';

import { useEffect } from 'react';
import { initSentry, captureException } from '@/lib/sentry';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    initSentry();
    captureException(error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a22] text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-sm text-white/70">{error.message || 'Unexpected error'}</p>
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 rounded-xl bg-violet-600 font-semibold text-sm"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
