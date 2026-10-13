"use client";

import { useEffect } from "react";
import { BadgeCheck } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { haptic, HAPTIC } from "@/lib/haptics";

/**
 * Shown on the "booking confirmed" screen when the customer's membership covered this visit: a premium, reassuring banner
 * that slides in with a soft haptic tap. Themed to the shop via the --t-* tokens, with a quiet shine sweep.
 */
export function MembershipCovered({ planName, remaining = -1 }: { planName: string; remaining?: number }) {
  const { t } = useTranslation();
  useEffect(() => { haptic(HAPTIC.soft); }, []);
  const left = remaining < 0 ? t("catMemberUnlimited") : t("catMemberVisitsLeft").replace("{n}", String(remaining));

  return (
    <div
      className="mc-in relative mb-4 flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3"
      style={{ background: "var(--t-btn-bg, #059669)", color: "var(--t-btn-ink, #ffffff)" }}
    >
      <style>{MC_CSS}</style>
      <BadgeCheck className="h-7 w-7 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">{t("catMemberCovered").replace("{plan}", planName)}</p>
        <p className="mt-0.5 text-xs font-medium opacity-90">{left}</p>
      </div>
    </div>
  );
}

const MC_CSS = `
@keyframes mc-in { 0% { transform: translateY(10px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
.mc-in { animation: mc-in .45s cubic-bezier(.3,.8,.3,1) both }
.mc-in::after { content: ""; position: absolute; inset: 0 auto 0 0; width: 40%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent); transform: translateX(-120%); animation: mc-shine 2.8s ease-in-out .4s infinite }
@keyframes mc-shine { to { transform: translateX(260%) } }
@media (prefers-reduced-motion: reduce) { .mc-in, .mc-in::after { animation: none } .mc-in::after { display: none } }
`;
