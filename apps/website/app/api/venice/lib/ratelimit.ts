import { Redis } from "@upstash/redis";

const DAILY_LIMIT = 10;

function getRedis(): Redis | null {
  const url = process.env.x402_KV_REST_API_URL;
  const token = process.env.x402_KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({ url, token });
}

function getDayKey(userAddress: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `venice:ratelimit:${userAddress.toLowerCase()}:${today}`;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

/**
 * Check and increment rate limit for a user.
 * Returns whether the request is allowed and how many remain.
 * If Redis is not configured, allows all requests (development mode).
 */
export async function checkRateLimit(
  userAddress: string
): Promise<RateLimitResult> {
  const redis = getRedis();

  // If Redis is not configured, allow all requests
  if (!redis) {
    console.warn("Upstash Redis not configured, rate limiting disabled");
    return { allowed: true, remaining: DAILY_LIMIT, limit: DAILY_LIMIT };
  }

  const key = getDayKey(userAddress);

  try {
    const current = await redis.get<number>(key);
    const used = current ?? 0;

    if (used >= DAILY_LIMIT) {
      return {
        allowed: false,
        remaining: 0,
        limit: DAILY_LIMIT,
      };
    }

    // Increment and set expiry to end of day (25h to be safe with timezones)
    await redis.incr(key);
    if (used === 0) {
      await redis.expire(key, 90000); // 25 hours
    }

    return {
      allowed: true,
      remaining: DAILY_LIMIT - used - 1,
      limit: DAILY_LIMIT,
    };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    // Fail open - allow the request if Redis is down
    return { allowed: true, remaining: DAILY_LIMIT, limit: DAILY_LIMIT };
  }
}
