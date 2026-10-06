"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Saved services, kept on this device only (there are no customer accounts, and nothing is sent to the server).
 * Clearing the browser data clears them.
 */
const KEY = "saved_services_v1";
const listeners = new Set<() => void>();
let cache: { raw: string | null; ids: string[] } = { raw: null, ids: [] };

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cache.raw) {
      const parsed = raw ? JSON.parse(raw) : [];
      cache = { raw, ids: Array.isArray(parsed) ? parsed.filter((x: unknown): x is string => typeof x === "string").slice(0, 200) : [] };
    }
  } catch { /* storage blocked: nothing saved */ }
  return cache.ids;
}
const subscribe = (cb: () => void) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; };
const empty: string[] = [];

export function useFavourites() {
  const ids = useSyncExternalStore(subscribe, read, () => empty);
  const toggle = useCallback((id: string) => {
    const current = read();
    const next = current.includes(id) ? current.filter((x) => x !== id) : [id, ...current].slice(0, 200);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    listeners.forEach((l) => l());
  }, []);
  return { ids, has: (id: string) => ids.includes(id), toggle };
}
