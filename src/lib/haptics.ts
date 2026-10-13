"use client";

/**
 * Soft haptic feedback for the celebratory customer moments (wheel, birthday, loyalty, membership).
 * Works only where the browser allows it — Android Chrome and some Android browsers; iOS Safari has no Vibration API,
 * so it quietly does nothing there. Never throws, and stays silent when the viewer prefers reduced motion.
 */
function allowed(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  try {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  } catch { /* matchMedia can throw in rare sandboxes */ }
  return true;
}

export function haptic(pattern: number | number[]): void {
  if (!allowed()) return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}

/** Ready-made feels, kept gentle on purpose. */
export const HAPTIC = {
  tick: 8,                       // a single light tick (wheel passing a peg)
  soft: 16,                      // a soft tap (card appears)
  success: [22, 40, 30] as number[],         // a short happy buzz (reward earned)
  celebrate: [30, 50, 30, 50, 70] as number[], // a little fanfare (birthday / big win)
};

/** Stops any ongoing vibration. */
export function hapticStop(): void {
  if (allowed()) { try { navigator.vibrate(0); } catch { /* ignore */ } }
}
