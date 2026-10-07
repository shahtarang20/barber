/**
 * Tiny per-server-instance cache with a short life, for settings and public profile lookups that are read on every
 * page view but change rarely. Serverless instances each hold their own copy, so a change shows up everywhere within
 * `ttlMs` (the instance that made the change can call `forget` to see it at once). Concurrent misses share one fetch.
 * Keep the TTL short and NEVER cache anything personal or per-user in here.
 */
const store = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 5_000;

export async function memo<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = fetcher()
    .then((value) => {
      if (store.size >= MAX_ENTRIES) store.clear();
      // "Not found" is never remembered, so a barber/shop that was just created is reachable at once.
      if (value !== null && value !== undefined) store.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function forget(key: string) {
  store.delete(key);
}
