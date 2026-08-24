import { API_ORIGIN, apiUrl, mediaUrl } from './api';
import { reelAuthorName, type ReelItem } from './reelTypes';

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

export function reelPagePath(id: number | string): string {
  return `/reels/${id}`;
}

export function reelPageUrl(id: number | string): string {
  return `${SITE_ORIGIN}${reelPagePath(id)}`;
}

/** Server-side fetch for OG metadata (no auth). */
export async function fetchReelPublic(id: string): Promise<ReelItem | null> {
  try {
    const res = await fetch(apiUrl(`reels/${id}/`), {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as ReelItem;
  } catch {
    return null;
  }
}

export function reelOgMeta(reel: ReelItem) {
  const author = reelAuthorName(reel.user);
  const caption = (reel.caption || 'Cosmic signal on Cosmory').slice(0, 160);
  const title = caption.length > 60 ? `${caption.slice(0, 57)}…` : caption;
  const description = `@${author} · ${reel.views} views · Cosmory Signals`;
  const pageUrl = reelPageUrl(reel.id);
  const videoUrl = mediaUrl(reel.video) || reel.video;
  const imageUrl = videoUrl || `${SITE_ORIGIN}/vercel.svg`;

  return {
    title,
    description,
    pageUrl,
    openGraph: {
      title: `${author} on Cosmory Signals`,
      description: caption,
      url: pageUrl,
      siteName: 'Cosmory',
      type: 'video.other' as const,
      videos: videoUrl
        ? [{ url: videoUrl, secureUrl: videoUrl, type: 'video/mp4', width: 720, height: 1280 }]
        : undefined,
      images: [{ url: imageUrl, width: 720, height: 1280, alt: 'Cosmory Signal' }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: `${author} — Cosmory Signal`,
      description: caption,
      images: [imageUrl],
    },
  };
}

export { SITE_ORIGIN };
