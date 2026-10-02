"use client";

import { useEffect } from "react";
import { captureInstallEvents } from "@/lib/useInstall";

export function PWARegister() {
  useEffect(() => {
    captureInstallEvents(); // remember "this can be installed" even if it fires before the install banner is on screen
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // A new service worker taking control means a new version was
      // deployed — reload once to pick it up, instead of leaving the tab
      // stuck showing whatever was cached at install time.
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });

      window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js").then(
          function (registration) {
            console.log("Service Worker registration successful with scope: ", registration.scope);
          },
          function (err) {
            console.log("Service Worker registration failed: ", err);
          }
        );
      });
    }
  }, []);

  return null;
}
