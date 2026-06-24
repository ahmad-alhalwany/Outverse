import { Suspense } from 'react';
import { apiFetch } from '@/lib/api';
import HomePageClient from '@/components/home/HomePageClient';

async function getInitialPosts(feed: 'all' | 'following') {
  try {
    const feedParam = feed === 'following' ? '?feed=following' : '';
    const res = await apiFetch(`posts/${feedParam}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
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
  const feed = resolvedSearchParams.feed === 'following' ? 'following' : 'all';
  const initialPosts = await getInitialPosts(feed);

  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background text-text flex items-center justify-center pt-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-vault border-t-transparent animate-spin" />
            <span className="text-text-secondary text-sm">Loading Outverse…</span>
          </div>
        </main>
      }
    >
      <HomePageClient initialPosts={initialPosts} initialFeed={feed} />
    </Suspense>
  );
}