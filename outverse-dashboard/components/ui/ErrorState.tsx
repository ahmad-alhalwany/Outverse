'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function ErrorState({
  message, retryLabel, onRetry,
}: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div className="empty-feed rounded-2xl py-12 px-6 text-center">
      <ExclamationTriangleIcon className="h-10 w-10 mx-auto text-bazaar mb-3" />
      <p className="font-semibold text-text mb-2">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-vault"
      >
        {retryLabel}
      </button>
    </div>
  );
}
