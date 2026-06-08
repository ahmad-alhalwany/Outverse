import { NextRequest, NextResponse } from 'next/server';
import { filterFallback, type PickerMediaItem } from '@/lib/pickerFallback';

const GIPHY_KEY = process.env.GIPHY_API_KEY || process.env.NEXT_PUBLIC_GIPHY_API_KEY;
const TENOR_KEY = process.env.TENOR_API_KEY || process.env.NEXT_PUBLIC_TENOR_API_KEY;

function mapGiphy(data: { id: string; images: Record<string, { url?: string }> }[]): PickerMediaItem[] {
  return data.map((d) => ({
    id: d.id,
    preview: d.images.fixed_width_small?.url || d.images.preview_gif?.url || '',
    url: d.images.original?.url || d.images.downsized_medium?.url || '',
  })).filter((i) => i.preview && i.url);
}

async function fetchGiphy(
  type: 'gif' | 'sticker',
  q: string,
): Promise<PickerMediaItem[] | null> {
  if (!GIPHY_KEY) return null;
  const resource = type === 'sticker' ? 'stickers' : 'gifs';
  const path = q ? 'search' : 'trending';
  const params = new URLSearchParams({
    api_key: GIPHY_KEY,
    limit: '30',
    rating: 'g',
  });
  if (q) params.set('q', q);
  const res = await fetch(
    `https://api.giphy.com/v1/${resource}/${path}?${params}`,
    { next: { revalidate: 300 } },
  );
  if (!res.ok) return null;
  const json = await res.json();
  return mapGiphy(json.data || []);
}

async function fetchTenor(
  type: 'gif' | 'sticker',
  q: string,
): Promise<PickerMediaItem[] | null> {
  if (!TENOR_KEY) return null;
  const params = new URLSearchParams({
    key: TENOR_KEY,
    client_key: 'outverse',
    limit: '30',
  });
  if (type === 'sticker') params.set('searchfilter', 'sticker');
  if (q) params.set('q', q);

  const base = q
    ? 'https://tenor.googleapis.com/v2/search'
    : 'https://tenor.googleapis.com/v2/featured';
  const res = await fetch(`${base}?${params}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  const json = await res.json();
  const results = json.results || [];
  return results
    .map((r: { id: string; media_formats: Record<string, { url?: string }> }) => {
      const m = r.media_formats || {};
      return {
        id: r.id,
        preview: m.tinygif?.url || m.nanogif?.url || m.gif?.url || '',
        url: m.gif?.url || m.mediumgif?.url || m.tinygif?.url || '',
      };
    })
    .filter((i: PickerMediaItem) => i.preview && i.url);
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const type = req.nextUrl.searchParams.get('type') === 'sticker' ? 'sticker' : 'gif';

  try {
    const giphy = await fetchGiphy(type, q);
    if (giphy?.length) {
      return NextResponse.json({ items: giphy, source: 'giphy' });
    }
    const tenor = await fetchTenor(type, q);
    if (tenor?.length) {
      return NextResponse.json({ items: tenor, source: 'tenor' });
    }
  } catch {
    /* use fallback */
  }

  return NextResponse.json({
    items: filterFallback(q, type),
    source: 'fallback',
    hint: !GIPHY_KEY && !TENOR_KEY
      ? 'Set GIPHY_API_KEY or TENOR_API_KEY for full search'
      : undefined,
  });
}
