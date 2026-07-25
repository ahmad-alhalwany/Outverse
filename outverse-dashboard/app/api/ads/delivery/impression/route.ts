import { NextRequest, NextResponse } from 'next/server';
import { apiFetchJson } from '@/lib/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Forward to Django backend
    const res = await apiFetchJson('ads/delivery/impression/', {
      method: 'POST',
      json: body,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Ad impression proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to log impression' },
      { status: 500 }
    );
  }
}