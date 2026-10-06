"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { showDate, usePlan, type BarberPlan } from "@/lib/usePlan";

const MAX_PER_DAY = 3;
const dayKey = () => `plan_reminder_${new Date().toISOString().slice(0, 10)}`;

/**
 * A slim, dismissible renewal notice at the top of the dashboard. It never covers the screen or blocks an action.
 * Before the plan ends and during the grace period it appears at most three times a day; after the plan has ended it
 * stays as a quiet one-line notice, because the catalogue is already reduced.
 */
export function PlanBanner() {
  const { data: plan } = usePlan();
  return plan?.reminder && plan.status !== "FREE" ? <Notice plan={plan} /> : null;
}

/** Counts this showing against today's limit when it first appears (it only mounts when a reminder applies). */
function Notice({ plan }: { plan: BarberPlan }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => {
    if (plan.status === "EXPIRED") return true;
    try {
      const shown = Number(localStorage.getItem(dayKey()) || "0");
      if (shown >= MAX_PER_DAY) return false;
      localStorage.setItem(dayKey(), String(shown + 1));
    } catch { /* storage blocked: just show it */ }
    return true;
  });
  if (!visible) return null;
  const message = plan.status === "EXPIRED" ? t("planEnded")
    : plan.status === "GRACE" ? t("planInGrace").replace("{date}", showDate(plan.endsOn)).replace("{grace}", showDate(plan.graceEndsOn))
    : plan.daysLeft === 0 ? t("planToday")
    : t("planSoon").replace("{n}", String(plan.daysLeft)).replace("{date}", showDate(plan.endsOn));
  const tone = plan.status === "ACTIVE" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-red-300 bg-red-50 text-red-900";
  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <p className="flex-1">{message} <Link href="/dashboard/settings" className="font-semibold underline">{t("planTitle")}</Link></p>
      <button type="button" onClick={() => setVisible(false)} aria-label={t("planDismiss")} className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"><X className="h-4 w-4" /></button>
    </div>
  );
}
