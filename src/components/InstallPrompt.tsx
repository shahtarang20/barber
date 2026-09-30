"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function InstallPrompt({ isCustomer = false, appName = "BarberSaaS" }: { isCustomer?: boolean; appName?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);

  useEffect(() => {
    // Check if app is already installed
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
      // @ts-ignore
      const isIOSStandalone = window.navigator.standalone === true;
      return isStandaloneMedia || isIOSStandalone;
    };

    const standalone = checkStandalone();
    setIsStandalone(standalone);

    if (standalone) return;

    // Respect "not now": don't show it again for a week.
    try {
      if (Number(localStorage.getItem("install-dismissed-until") || 0) > Date.now()) return;
    } catch {}

    // Always show prompt after a short delay (for both mobile and desktop)
    // Desktop users can also install PWAs!
    const timer = setTimeout(() => setShowPrompt(true), 3000);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Also check if it was caught globally
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
      setShowPrompt(true);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback for iOS or when native prompt isn't ready
      const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
      if (isIOS) {
        toast.add({ title: "Install Instructions", description: "Tap the Share button at the bottom of your screen, then select 'Add to Home Screen'.", type: "info" });
      } else {
        toast.add({ title: "Install Instructions", description: "Tap the 3-dot menu in your browser and select 'Install app' or 'Add to Home screen'.", type: "info" });
      }
    }
  };

  const dismiss = () => {
    setShowPrompt(false);
    try { localStorage.setItem("install-dismissed-until", String(Date.now() + 7 * 24 * 60 * 60 * 1000)); } catch {}
  };

  if (isStandalone || !showPrompt) return null;

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
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Install {appName}</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Add to home screen for faster booking
            </p>
          </div>
        </div>
        
        <Button onClick={handleInstallClick} size="sm" className="shrink-0 bg-zinc-900 text-white rounded-full px-4 font-semibold">
          Install
        </Button>
      </div>
    </div>
  );
}
