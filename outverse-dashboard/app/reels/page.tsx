'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReelsChrome from '@/components/reels/ReelsChrome';
import ReelsFeed from '@/components/reels/ReelsFeed';
import { reelPagePath } from '@/lib/fetchReel';

function ReelsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial =
    searchParams.get('feed') === 'following' ? 'following' : 'all';
  const [feed, setFeed] = useState<'all' | 'following'>(initial);
  const tag = searchParams.get('tag');
  const focusRaw = searchParams.get('focus');
  const focusId = focusRaw ? parseInt(focusRaw, 10) : null;

  useEffect(() => {
    if (focusId && Number.isFinite(focusId)) {
      router.replace(reelPagePath(focusId));
    }
  }, [focusId, router]);

  if (focusId && Number.isFinite(focusId)) {
    return (
      <div className="reels-app reels-feed--loading">
        <div className="reels-feed__loader">
          <span className="reels-feed__orb" />
        </div>
      </div>
    );
  }

  return (
    <div className="reels-app">
      <ReelsChrome feed={feed} onFeedChange={setFeed} />
      <ReelsFeed feed={feed} tag={tag} focusId={Number.isFinite(focusId) ? focusId : null} />
    </div>
  );
}

export default function ReelsPage() {
  return (
    <Suspense
      fallback={
        <div className="reels-app reels-feed--loading">
          <div className="reels-feed__loader">
            <span className="reels-feed__orb" />
          </div>
        </div>
      }
    >
      <ReelsPageContent />
    </Suspense>
  );
}
