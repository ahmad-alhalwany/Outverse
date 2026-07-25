import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Web Vitals]', JSON.stringify(body, null, 2));
    }

    // Here you could:
    // 1. Send to Vercel Analytics / Vercel Speed Insights
    // 2. Send to custom analytics (PostHog, Mixpanel, etc.)
    // 3. Store in database
    // 4. Forward to logging service (Datadog, etc.)

    // For now, just acknowledge receipt
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

export const runtime = 'edge';