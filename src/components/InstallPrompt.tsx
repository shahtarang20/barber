"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { useInstall } from "@/lib/useInstall";

const DAY = 24 * 60 * 60 * 1000;

export function InstallPrompt({ isCustomer = false, appName = "BarberSaaS" }: { isCustomer?: boolean; appName?: string }) {
  const { t } = useTranslation();
  const { standalone, isIOS, cardShown, install } = useInstall();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (standalone) return;
    // Respect "not now": customers are asked again after a day (installing is the point), barbers after a week.
    try {
      if (Number(localStorage.getItem("install-dismissed-until") || 0) > Date.now()) return;
    } catch {}
    const timer = setTimeout(() => setShowPrompt(true), 3000);
    return () => clearTimeout(timer);
  }, [standalone]);

  const handleInstallClick = async () => {
    if (await install()) { setShowPrompt(false); return; }
    // No native prompt (iPhone, or the browser isn't ready): tell them the steps.
    toast.add({ title: t("installTitle").replace("{name}", appName), description: isIOS ? t("installStepsIOS") : t("installStepsAndroid"), type: "info" });
  };

  const dismiss = () => {
    setShowPrompt(false);
    try { localStorage.setItem("install-dismissed-until", String(Date.now() + (isCustomer ? DAY : 7 * DAY))); } catch {}
  };

  if (standalone || !showPrompt || cardShown) return null;

  return (
    <div className={`fixed ${isCustomer ? "bottom-6" : "bottom-20 md:bottom-6"} left-0 right-0 z-50 flex justify-center px-4 pointer-events-none animate-in slide-in-from-bottom-10 fade-in duration-500`}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-4 max-w-sm w-full pointer-events-auto relative">
        <button onClick={dismiss} aria-label="Close" className="absolute -top-3 -right-3 w-10 h-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 border border-zinc-200 shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-black dark:bg-white rounded-xl flex items-center justify-center shrink-0">
             <span className="text-white dark:text-black font-serif font-bold text-2xl">{appName.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t("installTitle").replace("{name}", appName)}</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t("installBenefit")}
            </p>
          </div>
        </div>
        
        <Button onClick={handleInstallClick} size="sm" className="shrink-0 bg-zinc-900 text-white rounded-full px-4 font-semibold">
          {t("installButton")}
        </Button>
      </div>
    </div>
  );
}
