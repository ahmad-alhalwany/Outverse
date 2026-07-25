import { NextRequest, NextResponse } from 'next/server';
import { apiFetchJson } from '@/lib/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'impression';

    // Forward to Django backend
    const endpoint = action === 'click' 
      ? 'ads/delivery/click/' 
      : 'ads/delivery/impression/';

    const res = await apiFetchJson(endpoint, {
      method: 'POST',
      json: body,
    });

    const data = await res.json();
    
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Ad delivery error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placement = searchParams.get('placement');

    // Fetch active ads for a placement
    const params = placement ? `?placement=${placement}` : '';
    const res = await apiFetchJson(`ads/ads/${params}`, {
      method: 'GET',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Ad fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}