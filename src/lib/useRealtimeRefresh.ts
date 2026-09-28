"use client";

import { useEffect, useRef } from "react";

/**
 * Opens a WebSocket to /ws (same origin, same auth cookie) and calls
 * `onUpdate` whenever the server says this barber's data changed —
 * replacing fixed-interval polling with a push-driven refresh.
 * Falls back to a slow interval if the socket can't connect, so the
 * dashboard still updates (just less instantly) if WS is blocked.
 */
export function useRealtimeRefresh(onUpdate: () => void, fallbackIntervalMs = 30000) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let closedByUs = false;

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

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      socket.onopen = () => stopFallback();
      socket.onmessage = () => onUpdateRef.current();
      socket.onerror = () => startFallback();
      socket.onclose = () => {
        startFallback();
        if (!closedByUs) {
          setTimeout(connect, 5000);
        }
      };
    };

    connect();

    return () => {
      closedByUs = true;
      stopFallback();
      socket?.close();
    };
  }, [fallbackIntervalMs]);
}
