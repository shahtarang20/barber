"use client";

import { useEffect, useState } from "react";

/**
 * One shared place that remembers the browser's "this site can be installed" signal, so the small banner and the
 * install card on the booking-confirmed screen both work no matter which one the customer sees first.
 */
type Prompt = { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: Prompt | null = null;
let installed = false;
let cardShown = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

let started = false;
/** Starts listening once, as early as possible (called from the root layout). */
export function captureInstallEvents() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as unknown as Prompt; notify(); });
  window.addEventListener("appinstalled", () => { installed = true; deferred = null; notify(); });
}

/** The install card on the confirmation screen tells the banner to stay out of the way. */
export function setInstallCardShown(v: boolean) { cardShown = v; notify(); }

export function isStandaloneNow(): boolean {
  if (typeof window === "undefined") return false;
  // @ts-expect-error iOS Safari only
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    captureInstallEvents();
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  return {
    standalone: installed || isStandaloneNow(),
    isIOS,
    canPromptNatively: !!deferred,
    cardShown,
    /** Opens the browser's own install dialog. Returns false when the browser can't (iPhone, or not ready), so the caller shows steps. */
    install: async (): Promise<boolean> => {
      if (!deferred) return false;
      const d = deferred;
      await d.prompt();
      const { outcome } = await d.userChoice;
      if (outcome === "accepted") installed = true;
      deferred = null;
      notify();
      return true;
    },
  };
}
