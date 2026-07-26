import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * CSP report endpoint. Browsers may POST `application/csp-report` or JSON.
 * Always acknowledge quickly so report floods do not look like app failures.
 */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    let report: unknown = null;
    if (raw) {
      try {
        report = JSON.parse(raw);
      } catch {
        report = { raw: raw.slice(0, 2000) };
      }
    }

    if (process.env.NODE_ENV === 'development' && report) {
      const blocked =
        (report as { 'csp-report'?: { 'blocked-uri'?: string; 'effective-directive'?: string } })?.[
          'csp-report'
        ];
      if (blocked?.['blocked-uri']) {
        console.warn(
          `[CSP] ${blocked['effective-directive'] || 'unknown'} blocked ${blocked['blocked-uri']}`,
        );
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'csp-report' });
}
