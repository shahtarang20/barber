"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const MINE = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Shows an "Update now" card whenever a newer version of the app has been released than the one this page was loaded with,
 * for owners and customers alike. It cannot be closed: it stays (on every page, on every visit) until the person taps Update,
 * which refreshes the saved app files and reloads onto the new version.
 */
export function UpdateCard() {
  const { t } = useTranslation();
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const last = useRef(0);

  const check = useCallback(async () => {
    if (MINE === "dev" || document.visibilityState !== "visible") return;
    if (Date.now() - last.current < 15_000) return; // focus/visibility events can come in bursts
    last.current = Date.now();
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const { version } = (await res.json()) as { version?: string };
      if (version && version !== MINE) setStale(true);
    } catch {} // offline: try again later, never bother the person
  }, []);

  useEffect(() => {
    const first = setTimeout(check, 1500);
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onShow = () => check();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    window.addEventListener("online", onShow);
    return () => { clearTimeout(first); clearInterval(timer); document.removeEventListener("visibilitychange", onShow); window.removeEventListener("focus", onShow); window.removeEventListener("online", onShow); };
  }, [check]);

  const update = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update(); // fetch the newest worker (it takes over at once)
      if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k))); // only app files live here, never personal data
    } catch {}
    window.location.reload();
  };

  if (!stale) return null;
  return (
    <div role="alert" className="sticky top-0 z-[60] w-full bg-emerald-600 text-white shadow-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
        <RefreshCw className={`h-5 w-5 shrink-0 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{t("updTitle")}</p>
          <p className="text-xs leading-snug opacity-90">{t("updBody")}</p>
        </div>
        <button type="button" onClick={update} disabled={busy} className="h-11 shrink-0 rounded-full bg-white px-4 text-sm font-bold text-emerald-700 disabled:opacity-70">
          {busy ? t("updBusy") : t("updButton")}
        </button>
      </div>
    </div>
  );
}
