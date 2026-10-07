"use client";

import { useEffect, useRef } from "react";
import PusherClient from "pusher-js";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Opens a Pusher connection and calls `onUpdate` whenever the server 
 * triggers an event on the barber's channel.
 */
export function useRealtimeRefresh(onUpdate: (event?: { type: string; data?: any }) => void, fallbackIntervalMs = 30000) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const { data: profileRes } = useSWR("/api/barber/profile", fetcher);
  const barberId = profileRes?.success ? profileRes.data._id : null;

  useEffect(() => {
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let pusher: PusherClient | null = null;

    const startFallback = () => {
      if (fallbackTimer) return;
      fallbackTimer = setInterval(() => onUpdateRef.current(), fallbackIntervalMs);
    };

    const stopFallback = () => {
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    };

    if (!barberId) {
      startFallback();
      return () => stopFallback();
    }

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    const channelName = `private-${barberId}`;

    if (pusherKey && pusherCluster) {
      pusher = new PusherClient(pusherKey, {
        cluster: pusherCluster,
        channelAuthorization: {
          endpoint: "/api/pusher/auth",
          transport: "ajax",
        },
      });

      pusher.connection.bind("connected", () => {
        stopFallback();
      });

      pusher.connection.bind("disconnected", () => {
        startFallback();
      });

      pusher.connection.bind("error", () => {
        startFallback();
      });

      const channel = pusher.subscribe(channelName);
      channel.bind("update", async (event?: { type: string; alertId?: string; data?: any }) => {
        // Events never carry customer details; if there is something to show, fetch it from our own server (this barber only).
        if (event?.alertId) {
          try {
            const res = await fetch(`/api/barber/alerts/${event.alertId}`);
            const json = await res.json();
            onUpdateRef.current(json?.success ? { type: json.data.type, data: json.data.data } : { type: event.type });
          } catch { onUpdateRef.current({ type: event.type }); }
          return;
        }
        onUpdateRef.current(event);
      });
      channel.bind("pusher:subscription_error", () => {
        startFallback();
      });
    } else {
      startFallback();
    }

    return () => {
      stopFallback();
      if (pusher) {
        pusher.unsubscribe(channelName);
        pusher.disconnect();
      }
    };
  }, [barberId, fallbackIntervalMs]);
}
