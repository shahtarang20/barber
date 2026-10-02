"use client";

import { useEffect } from "react";
import { captureInstallEvents } from "@/lib/useInstall";

export function PWARegister() {
  useEffect(() => {
    captureInstallEvents(); // remember "this can be installed" even if it fires before the install banner is on screen
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // A NEW version of the service worker taking control means a new version of the app was deployed:
      // reload once to pick it up. On the very first visit there was no earlier version, so the worker
      // taking control is not an update, and reloading then would wipe whatever the customer has typed.
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || reloaded) return;
        reloaded = true;
        window.location.reload();
      });

      const register = () => {
        navigator.serviceWorker.register("/sw.js").then(
          function (registration) {
            console.log("Service Worker registration successful with scope: ", registration.scope);
          },
          function (err) {
            console.log("Service Worker registration failed: ", err);
          }
        );
      };
      // On a slow phone this may run after the page's "load" event already happened; waiting for it would never register.
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register);
    }
  }, []);

  return null;
}
