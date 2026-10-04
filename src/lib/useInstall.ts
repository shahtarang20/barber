"use client";

import { useEffect, useState } from "react";

/**
 * Everything about "installing the app", in one place, so the small banner and the install card on the
 * booking-confirmed screen always agree:
 *  - remembers the browser's "this can be installed" signal (it can arrive before the screens are ready),
 *  - knows whether THIS barber's / shop's app is already installed (the browser's own answer where the phone
 *    can give one, otherwise a remembered flag), so we keep asking until it really is,
 *  - opens the browser's install dialog, and never leaves the customer with a dead button.
 */
type Prompt = { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: Prompt | null = null;
let installedThisSession = false;
let cardShown = false;
let currentKey = "app";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const FLAG_DAYS = 14; // a remembered "installed" is trusted this long where the phone cannot tell us itself (the app may be deleted later)
const flagName = (key: string) => `app-installed:${key}`;
/** How long ago we saw this app being installed, or null. */
function flagAgeMs(key: string): number | null {
  try {
    const at = Number(localStorage.getItem(flagName(key)) || 0);
    return at > 0 ? Date.now() - at : null;
  } catch { return null; }
}
function readFlag(key: string): boolean {
  const age = flagAgeMs(key);
  return age !== null && age < FLAG_DAYS * 86_400_000;
}
// Right after an install the browser's own answer can lag behind: trust a fresh install for a day, then let the browser decide.
function installedJustNow(key: string): boolean {
  const age = flagAgeMs(key);
  return age !== null && age < 86_400_000;
}
export function markInstalled(key: string) {
  try { localStorage.setItem(flagName(key), String(Date.now())); } catch {}
}

/** Each barber's and each shop's page is its own app: "b:raju-cutz", "s:royal-cuts", or "dashboard" for the barber app. */
function keyFromPath(): string {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if ((parts[0] === "b" || parts[0] === "s") && parts[1]) return `${parts[0]}:${parts[1]}`;
  return parts[0] === "dashboard" ? "dashboard" : "app";
}

let started = false;
/** Starts listening once, as early as possible (called from the root layout). */
export function captureInstallEvents() {
  if (started || typeof window === "undefined") return;
  started = true;
  // The browser may have sent its signal before this code started: the tiny script in the page head kept it.
  const early = (window as unknown as { __installEvent?: Prompt }).__installEvent;
  if (early) deferred = early;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as unknown as Prompt; notify(); });
  window.addEventListener("appinstalled", () => { installedThisSession = true; deferred = null; markInstalled(currentKey); notify(); });
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

export type InstallResult = "accepted" | "dismissed" | "unavailable";

export function useInstall() {
  const [, force] = useState(0);
  const [known, setKnown] = useState<{ ready: boolean; installed: boolean }>({ ready: false, installed: false });

  useEffect(() => {
    captureInstallEvents();
    const key = keyFromPath();
    currentKey = key;
    const l = () => force((n) => n + 1);
    listeners.add(l);
    let alive = true;
    const settle = (installed: boolean) => { if (alive) setKnown({ ready: true, installed }); };

    if (isStandaloneNow()) { markInstalled(key); settle(true); }
    else {
      const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
      // Only the customer pages (b:..., s:...) list themselves in their manifest, so only there is the browser's answer meaningful.
      if (typeof nav.getInstalledRelatedApps === "function" && (key.startsWith("b:") || key.startsWith("s:"))) {
        // Chrome on Android can say for sure whether this app is installed (the manifests list themselves for this).
        let answered = false;
        nav.getInstalledRelatedApps().then((apps) => { answered = true; settle(apps.length > 0 || installedJustNow(key)); }).catch(() => { answered = true; settle(readFlag(key)); });
        setTimeout(() => { if (!answered) settle(readFlag(key)); }, 1500); // never keep the customer waiting on it
      } else {
        settle(readFlag(key)); // phones that cannot tell: trust what we remembered
      }
    }
    return () => { alive = false; listeners.delete(l); };
  }, []);

  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  // A page opened inside WhatsApp, Instagram, Facebook... (a "web view") cannot be installed from there; it must be opened in Chrome first.
  const inApp = /; wv\)|fban|fbav|instagram|whatsapp|line\/|snapchat|twitter|micromessenger|musical_ly/.test(ua);
  return {
    isInApp: inApp,
    /** Already installed (or running as the installed app): nothing more to ask. */
    standalone: installedThisSession || known.installed || isStandaloneNow(),
    /** False until we know whether it is installed, so an installed customer never sees a flash of the prompt. */
    ready: known.ready,
    isIOS,
    cardShown,
    /**
     * Opens the browser's own install dialog.
     *  "accepted"    the customer said yes (the phone now adds it to the home screen),
     *  "dismissed"   the customer closed the browser's dialog,
     *  "unavailable" this browser cannot (iPhone, in-app browser, old phone, or it refused): show the manual steps.
     * If the browser has not sent its signal yet (slow phone, first visit) this waits up to 2.5 s for it.
     */
    install: async (): Promise<InstallResult> => {
      if (!deferred && !isIOS && !inApp) await waitForSignal(2500);
      if (!deferred) return "unavailable";
      const d = deferred;
      deferred = null; // the browser lets each signal be used once
      try {
        await d.prompt();
        const { outcome } = await d.userChoice;
        if (outcome === "accepted") { installedThisSession = true; markInstalled(currentKey); notify(); return "accepted"; }
        notify();
        return "dismissed";
      } catch {
        notify();
        return "unavailable";
      }
    },
  };
}

/** Which manual-steps message fits this phone. */
export function stepsKey(isIOS: boolean, isInApp: boolean): "installStepsIOS" | "installStepsInApp" | "installStepsAndroid" {
  if (isInApp) return "installStepsInApp";
  return isIOS ? "installStepsIOS" : "installStepsAndroid";
}
