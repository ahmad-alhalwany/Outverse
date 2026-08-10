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
  // Next 14 passes a plain object; keep Promise-compatible for forward compat.
  searchParams?: Promise<{ feed?: string }> | { feed?: string };
}) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {};
  const feed = parseFeed(resolvedSearchParams.feed);
  const initialPosts = await getInitialPosts(feed);

  return <HomePageClient initialPosts={initialPosts} initialFeed={feed} />;
}
