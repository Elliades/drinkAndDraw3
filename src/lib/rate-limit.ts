/**
 * Tiny in-process token bucket. Adequate for single-instance deployments
 * (Railway service with 1 replica). Swap for `@upstash/ratelimit` when scaling out.
 */

interface Bucket {
  tokens: number;
  updated: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  /** Max tokens (burst). */
  capacity: number;
  /** Tokens added per second (sustained rate). */
  refillPerSecond: number;
}

const DEFAULTS: Record<string, RateLimitConfig> = {
  default: { capacity: 60, refillPerSecond: 1 },
  upload: { capacity: 10, refillPerSecond: 0.1 },
  auth: { capacity: 10, refillPerSecond: 0.1 },
  comment: { capacity: 30, refillPerSecond: 0.2 },
};

export function rateLimit(
  key: string,
  bucketName: keyof typeof DEFAULTS | RateLimitConfig = "default",
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const cfg =
    typeof bucketName === "string"
      ? (DEFAULTS[bucketName] ?? DEFAULTS.default!)
      : bucketName;
  const now = Date.now();
  const existing = buckets.get(key);
  let bucket: Bucket;
  if (!existing) {
    bucket = { tokens: cfg.capacity, updated: now };
  } else {
    const elapsedSeconds = (now - existing.updated) / 1000;
    bucket = {
      tokens: Math.min(cfg.capacity, existing.tokens + elapsedSeconds * cfg.refillPerSecond),
      updated: now,
    };
  }
  if (bucket.tokens < 1) {
    const need = 1 - bucket.tokens;
    const retryAfterSeconds = Math.ceil(need / cfg.refillPerSecond);
    buckets.set(key, bucket);
    return { ok: false, retryAfterSeconds };
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return { ok: true };
}

export class RateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(`Rate limited. Try again in ${retryAfterSeconds}s.`);
    this.name = "RateLimitedError";
  }
}

export function enforceRateLimit(
  key: string,
  bucketName: keyof typeof DEFAULTS | RateLimitConfig = "default",
): void {
  const result = rateLimit(key, bucketName);
  if (!result.ok) throw new RateLimitedError(result.retryAfterSeconds);
}
