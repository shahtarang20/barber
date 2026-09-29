import { Redis } from "@upstash/redis";

// Same pattern as src/lib/realtime.ts's Pusher setup — only initialize if
// credentials are present, so the app keeps working (with the previous
// in-memory fallback behavior) before Upstash is actually configured.
let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export function getRedis(): Redis | null {
  return redis;
}

/**
 * Reads a JSON value from cache, or computes and caches it via `fetcher` if
 * missing/expired. Falls back to calling `fetcher` directly (no caching) if
 * Redis isn't configured — callers don't need to branch on availability.
 */
export async function cached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  if (!redis) return fetcher();

  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch (error) {
    console.error("Redis read error, falling back to direct fetch:", error);
    return fetcher();
  }

  const fresh = await fetcher();
  try {
    await redis.set(key, fresh, { ex: ttlSeconds });
  } catch (error) {
    console.error("Redis write error (non-fatal):", error);
  }
  return fresh;
}

/** Invalidate a cached key immediately — used after a write that makes it stale. */
export async function invalidateCache(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (error) {
    console.error("Redis invalidate error (non-fatal):", error);
  }
}
