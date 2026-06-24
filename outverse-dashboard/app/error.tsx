'use client';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-lg font-bold text-text">Something went wrong</h2>
        <p className="text-sm text-text-secondary">{error.message || 'Unexpected error'}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-xl bg-vault font-semibold text-sm text-white"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
