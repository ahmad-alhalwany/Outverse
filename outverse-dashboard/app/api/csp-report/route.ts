import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const report = await request.json();
    
    // Log CSP violations in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('CSP Violation:', JSON.stringify(report, null, 2));
    }
    
    // In production, send to your logging service (Sentry, Datadog, etc.)
    // await fetch('https://your-logging-service.com/csp', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(report),
    // });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CSP Report Error:', error);
    return NextResponse.json({ success: false }, { status: 400 });
  }
}