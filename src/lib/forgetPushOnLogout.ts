"use client";

/**
 * Before signing out, tell the server to forget THIS device's notification address, so a shared phone or salon tablet
 * never keeps showing the previous barber's "New booking: <customer name>" messages to whoever signs in next.
 * Never blocks or breaks logging out.
 */
export async function forgetPushOnThisDevice(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const reg = await Promise.race([navigator.serviceWorker.getRegistration(), new Promise<undefined>((r) => setTimeout(() => r(undefined), 1500))]);
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/barber/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
  } catch { /* ignore: logging out matters more */ }
}
