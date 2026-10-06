"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const urlBase64ToUint8Array = (base64: string) => {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

const noopSubscribe = () => () => {};
const canPush = () => !!VAPID_PUBLIC_KEY && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const choiceListeners = new Set<() => void>();
const subscribeChoice = (cb: () => void) => { choiceListeners.add(cb); return () => { choiceListeners.delete(cb); }; };
const choiceChanged = () => choiceListeners.forEach((l) => l());

/**
 * "Get offers from …": asks permission and saves this device. Nothing happens unless the customer taps the button,
 * and the same button turns it off again. Hidden on browsers that cannot do web push.
 */
export function OfferNotify({ kind, slug, name }: { kind: "barber" | "shop"; slug: string; name: string }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const storeKey = `offers_on_${kind}_${slug}`;
  // Both values come from the browser (support, saved choice); reading them this way keeps server and first client render equal.
  const supported = useSyncExternalStore(noopSubscribe, canPush, () => false);
  const on = useSyncExternalStore(
    subscribeChoice,
    useCallback(() => { try { return localStorage.getItem(storeKey) === "1" && Notification.permission === "granted"; } catch { return false; } }, [storeKey]),
    () => false
  );

  if (!supported) return null;

  const turnOn = async () => {
    setBusy(true); setMessage("");
    try {
      if ((await Notification.requestPermission()) !== "granted") { setMessage(t("catOffersBlocked")); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) }));
      const res = await fetch("/api/public/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, slug, subscription: sub.toJSON() }) });
      if (!res.ok) throw new Error("save failed");
      try { localStorage.setItem(storeKey, "1"); } catch { /* ignore */ }
      choiceChanged();
    } catch { setMessage(t("catOffersFailed")); } finally { setBusy(false); }
  };

  const turnOff = async () => {
    setBusy(true); setMessage("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await fetch("/api/public/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, slug, endpoint: sub.endpoint }) });
      try { localStorage.removeItem(storeKey); } catch { /* ignore */ }
      choiceChanged();
    } catch { setMessage(t("catOffersFailed")); } finally { setBusy(false); }
  };

  return (
    <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900">{on ? <Bell className="h-4 w-4 text-green-600" aria-hidden="true" /> : <BellOff className="h-4 w-4" aria-hidden="true" />}{on ? t("catOffersOn").replace("{name}", name) : t("catGetOffers").replace("{name}", name)}</p>
        {!on && <p className="mt-1 text-xs text-zinc-500">{t("catGetOffersDesc")}</p>}
        {message && <p role="alert" className="mt-1 text-xs text-red-600">{message}</p>}
      </div>
      <Button variant={on ? "outline" : "default"} className="h-11 shrink-0" disabled={busy} onClick={on ? turnOff : turnOn}>{on ? t("catOffersTurnOff") : t("catGetOffers").replace("{name}", name)}</Button>
    </div>
  );
}
