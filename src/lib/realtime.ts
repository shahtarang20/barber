import Pusher from "pusher";

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
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    useTLS: true,
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
export async function notifyBarber(barberId: string, type: string) {
  if (!pusher) {
    console.warn("Pusher is not configured. Realtime updates disabled.");
    return;
  }

  try {
    await pusher.trigger(barberChannel(barberId), "update", { type });
  } catch (error) {
    console.error("Failed to trigger Pusher event:", error);
  }
}
