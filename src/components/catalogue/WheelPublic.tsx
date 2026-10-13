"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Gift } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Celebration } from "@/components/catalogue/Celebration";
import { haptic, HAPTIC, hapticStop } from "@/lib/haptics";

const SPIN_MS = 4100;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

export interface PublicWheel {
  segments: { label: string; win: boolean }[];
  winningIndex: number;
  won: boolean;
  rewardLabel: string | null;
}

// A festive, theme-independent wheel palette (prize wheels are colourful by nature); text stays white for contrast.
const SLICE_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

const WHEEL_CSS = `
@keyframes wheel-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,.0), 0 8px 30px rgba(0,0,0,.25); } 50% { box-shadow: 0 0 36px 4px var(--t-accent-text, #4f46e5), 0 8px 30px rgba(0,0,0,.25); } }
.wheel-glow { animation: wheel-glow 1.1s ease-in-out infinite; }
@keyframes won-pop { 0% { transform: scale(.6); opacity: 0; } 55% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
.won-pop { animation: won-pop .5s cubic-bezier(.3,.9,.3,1.2) both; }
@media (prefers-reduced-motion: reduce) { .wheel-glow, .won-pop { animation: none; } }
`;
const R = 130; // wheel radius in the SVG's own units
const CX = 150;
const CY = 150;

/** One pie-slice path from the centre, covering [a0, a1] degrees (0 = top, clockwise). */
function slicePath(a0: number, a1: number): string {
  const p = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [CX + R * Math.cos(rad), CY + R * Math.sin(rad)];
  };
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
}

/**
 * The spin-to-win wheel on the "booking confirmed" screen. The outcome is already decided and saved on the server
 * (see wheel.ts); this only animates to it, then celebrates a win with confetti and shows the prize to claim at the shop.
 */
export function WheelPublic({ wheel }: { wheel: PublicWheel }) {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "spinning" | "done">("idle");
  const timers = useRef<number[]>([]);
  const segs = wheel.segments;
  const n = Math.max(1, segs.length);
  const step = 360 / n;

  // Rotation that brings the winning slice's centre under the top pointer, after several dramatic turns.
  const centerAngle = wheel.winningIndex * step + step / 2;
  const finalRotation = 360 * 5 + (360 - centerAngle);

  useEffect(() => () => { timers.current.forEach(clearTimeout); hapticStop(); }, []);

  const spin = () => {
    if (state !== "idle") return;
    setState("spinning");
    // A light tick each time a peg passes the pointer — the gaps grow as the wheel slows, so it *feels* like it's winding down.
    const TICKS = 26;
    for (let i = 0; i < TICKS; i++) {
      const at = easeOut(i / TICKS) * (SPIN_MS - 150);
      timers.current.push(window.setTimeout(() => haptic(HAPTIC.tick), at));
    }
    timers.current.push(window.setTimeout(() => {
      setState("done");
      haptic(wheel.won ? HAPTIC.celebrate : HAPTIC.soft); // a happy buzz lands with the result
    }, SPIN_MS + 120));
  };

  return (
    <div
      className="mb-6 overflow-hidden rounded-2xl border p-4 text-center shadow-sm"
      style={{ background: "var(--t-card, #ffffff)", borderColor: "var(--t-card-line, #e4e4e7)", color: "var(--t-card-ink, #18181b)" }}
    >
      <Celebration run={state === "done" && wheel.won} />
      <style>{WHEEL_CSS}</style>

      <div className="flex items-center justify-center gap-2">
        <Sparkles className="h-5 w-5" style={{ color: "var(--t-accent-text, #4f46e5)" }} aria-hidden="true" />
        <p className="text-[15px] font-semibold">{t("catWheelTitle")}</p>
      </div>
      <p className="mt-0.5 text-xs" style={{ color: "var(--t-card-muted, #71717a)" }}>{t("catWheelSub")}</p>

      <div className={`relative mx-auto mt-4 ${state === "spinning" ? "wheel-glow" : ""}`} style={{ width: 300, maxWidth: "100%", aspectRatio: "1 / 1", borderRadius: "50%" }}>
        {/* pointer */}
        <div
          className="absolute left-1/2 top-0 z-10 -translate-x-1/2"
          style={{ width: 0, height: 0, borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderTop: "18px solid var(--t-accent-text, #4f46e5)" }}
          aria-hidden="true"
        />
        <svg
          viewBox="0 0 300 300"
          className="h-auto w-full"
          style={{
            transform: `rotate(${state === "idle" ? 0 : finalRotation}deg)`,
            transition: state === "idle" ? "none" : "transform 4.1s cubic-bezier(.17,.67,.2,1)",
          }}
          role="img"
          aria-label={t("catWheelTitle")}
        >
          <circle cx={CX} cy={CY} r={R + 6} fill="var(--t-card-line, #e4e4e7)" />
          {segs.map((s, i) => {
            const a0 = i * step;
            const a1 = (i + 1) * step;
            const mid = ((a0 + a1) / 2 - 90) * (Math.PI / 180);
            const tx = CX + R * 0.62 * Math.cos(mid);
            const ty = CY + R * 0.62 * Math.sin(mid);
            return (
              <g key={i}>
                <path d={slicePath(a0, a1)} fill={SLICE_COLORS[i % SLICE_COLORS.length]} stroke="rgba(255,255,255,.7)" strokeWidth={1.5} />
                <text
                  x={tx} y={ty} fill="#ffffff" fontSize={n > 6 ? 11 : 13} fontWeight={700} textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${(a0 + a1) / 2}, ${tx}, ${ty})`}
                  style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,.25)", strokeWidth: 2 }}
                >
                  {s.label.length > 14 ? s.label.slice(0, 13) + "…" : s.label}
                </text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={16} fill="#ffffff" stroke="var(--t-card-line, #d4d4d8)" strokeWidth={2} />
        </svg>
      </div>

      <div className="mt-4 min-h-12">
        {state === "done" ? (
          wheel.won ? (
            <div className="won-pop inline-flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: "var(--t-btn-bg, #4f46e5)", color: "var(--t-btn-ink, #ffffff)" }}>
              <Gift className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="text-sm font-bold">{t("catWheelWon").replace("{reward}", wheel.rewardLabel || "")}</span>
            </div>
          ) : (
            <p className="text-sm font-medium" style={{ color: "var(--t-card-muted, #52525b)" }}>{t("catWheelLost")}</p>
          )
        ) : (
          <button
            type="button"
            onClick={spin}
            disabled={state === "spinning"}
            className="inline-flex h-12 min-w-40 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold shadow-sm transition active:scale-95 disabled:opacity-70"
            style={{ background: "var(--t-btn-bg, #4f46e5)", color: "var(--t-btn-ink, #ffffff)" }}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {state === "spinning" ? t("catWheelSpinning") : t("catWheelSpin")}
          </button>
        )}
      </div>
    </div>
  );
}
