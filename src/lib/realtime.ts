import Pusher from "pusher";
import { after } from "next/server";
import { trackUsage } from "@/lib/usage";
import { DashboardAlert } from "@/models/DashboardAlert";

// Initialize Pusher only if env vars are present
let pusher: Pusher | null = null;

if (
  process.env.PUSHER_APP_ID &&
  process.env.PUSHER_KEY &&
  process.env.PUSHER_SECRET &&
  process.env.NEXT_PUBLIC_PUSHER_CLUSTER
) {
  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    // PUSHER_HOST lets tests (or a self-hosted Pusher-compatible server) point elsewhere.
    ...(process.env.PUSHER_HOST
      ? { host: process.env.PUSHER_HOST, port: process.env.PUSHER_PORT, useTLS: process.env.PUSHER_TLS === "true" }
      : { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER, useTLS: true }),
  });
}

export function getPusherServer(): Pusher | null {
  return pusher;
}

/** A barber's channel is private — only that barber can subscribe (see /api/pusher/auth). */
export function barberChannel(barberId: string): string {
  return `private-${barberId}`;
}

/**
 * Notify every connected dashboard tab for this barber that their data
 * changed, so the client re-fetches.
 */
export async function notifyBarber(barberId: string, type: string, data?: Record<string, unknown>) {
  if (!pusher) {
    console.warn("Pusher is not configured. Realtime updates disabled.");
    return;
  }

  const send = async () => {
    try {
      // Customer details (name, phone, waitlist) are NOT sent through the live-update service: they are kept briefly on our
      // own server and the event carries only the id of that record, which only this barber can open.
      let alertId: string | undefined;
      if (data) alertId = String((await DashboardAlert.create({ barberId, type, data }))._id);
      await pusher!.trigger(barberChannel(barberId), "update", alertId ? { type, alertId } : { type });
      trackUsage("pusher");
    } catch (error) {
      console.error("Failed to trigger Pusher event:", error);
    }
  };

  // Callers don't wait for this. On a serverless host the function can be frozen the moment the
  // response is sent, which would silently drop a still-running request — so hand it to `after`,
  // which keeps the function alive until the event has gone out (and doesn't slow the response).
  try {
    after(send);
  } catch {
    void send(); // not inside a request (e.g. a script): just fire it
  }
}
