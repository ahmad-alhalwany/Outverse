/**
 * In-memory rate limiter — lightweight client/edge protection.
 *
 * KISS design: a token-bucket per identifier (IP or username) with TTL-based
 * expiry. No external services (no Upstash/Redis required), so it works in
 * dev, in CI, and on the serverless edge equally.
 *
 * For server-side Django endpoints you still want server-side rate limiting,
 * but this stops the *client* from spamming requests in the first place.
 */

type Bucket = {
  /** Tokens currently available. */
  tokens: number;
  /** Millisecond timestamp of last refill. */
  lastRefill: number;
};

type LimitConfig = {
  /** Maximum tokens (burst size). */
  limit: number;
  /** Time window in ms within which `limit` requests are allowed. */
  windowMs: number;
};

/** Presets per critical endpoint family. Tunable in one place. */
export const RATE_LIMITS = {
  /** Login: 5 attempts / 5 min — slows credential brute-force. */
  login: { limit: 5, windowMs: 5 * 60_000 },
  /** Registration: 3 / hour — blocks automated account creation. */
  register: { limit: 3, windowMs: 60 * 60_000 },
  /** Password reset request: 3 / hour — prevents email-flood abuse. */
  forgotPassword: { limit: 3, windowMs: 60 * 60_000 },
  /** Password reset submit: 5 / 10 min. */
  resetPassword: { limit: 5, windowMs: 10 * 60_000 },
  /** Username availability checks: 10 / min — light, just debounce hammering. */
  checkUsername: { limit: 10, windowMs: 60_000 },
  /** Draft create/update: 20 / min — normal writing cadence. */
  draftWrite: { limit: 20, windowMs: 60_000 },
  /** Scheduled post create: 10 / min. */
  scheduledPostCreate: { limit: 10, windowMs: 60_000 },
  /** Generic API route (csp-report, analytics, picker): 30 / min. */
  apiRoute: { limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, LimitConfig>;

export type RateLimitKey = keyof typeof RATE_LIMITS;

type CacheKey = `${RateLimitKey}:${string}`;

const cache = new Map<CacheKey, Bucket>();

/** Remove buckets whose window has fully expired. Cheap O(n) sweep, throttled. */
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 5 * 60_000;
function maybeSweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  const stale: CacheKey[] = [];
  for (const [key, bucket] of cache) {
    // CacheKey format: `${key}:${identifier}:${windowMs}` — windowMs is the last segment.
    const lastColon = key.lastIndexOf(':');
    const windowMs = Number(key.slice(lastColon + 1));
    if (now - bucket.lastRefill > windowMs) stale.push(key);
  }
  for (const k of stale) cache.delete(k);
}

export type RateLimitResult = {
  /** Whether the request is allowed. */
  success: boolean;
  /** Remaining tokens in current window. */
  remaining: number;
  /** Ms until the bucket resets (useful for Retry-After headers). */
  resetMs: number;
};

/**
 * Check whether a request under `key` for `identifier` is allowed.
 * Called on the client or on the Edge — pure & synchronous.
 *
 * @example
 * const r = check('login', 'ahmad');
 * if (!r.success) throw new Error('Too many attempts. Try again later.');
 */
export function check(
  key: RateLimitKey,
  identifier: string,
): RateLimitResult {
  const { limit, windowMs } = RATE_LIMITS[key];
  const now = Date.now();
  maybeSweep(now);

  const cacheKey = `${key}:${identifier}:${windowMs}` as CacheKey;
  let bucket = cache.get(cacheKey);

  if (!bucket) {
    bucket = { tokens: limit, lastRefill: now };
    cache.set(cacheKey, bucket);
  }

  // Refill: if the whole window has elapsed, reset to full.
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= windowMs) {
    bucket.tokens = limit;
    bucket.lastRefill = now;
  }

  const resetMs = windowMs - (now - bucket.lastRefill);

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return { success: true, remaining: bucket.tokens, resetMs };
  }

  return { success: false, remaining: 0, resetMs };
}

/**
 * Consume a token and throw a friendly `RateLimitError` if exhausted.
 * Sugar for call sites that just want throw-on-limit.
 */
export class RateLimitError extends Error {
  resetMs: number;
  constructor(key: RateLimitKey, resetMs: number) {
    super(
      `Too many requests. Please try again in ${Math.ceil(resetMs / 1000)}s.`,
    );
    this.name = 'RateLimitError';
    this.resetMs = resetMs;
  }
}

/** Throw if the limit for (key, identifier) is exhausted. */
export function consume(key: RateLimitKey, identifier: string): void {
  const r = check(key, identifier);
  if (!r.success) throw new RateLimitError(key, r.resetMs);
}

/** Reset the bucket for a given key+identifier (e.g. after successful login). */
export function reset(key: RateLimitKey, identifier: string): void {
  const { windowMs } = RATE_LIMITS[key];
  cache.delete(`${key}:${identifier}:${windowMs}` as CacheKey);
}

/** Clear all buckets. Useful in tests. */
export function clearAll(): void {
  cache.clear();
}
