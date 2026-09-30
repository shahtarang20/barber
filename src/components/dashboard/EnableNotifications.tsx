"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Bell button: turns phone notifications for new bookings on/off for this device. */
export function EnableNotifications() {
  const { t } = useTranslation();
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub && Notification.permission === "granted"))
      .catch(() => {});
  }, []);

  if (!supported) return null;

  const turnOn = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.add({ title: t("notifBlockedTitle"), description: t("notifBlockedDesc"), type: "error" });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) }));
      const res = await fetch("/api/barber/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("save failed");
      setSubscribed(true);
      toast.add({ title: t("notifOnTitle"), description: t("notifOnDesc"), type: "success" });
    } catch {
      toast.add({ title: t("error"), description: t("genericError"), type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/barber/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      toast.add({ title: t("error"), description: t("genericError"), type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={subscribed ? turnOff : turnOn}
      disabled={busy}
      title={subscribed ? t("notifOn") : t("notifEnable")}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        subscribed
          ? "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20"
          : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-zinc-50 dark:hover:bg-zinc-900/50"
      }`}
    >
      {subscribed ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
      <span className="hidden sm:inline">{subscribed ? t("notifOn") : t("notifEnable")}</span>
    </button>
  );
}
