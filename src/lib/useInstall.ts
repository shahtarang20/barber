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
  // The browser may have sent its signal before this code started: the tiny script in the page head kept it.
  const early = (window as unknown as { __installEvent?: Prompt }).__installEvent;
  if (early) deferred = early;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as unknown as Prompt; notify(); });
  window.addEventListener("appinstalled", () => { installed = true; deferred = null; notify(); });
}

/** Resolves as soon as the browser's install signal is available, or after `ms`. */
function waitForSignal(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (deferred) return resolve();
    const done = () => { clearTimeout(timer); listeners.delete(check); resolve(); };
    const check = () => { if (deferred) done(); };
    const timer = setTimeout(done, ms);
    listeners.add(check);
  });
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
    /**
     * Opens the browser's own install dialog. Returns false when the browser can't, so the caller shows the manual steps.
     * If the browser has not sent its "installable" signal yet (slow phone, first visit) it waits up to 2.5 s for it.
     * iPhones never send one, so they go straight to the steps.
     */
    install: async (): Promise<boolean> => {
      if (!deferred && !isIOS) await waitForSignal(2500);
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
