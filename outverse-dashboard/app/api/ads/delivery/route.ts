import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:8000'
);

function djangoAdsUrl(placement: string | null): string {
  const url = new URL(`${API_ORIGIN}/api/ads/ads/`);
  if (placement) url.searchParams.set('placement', placement);
  return url.toString();
}

function normalizeAdsPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)) {
    return (data as { results: unknown[] }).results;
  }
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'impression';
    const endpoint =
      action === 'click'
        ? `${API_ORIGIN}/api/ads/delivery/click/`
        : `${API_ORIGIN}/api/ads/delivery/impression/`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ success: false }));
    return NextResponse.json(data, { status: res.ok ? res.status : 200 });
  } catch (error) {
    console.error('Ad delivery error:', error);
    return NextResponse.json({ success: false, error: 'Ad delivery unavailable' }, { status: 200 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placement = searchParams.get('placement');
    const res = await fetch(djangoAdsUrl(placement), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      // Never surface upstream 404 as a broken Next route — empty inventory is fine.
      return NextResponse.json([], { status: 200 });
    }

    const data = await res.json().catch(() => []);
    return NextResponse.json(normalizeAdsPayload(data), { status: 200 });
  } catch (error) {
    console.error('Ad fetch error:', error);
    return NextResponse.json([], { status: 200 });
  }
}
