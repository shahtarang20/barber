"use client";

import { useEffect, useRef } from "react";
import { Gift, Scissors, Sparkles, Check } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { haptic, HAPTIC, hapticStop } from "@/lib/haptics";

/** The loyalty state the public booking response carries (computed server-side; see loyaltyForCustomer). */
export interface PublicLoyalty {
  stamps: number;
  stampsNeeded: number;
  rewardName: string;
  activeRewards: { id: string; label: string; expiresOn: string }[];
}

/**
 * The customer's loyalty punch-card on the "booking confirmed" screen — a premium, eye-catching card that themes itself
 * to the shop's own style and brand colour (via the --t-* tokens), so it looks made-for-this-shop, never generic.
 *  - a brand-gradient header badge + a live "X / N" counter chip,
 *  - a row of stamps: filled ones carry a scissors mark in the brand colour, the newest one pops in,
 *  - a slim progress bar and a "N more for <reward>" nudge,
 *  - when a reward is won: a celebratory brand-gradient banner with a shine sweep.
 */
export function LoyaltyCardPublic({ loyalty }: { loyalty: PublicLoyalty }) {
  const { t } = useTranslation();
  const stampsNeeded = Math.max(1, loyalty.stampsNeeded);
  const stamps = Math.max(0, Math.min(loyalty.stamps, stampsNeeded));
  const remaining = Math.max(0, stampsNeeded - stamps);
  const pct = Math.round((stamps / stampsNeeded) * 100);
  const earned = loyalty.activeRewards.length > 0;
  const progressLabel = t("catLoyaltyProgress").replace("{have}", String(stamps)).replace("{need}", String(stampsNeeded));

  // As the stamps animate in one by one, give each a soft tick; finish with a happy buzz if a reward is waiting.
  const timers = useRef<number[]>([]);
  useEffect(() => {
    for (let i = 0; i < stamps; i++) timers.current.push(window.setTimeout(() => haptic(HAPTIC.tick), 120 + i * 90));
    if (earned) timers.current.push(window.setTimeout(() => haptic(HAPTIC.success), 140 + stamps * 90));
    const list = timers.current;
    return () => { list.forEach(clearTimeout); hapticStop(); };
  }, [stamps, earned]);

  return (
    <div
      className="lc-card mb-6 overflow-hidden rounded-2xl border text-left shadow-sm"
      style={{ background: "var(--t-card, #ffffff)", borderColor: "var(--t-card-line, #e4e4e7)", color: "var(--t-card-ink, #18181b)" }}
    >
      <style>{LC_CSS}</style>

      {/* Header: brand badge + title + live counter */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm"
          style={{ background: "var(--t-btn-bg, #4f46e5)", color: "var(--t-btn-ink, #ffffff)" }}
          aria-hidden="true"
        >
          <Gift className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold" style={{ color: "var(--t-card-ink, #18181b)" }}>{t("catLoyaltyTitle")}</p>
          <p className="truncate text-xs" style={{ color: "var(--t-card-muted, #71717a)" }}>{progressLabel}</p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
          style={{ background: "var(--t-surface2, #f4f4f5)", color: "var(--t-accent-text, #4f46e5)" }}
          aria-hidden="true"
        >
          {stamps}/{stampsNeeded}
        </span>
      </div>

      {/* Stamp row */}
      <div className="flex flex-wrap gap-2 px-4 pt-4" role="img" aria-label={progressLabel}>
        {Array.from({ length: stampsNeeded }).map((_, i) => {
          const filled = i < stamps;
          const isNewest = filled && i === stamps - 1;
          return (
            <span
              key={i}
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition-transform ${filled ? (isNewest ? "lc-pop" : "lc-in") : ""}`}
              style={
                filled
                  ? { background: "var(--t-btn-bg, #4f46e5)", borderColor: "transparent", color: "var(--t-btn-ink, #ffffff)", boxShadow: "0 2px 6px rgba(0,0,0,.18)", animationDelay: `${i * 0.09}s` }
                  : { background: "transparent", borderColor: "var(--t-card-line, #d4d4d8)", borderStyle: "dashed", color: "var(--t-card-muted, #a1a1aa)" }
              }
              aria-hidden="true"
            >
              {filled ? <Scissors className="h-4 w-4" /> : <span className="text-[11px] font-semibold tabular-nums">{i + 1}</span>}
            </span>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-4">
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--t-surface2, #e4e4e7)" }}>
          <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: "var(--t-btn-bg, #4f46e5)" }} />
        </div>
      </div>

      {/* Nudge or celebration */}
      <div className="px-4 pb-4 pt-3">
        {earned ? (
          <div
            className="lc-shine relative overflow-hidden rounded-xl px-4 py-3"
            style={{ background: "var(--t-btn-bg, #4f46e5)", color: "var(--t-btn-ink, #ffffff)" }}
          >
            <div className="relative z-10 flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                {loyalty.activeRewards.map((r) => (
                  <p key={r.id} className="text-sm font-bold leading-snug">{t("catLoyaltyEarned").replace("{reward}", r.label)}</p>
                ))}
              </div>
            </div>
          </div>
        ) : remaining > 0 ? (
          (() => {
            // The template reads "{n} more for {reward}"; split on the reward placeholder so the reward name can be emphasised.
            const [before, after = ""] = t("catLoyaltyMore").replace("{n}", String(remaining)).split("{reward}");
            return (
              <p className="flex items-center gap-1.5 text-sm" style={{ color: "var(--t-card-muted, #52525b)" }}>
                <Check className="h-4 w-4 shrink-0" style={{ color: "var(--t-accent-text, #4f46e5)" }} aria-hidden="true" />
                <span>
                  {before}
                  <span className="font-semibold" style={{ color: "var(--t-accent-text, #4f46e5)" }}>{loyalty.rewardName}</span>
                  {after}
                </span>
              </p>
            );
          })()
        ) : null}
      </div>
    </div>
  );
}

const LC_CSS = `
@keyframes lc-pop { 0% { transform: scale(.5); opacity: 0 } 60% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
.lc-pop { animation: lc-pop .45s cubic-bezier(.3,.8,.3,1) both }
@keyframes lc-in { 0% { transform: scale(.4); opacity: 0 } 70% { transform: scale(1.1) } 100% { transform: scale(1); opacity: 1 } }
.lc-in { animation: lc-in .4s cubic-bezier(.3,.8,.3,1) both }
@keyframes lc-shine { 0% { transform: translateX(-120%) } 100% { transform: translateX(220%) } }
.lc-shine::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 40%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent); transform: translateX(-120%); animation: lc-shine 2.6s ease-in-out .3s infinite }
@media (prefers-reduced-motion: reduce) { .lc-pop, .lc-in { animation: none } .lc-shine::after { animation: none; display: none } }
`;
