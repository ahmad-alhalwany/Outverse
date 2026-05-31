'use client';

export default function PostFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="post-card-premium p-6 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full skeleton-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded skeleton-pulse" />
              <div className="h-3 w-20 rounded skeleton-pulse" />
            </div>
          </div>
          <div className="space-y-2 mb-4">
            <div className="h-3 w-full rounded skeleton-pulse" />
            <div className="h-3 w-4/5 rounded skeleton-pulse" />
          </div>
          <div className="h-48 w-full rounded-xl skeleton-pulse" />
          <div className="flex gap-4 mt-4">
            <div className="h-8 w-24 rounded-full skeleton-pulse" />
            <div className="h-8 w-16 rounded skeleton-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
