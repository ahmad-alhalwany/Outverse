import { Suspense } from 'react';
import { apiFetch } from '@/lib/api';
import HomePageClient from '@/components/home/HomePageClient';
import type { HomeFeed } from '@/lib/postsApi';

function parseFeed(raw?: string): HomeFeed {
  if (raw === 'following') return 'following';
  if (raw === 'discover') return 'discover';
  if (raw === 'joined' || raw === 'resonance') return 'joined';
  return 'for_you';
}

async function getInitialPosts(feed: HomeFeed) {
  try {
    const params = new URLSearchParams();
    params.set('feed', feed);
    params.set('limit', '10');
    const res = await apiFetch(`posts/?${params}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.results || [];
  } catch {
    return [];
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ feed?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const feed = parseFeed(resolvedSearchParams.feed);
  const initialPosts = await getInitialPosts(feed);

  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background text-text flex items-center justify-center pt-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-vault border-t-transparent animate-spin" />
            <span className="text-text-secondary text-sm">Loading Cosmory…</span>
          </div>
        </main>
      }
    >
      <HomePageClient initialPosts={initialPosts} initialFeed={feed} />
    </Suspense>
  );
}