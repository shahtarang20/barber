"use client";

import { useEffect } from "react";
import { Cake } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Celebration } from "@/components/catalogue/Celebration";
import { haptic, HAPTIC } from "@/lib/haptics";

/**
 * The customer's birthday moment on the "booking confirmed" screen — a warm, premium card that themes itself to the
 * shop's own brand (via the --t-* tokens, like LoyaltyCardPublic), topped with a one-shot confetti/flower burst. Shown
 * only when the booking response says it is the customer's birthday today.
 */
export function BirthdayGreeting({ name }: { name: string }) {
  const { t } = useTranslation();
  const title = t("catBirthdayTitle").replace("{name}", name.trim() || "🎉");
  // A little fanfare buzz as the greeting appears (silent where the browser has no vibration / reduced motion).
  useEffect(() => { haptic(HAPTIC.celebrate); }, []);

  return (
    <div
      className="bg-card relative mb-6 overflow-hidden rounded-2xl border text-left shadow-sm"
      style={{ background: "var(--t-card, #ffffff)", borderColor: "var(--t-card-line, #e4e4e7)", color: "var(--t-card-ink, #18181b)" }}
    >
      <style>{BG_CSS}</style>
      <Celebration run={true} />

      {/* Brand-gradient top band */}
      <div className="h-1.5 w-full" style={{ background: "var(--t-btn-bg, #4f46e5)" }} aria-hidden="true" />

      <div className="flex items-start gap-3 px-4 py-5">
        <span
          className="bg-badge flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm"
          style={{ background: "var(--t-btn-bg, #4f46e5)", color: "var(--t-btn-ink, #ffffff)" }}
          aria-hidden="true"
        >
          <Cake className="bg-wiggle h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-bold leading-snug" style={{ color: "var(--t-card-ink, #18181b)" }}>{title}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--t-card-muted, #52525b)" }}>{t("catBirthdaySub")}</p>
        </div>
      </div>
    </div>
  );
}

const BG_CSS = `
@keyframes bg-rise { 0% { transform: translateY(8px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
.bg-card { animation: bg-rise .5s cubic-bezier(.3,.8,.3,1) both }
@keyframes bg-pop { 0% { transform: scale(.6); opacity: 0 } 60% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
.bg-badge { animation: bg-pop .5s cubic-bezier(.3,.8,.3,1) .1s both }
@keyframes bg-wiggle { 0%,88%,100% { transform: rotate(0) } 91% { transform: rotate(-12deg) } 95% { transform: rotate(12deg) } }
.bg-wiggle { animation: bg-wiggle 2.4s ease-in-out .6s infinite }
@media (prefers-reduced-motion: reduce) { .bg-card, .bg-badge, .bg-wiggle { animation: none } }
`;
