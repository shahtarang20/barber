"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export function InstallPrompt({ isCustomer = false }: { isCustomer?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // Default true so it doesn't flash before check

  useEffect(() => {
    // Check if app is already installed
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
      // @ts-ignore
      const isIOSStandalone = window.navigator.standalone === true;
      return isStandaloneMedia || isIOSStandalone;
    };

    setIsStandalone(checkStandalone());

    if (checkStandalone()) return; // Don't setup prompts if already installed

    // Handle Android / Desktop Chrome 'beforeinstallprompt'
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Detect iOS for custom prompt
    const isIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };

    if (isIOS()) {
      setShowIOSPrompt(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        console.log("User accepted the install prompt");
      }
      // We've used the prompt, and can't use it again, throw it away
      setDeferredPrompt(null);
    }
  };

  // If already installed, don't show anything
  if (isStandalone) return null;

  // If we have neither the native prompt event nor iOS, don't show the button
  if (!deferredPrompt && !showIOSPrompt) return null;

  return (
    <div className={`fixed ${isCustomer ? "bottom-6" : "bottom-20 md:bottom-6"} left-0 right-0 z-50 flex justify-center px-4 pointer-events-none`}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl p-4 flex items-center justify-between gap-4 max-w-sm w-full pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Install App</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {showIOSPrompt && !deferredPrompt ? "Tap Share → Add to Home Screen" : "Add to home screen for quick access"}
            </p>
          </div>
        </div>
        
        {deferredPrompt && (
          <Button onClick={handleInstallClick} size="sm" className="shrink-0 bg-zinc-900 text-white rounded-full">
            Install
          </Button>
        )}
      </div>
    </div>
  );
}
