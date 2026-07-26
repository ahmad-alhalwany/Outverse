/**
 * Edge middleware — rate-limits internal Next.js API routes and adds
 * per-IP protection for auth-sensitive pages (login, register, forgot-password).
 *
 * The limiter is in-memory (see lib/rateLimit.ts), so each edge instance keeps
 * its own counters — for a single-server deployment this is fine; for
 * multi-instance prod you would swap `check()` for a Redis/Upstash call.
 *
 * Django endpoints (port 8000) are NOT proxied through here, so they need
 * their own server-side rate limiting. This stops client-side spam before it
 * leaves the browser and protects the Next.js-only routes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { check, type RateLimitKey } from './lib/rateLimit';

/** Map URL pathname → rate-limit preset. */
const ROUTE_LIMITS: { pattern: RegExp; key: RateLimitKey }[] = [
  // csp-report intentionally excluded — browsers can flood dozens of reports
  // per page load; rate-limiting them causes noisy 429s without security benefit.
  { pattern: /^\/api\/analytics\/web-vitals$/, key: 'apiRoute' },
  { pattern: /^\/api\/picker\/media$/, key: 'apiRoute' },
  // Auth pages — rate-limit by IP to slow credential stuffing at the edge.
  // Pages themselves render fine; we only count POSTs that hit /api/* proxies.
];

function clientIp(req: NextRequest): string {
  // Respect the first hop from common proxy headers, fall back to socket.
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? '0.0.0.0';
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  for (const { pattern, key } of ROUTE_LIMITS) {
    if (!pattern.test(pathname)) continue;
    const ip = clientIp(req);
    const result = check(key, ip);

    if (!result.success) {
      const retryAfter = Math.ceil(result.resetMs / 1000);
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: `Please retry in ${retryAfter}s.`,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(result.remaining),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }

    // Allow the request through; attach informational headers.
    const res = NextResponse.next();
    res.headers.set('X-RateLimit-Remaining', String(result.remaining));
    return res;
  }

  return NextResponse.next();
}

export const config = {
  // Only run middleware on internal API routes — leave everything else fast.
  matcher: ['/api/:path*'],
};
