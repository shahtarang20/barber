"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { useInstall } from "@/lib/useInstall";
import { InstallHelp } from "@/components/InstallHelp";

const DAY = 24 * 60 * 60 * 1000;
const visitKey = () => `install-dismissed-visit:${window.location.pathname.split("/").slice(0, 3).join("/")}`;

export function InstallPrompt({ isCustomer = false, appName = "BarberSaaS" }: { isCustomer?: boolean; appName?: string }) {
  const { t } = useTranslation();
  const { standalone, ready, signal, isMobile, help, cardShown, install } = useInstall();
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    // Not yet known, or already installed: stay quiet.
    if (!ready || standalone) return;
    // "Not now" hides it for this visit only for customers: the next time they open the link (new tab / new visit) it is back,
    // until the app is really installed. Barbers are asked again after a week.
    try {
      if (isCustomer) { if (sessionStorage.getItem(visitKey()) === "1") return; }
      else if (Number(localStorage.getItem("install-dismissed-until") || 0) > Date.now()) return;
    } catch {}
    const timer = setTimeout(() => setShowPrompt(true), isCustomer ? 1500 : 3000);
    return () => clearTimeout(timer);
  }, [ready, standalone, isCustomer]);

  // Never sit on top of the booking form while someone is typing.
  useEffect(() => {
    const fields = "input, textarea, select";
    const on = (e: Event) => { if ((e.target as Element | null)?.matches?.(fields)) setTyping(true); };
    const off = () => setTimeout(() => setTyping(false), 250);
    document.addEventListener("focusin", on);
    document.addEventListener("focusout", off);
    return () => { document.removeEventListener("focusin", on); document.removeEventListener("focusout", off); };
  }, []);

  const hideForThisVisit = () => {
    setShowPrompt(false);
    try { if (isCustomer) sessionStorage.setItem(visitKey(), "1"); } catch {}
  };

  const handleInstallClick = async () => {
    // No one-tap install possible here (iPhone, in-app browser, old phone): show the steps right inside the banner.
    if (signal !== "ready") { setShowSteps((v) => !v); return; }
    setBusy(true);
    const result = await install();
    setBusy(false);
    if (result === "accepted") {
      setShowPrompt(false);
      toast.add({ title: t("installTitle").replace("{name}", appName), description: t("installDone"), type: "success" });
    } else if (result === "dismissed") {
      hideForThisVisit(); // they closed the browser's dialog: leave them alone for now, ask again next visit
    } else {
      setShowSteps(true); // the browser refused at the last moment: show the steps instead of doing nothing
    }
  };

  const dismiss = () => {
    setShowPrompt(false);
    try {
      if (isCustomer) sessionStorage.setItem(visitKey(), "1");
      else localStorage.setItem("install-dismissed-until", String(Date.now() + 7 * DAY));
    } catch {}
  };

  // Due on this visit, and able to deliver: while the browser is still getting ready we show nothing rather than a button that cannot work yet.
  // (On a computer where the browser cannot install the app there is nothing useful to show.)
  const wanted = !standalone && showPrompt && !cardShown && signal !== "waiting" && !(signal === "none" && !isMobile);
  if (!wanted) return null;

  return (
    <>
    {/* The banner floats over the bottom of the screen. For customers, leave room at the end of the page so the last time buttons can scroll up above it. */}
    {/* The room stays even while the banner steps aside for typing, so the page never jumps under the customer's finger. */}
    {isCustomer && <div aria-hidden="true" style={{ height: 120 }} />}
    {!typing && <div className={`fixed ${isCustomer ? "bottom-6" : "bottom-20 md:bottom-6"} left-0 right-0 z-50 flex justify-center px-4 pointer-events-none animate-in slide-in-from-bottom-10 fade-in duration-500`}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-4 flex flex-col gap-3 max-w-sm w-full pointer-events-auto relative">
        <button onClick={dismiss} aria-label="Close" className="absolute -top-3 -right-3 w-10 h-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 border border-zinc-200 shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 bg-black dark:bg-white rounded-xl flex items-center justify-center shrink-0">
               <span className="text-white dark:text-black font-serif font-bold text-2xl">{appName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t("installTitle").replace("{name}", appName)}</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {t("installBenefit")}
              </p>
            </div>
          </div>
          <Button onClick={handleInstallClick} disabled={busy} size="sm" className="shrink-0 bg-zinc-900 text-white rounded-full px-4 font-semibold">
            {signal === "ready" ? t("installButton") : t("installHow")}
          </Button>
        </div>
        {showSteps && <InstallHelp help={help} className="text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 border border-zinc-100 dark:border-zinc-700" />}
      </div>
    </div>}
    </>
  );
}
