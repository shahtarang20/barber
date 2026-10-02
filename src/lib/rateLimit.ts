import { Redis } from '@upstash/redis';
import { trackUsage } from '@/lib/usage';

// Fallback in-memory store in case Redis is not configured
const hits = new Map<string, { count: number; resetAt: number }>();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_REDIS_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_REDIS_TOKEN || process.env.KV_REST_API_TOKEN;

let redis: Redis | null = null;
if (redisUrl && redisToken) {
  try {
    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  } catch (error) {
    console.warn("Failed to initialize Upstash Redis. Falling back to in-memory rate limiting.", error);
  }
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (redis) {
    try {
      // Use Redis INCR and EXPIRE to implement rate limiting
      // A more robust algorithm is sliding window, but fixed window is sufficient for our current scale.
      const current = await redis.incr(key);
      trackUsage('redis');
      
      // If this is the first request in the window, set the expiry
      if (current === 1) {
        // windowMs is in milliseconds, redis.expire takes seconds or we can use pexpire
        await redis.pexpire(key, windowMs);
        trackUsage('redis');
      }
      
      if (current > limit) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn("Redis rate limit failed. Falling back to in-memory.", error);
      // Fall through to in-memory logic
    }
  }

  // In-memory fallback
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
