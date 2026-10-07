"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";

type RealtimeEvent = { type: string; data?: any };
type Listener = (event?: RealtimeEvent) => void;

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * One live connection for the whole dashboard, shared by every page that listens (instead of each page opening
 * its own and closing it on every navigation). The pusher library itself (~60 KB) is only downloaded when a page
 * that listens is opened and a connection is actually needed. The connection closes a little after the last
 * listener leaves, so moving between two live pages does not reconnect.
 */
const listeners = new Set<Listener>();
const connectionState = new Set<() => void>(); // told when the live connection goes up or down
let connected = false;
let current: { barberId: string; pusher: any; channelName: string } | null = null;
let starting: string | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function setConnected(v: boolean) {
  if (connected === v) return;
  connected = v;
  connectionState.forEach((fn) => fn());
}

function emit(event?: RealtimeEvent) {
  listeners.forEach((l) => l(event));
}

function closeConnection() {
  if (current) {
    try {
      current.pusher.unsubscribe(current.channelName);
      current.pusher.disconnect();
    } catch {}
    current = null;
  }
  starting = null;
  setConnected(false);
}

async function openConnection(barberId: string) {
  const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!pusherKey || !pusherCluster) return;
  if (current?.barberId === barberId || starting === barberId) return;
  if (current) closeConnection();
  starting = barberId;
  let PusherClient: any;
  try {
    PusherClient = (await import("pusher-js")).default;
  } catch {
    if (starting === barberId) starting = null;
    return;
  }
  // Everyone left (or another barber logged in) while the library was downloading.
  if (starting !== barberId || listeners.size === 0) { if (starting === barberId) starting = null; return; }

  const channelName = `private-${barberId}`;
  const pusher = new PusherClient(pusherKey, {
    cluster: pusherCluster,
    channelAuthorization: { endpoint: "/api/pusher/auth", transport: "ajax" },
  });
  current = { barberId, pusher, channelName };
  starting = null;

  pusher.connection.bind("connected", () => setConnected(true));
  pusher.connection.bind("disconnected", () => setConnected(false));
  pusher.connection.bind("error", () => setConnected(false));

  const channel = pusher.subscribe(channelName);
  channel.bind("update", async (event?: { type: string; alertId?: string; data?: any }) => {
    // Events never carry customer details; if there is something to show, fetch it from our own server (this barber only).
    if (event?.alertId) {
      try {
        const res = await fetch(`/api/barber/alerts/${event.alertId}`);
        const json = await res.json();
        emit(json?.success ? { type: json.data.type, data: json.data.data } : { type: event.type });
      } catch { emit({ type: event.type }); }
      return;
    }
    emit(event);
  });
  channel.bind("pusher:subscription_error", () => setConnected(false));
}

/**
 * Calls `onUpdate` whenever the server triggers an event on the barber's channel. While the live connection is not
 * up it refreshes on a timer instead (paused while the screen is off or the tab is in the background).
 */
export function useRealtimeRefresh(onUpdate: (event?: { type: string; data?: any }) => void, fallbackIntervalMs = 30000) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Who this is is fixed for the whole session: no need to ask again on every focus.
  const { data: profileRes } = useSWR("/api/barber/profile", fetcher, { revalidateOnFocus: false, dedupingInterval: 300_000 });
  const barberId: string | null = profileRes?.success ? profileRes.data._id : null;

  useEffect(() => {
    const listener: Listener = (e) => onUpdateRef.current(e);
    listeners.add(listener);
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }

    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    const syncFallback = () => {
      const needed = !connected;
      if (needed && !fallbackTimer) {
        fallbackTimer = setInterval(() => {
          if (document.visibilityState === "visible") onUpdateRef.current();
        }, fallbackIntervalMs);
      } else if (!needed && fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    };
    connectionState.add(syncFallback);
    syncFallback();
    if (barberId) openConnection(barberId);

    return () => {
      listeners.delete(listener);
      connectionState.delete(syncFallback);
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (listeners.size === 0 && !closeTimer) closeTimer = setTimeout(() => { closeTimer = null; if (listeners.size === 0) closeConnection(); }, 60_000);
    };
  }, [barberId, fallbackIntervalMs]);
}
