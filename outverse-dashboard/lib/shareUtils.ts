import { SITE_ORIGIN } from './fetchReel';
import { apiUrl, mediaUrl } from './api';

export type ShareContentType = 'post' | 'reel';

export type ShareChannel =
  | 'copy'
  | 'native'
  | 'twitter'
  | 'whatsapp'
  | 'facebook'
  | 'telegram'
  | 'linkedin'
  | 'reddit'
  | 'bluesky'
  | 'email'
  | 'dm'
  | 'story'
  | 'embed'
  | 'card'
  | 'unknown';

export type SharePlatform = {
  id: ShareChannel;
  name: string;
  icon: string;
  color: string;
  href: string;
};

const VALID_CHANNELS = new Set<ShareChannel>([
  'copy', 'native', 'twitter', 'whatsapp', 'facebook', 'telegram',
  'linkedin', 'reddit', 'bluesky', 'email', 'dm', 'story', 'embed', 'card', 'unknown',
]);

export function normalizeShareChannel(channel: string): ShareChannel {
  return VALID_CHANNELS.has(channel as ShareChannel) ? (channel as ShareChannel) : 'unknown';
}

/** Canonical share URL with optional UTM for analytics. */
export function buildShareUrl(
  path: string,
  opts?: { campaign?: string; source?: ShareChannel },
): string {
  const base = `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
  if (!opts?.source && !opts?.campaign) return base;
  const params = new URLSearchParams();
  if (opts.source) params.set('utm_source', opts.source);
  params.set('utm_medium', 'share');
  if (opts.campaign) params.set('utm_campaign', opts.campaign);
  else params.set('utm_campaign', 'cosmic_signal');
  return `${base}?${params.toString()}`;
}

export function postSharePath(id: number | string): string {
  return `/post/${id}`;
}

export function postShareUrl(id: number | string, source?: ShareChannel): string {
  return buildShareUrl(postSharePath(id), { source, campaign: 'post_signal' });
}

export function reelShareUrl(id: number | string, source?: ShareChannel): string {
  return buildShareUrl(`/reels/${id}`, { source, campaign: 'reel_signal' });
}

/** Cosmory-flavored default share copy (Instagram/TikTok-style hooks). */
export function cosmicShareText(title: string, contentType: ShareContentType): string {
  const trimmed = title.trim().slice(0, 140);
  if (contentType === 'reel') {
    return trimmed ? `🛸 Signal: ${trimmed}` : '🛸 A cosmic signal from Cosmory';
  }
  return trimmed ? `✨ ${trimmed}` : '✨ A transmission from Cosmory';
}

export function buildPlatformLinks(url: string, text: string): SharePlatform[] {
  const enc = encodeURIComponent(url);
  const encText = encodeURIComponent(text);
  const combo = encodeURIComponent(`${text} ${url}`);
  return [
    { id: 'whatsapp', name: 'WhatsApp', icon: '💬', color: '#25D366', href: `https://wa.me/?text=${combo}` },
    { id: 'twitter', name: 'X', icon: '𝕏', color: '#000000', href: `https://twitter.com/intent/tweet?url=${enc}&text=${encText}` },
    { id: 'telegram', name: 'Telegram', icon: '✈️', color: '#229ED9', href: `https://t.me/share/url?url=${enc}&text=${encText}` },
    { id: 'facebook', name: 'Facebook', icon: 'f', color: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${enc}` },
    { id: 'linkedin', name: 'LinkedIn', icon: 'in', color: '#0A66C2', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc}` },
    { id: 'reddit', name: 'Reddit', icon: '⬆', color: '#FF4500', href: `https://reddit.com/submit?url=${enc}&title=${encText}` },
    { id: 'bluesky', name: 'Bluesky', icon: '🦋', color: '#0085ff', href: `https://bsky.app/intent/compose?text=${combo}` },
    { id: 'email', name: 'Email', icon: '✉️', color: '#64748b', href: `mailto:?subject=${encText}&body=${combo}` },
  ];
}

export function buildEmbedCode(url: string, label = 'View on Cosmory'): string {
  return `<blockquote class="cosmory-embed" cite="${url}">
  <a href="${url}">${label}</a>
</blockquote>`;
}

export type ShareCardOptions = {
  title: string;
  subtitle?: string;
  author?: string;
  mood?: string;
};

/** Download a branded cosmic card (Instagram story-style share image). */
export async function downloadShareCard(filename: string, opts: ShareCardOptions): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#1e0a3c');
  grad.addColorStop(0.45, '#4c1d95');
  grad.addColorStop(1, '#0e7490');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = Math.random() * 2 + 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText('COSMORY', 72, 120);

  ctx.fillStyle = '#e9d5ff';
  ctx.font = '600 36px system-ui, sans-serif';
  ctx.fillText('Cosmic transmission', 72, 180);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px system-ui, sans-serif';
  wrapText(ctx, opts.title.slice(0, 220), 72, 320, canvas.width - 144, 62);

  if (opts.subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '400 32px system-ui, sans-serif';
    wrapText(ctx, opts.subtitle.slice(0, 120), 72, 720, canvas.width - 144, 42);
  }

  if (opts.author) {
    ctx.fillStyle = '#c4b5fd';
    ctx.font = '500 30px system-ui, sans-serif';
    ctx.fillText(`@${opts.author}`, 72, 1180);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '400 26px system-ui, sans-serif';
  ctx.fillText('cosmory · open the portal', 72, 1280);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      resolve(true);
    }, 'image/png');
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

export type PublicProfileMeta = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  avatar?: string | null;
  followers_count?: number;
};

export async function fetchProfilePublic(id: string): Promise<PublicProfileMeta | null> {
  try {
    const res = await fetch(apiUrl(`users/${id}/`), { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as PublicProfileMeta;
  } catch {
    return null;
  }
}

export function profileOgMeta(profile: PublicProfileMeta) {
  const name =
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username || 'Creator';
  const pageUrl = buildShareUrl(`/profile/${profile.id}`, { campaign: 'profile_share' });
  const description = profile.bio?.trim()
    ? profile.bio.slice(0, 160)
    : `@${profile.username || 'creator'} on Cosmory`;
  const imageUrl = profile.avatar ? mediaUrl(profile.avatar) || profile.avatar : `${SITE_ORIGIN}/vercel.svg`;

  return {
    title: `${name} (@${profile.username || 'creator'})`,
    description,
    pageUrl,
    openGraph: {
      title: `${name} on Cosmory`,
      description,
      url: pageUrl,
      siteName: 'Cosmory',
      type: 'profile' as const,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: name }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: `${name} — Cosmory`,
      description,
      images: [imageUrl],
    },
  };
}

export type PublicPostMeta = {
  id: number;
  text?: string;
  user?: { username?: string; first_name?: string; last_name?: string };
  images?: { url?: string }[];
  mood?: string;
};

export async function fetchPostPublic(id: string): Promise<PublicPostMeta | null> {
  try {
    const res = await fetch(apiUrl(`posts/${id}/`), { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as PublicPostMeta;
  } catch {
    return null;
  }
}

export function postOgMeta(post: PublicPostMeta & { media?: { file?: string; media_type?: string }[] }) {
  const author =
    post.user?.username ||
    [post.user?.first_name, post.user?.last_name].filter(Boolean).join(' ') ||
    'creator';
  const text = (post.text || 'A transmission from Cosmory').slice(0, 160);
  const pageUrl = postShareUrl(post.id);
  const imageField =
    post.images?.[0]?.url ||
    (Array.isArray((post as { media?: { file?: string; media_type?: string }[] }).media)
      ? (post as { media: { file?: string; media_type?: string }[] }).media.find((m) => m.media_type === 'image')?.file
      : undefined);
  const imageUrl = imageField ? mediaUrl(imageField) || imageField : `${SITE_ORIGIN}/vercel.svg`;

  return {
    title: `${text.slice(0, 57)}${text.length > 57 ? '…' : ''}`,
    description: `@${author} · Cosmory`,
    pageUrl,
    openGraph: {
      title: `${author} on Cosmory`,
      description: text,
      url: pageUrl,
      siteName: 'Cosmory',
      type: 'article' as const,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: text.slice(0, 80) }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: `${author} — Cosmory`,
      description: text,
      images: [imageUrl],
    },
  };
}
