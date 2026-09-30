import webpush from "web-push";
import connectToDatabase from "@/lib/mongodb";
import { PushSubscription } from "@/models/PushSubscription";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

export const isPushConfigured = Boolean(publicKey && privateKey);
if (isPushConfigured) webpush.setVapidDetails(subject, publicKey!, privateKey!);

/**
 * Sends a phone/desktop notification to every device a barber has enabled
 * notifications on — works even when the app is closed. Does nothing if the
 * VAPID keys aren't configured. Dead subscriptions (uninstalled app, revoked
 * permission) are removed. Never throws: a failed notification must not fail
 * the booking that triggered it.
 */
export async function pushToBarber(barberId: string, payload: { title: string; body: string; url?: string }) {
  if (!isPushConfigured) return;
  try {
    await connectToDatabase();
    const subs = await PushSubscription.find({ barberId });
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
            JSON.stringify({ ...payload, url: payload.url || "/dashboard/appointments" }),
            { TTL: 60 * 60 * 6 }
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await PushSubscription.deleteOne({ _id: s._id });
          else console.error("Push send failed:", err);
        }
      })
    );
  } catch (err) {
    console.error("Push error:", err);
  }
}
