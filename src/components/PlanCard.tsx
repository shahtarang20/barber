"use client";

import { useTranslation } from "@/lib/i18n";
import { showDate, usePlan } from "@/lib/usePlan";

const BADGE: Record<string, string> = {
  FREE: "bg-zinc-100 text-zinc-700", ACTIVE: "bg-green-100 text-green-800", GRACE: "bg-amber-100 text-amber-800", EXPIRED: "bg-red-100 text-red-800",
};

/** Settings: the barber's plan, its end date, what to do to renew, and the payments the admin recorded. */
export function PlanCard({ dueDay }: { dueDay: number }) {
  const { t } = useTranslation();
  const { data: plan, error } = usePlan();
  if (error) return null;
  if (!plan) return <div className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" aria-hidden="true" />;
  const label = plan.status === "FREE" ? t("planFree") : plan.status === "ACTIVE" ? t("planActive") : plan.status === "GRACE" ? t("planGrace") : t("planExpired");
  return (
    <section aria-labelledby="plan-title" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id="plan-title" className="text-sm font-medium">{t("setPremium")}</h3>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">₹{plan.amount} / month</span>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${BADGE[plan.status]}`}>{plan.paidTier !== "FREE" ? `${plan.paidTier[0]}${plan.paidTier.slice(1).toLowerCase()} · ` : ""}{label}</span>
      </div>
      {plan.status === "FREE" ? <p className="text-xs text-zinc-500">{t("setSetByAdmin")}</p> : (
        <>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {plan.granted ? t("planGranted").replace("{date}", showDate(plan.endsOn)) : plan.estimated ? t("planRenewsDay").replace("{day}", String(dueDay)) : t("planEndsOn").replace("{date}", showDate(plan.endsOn))}
            {plan.status === "GRACE" && ` · ${t("planGrace")}: ${showDate(plan.graceEndsOn)}`}
          </p>
          {plan.reminder && <p className="text-xs text-zinc-500">{t("planHowRenew")}</p>}
        </>
      )}
      {plan.paidTier !== "FREE" && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("planHistory")}</h4>
          {plan.payments.length === 0 ? <p className="text-xs text-zinc-500">{t("planNoPayments")}</p> : (
            <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {plan.payments.map((p) => (
                <li key={p._id} className="flex flex-wrap justify-between gap-x-4 py-1.5">
                  <span>{showDate(p.periodStart)} – {showDate(p.periodEnd)} · {t("planMonths").replace("{n}", String(p.months))}</span>
                  <span className="font-medium">{p.method === "COMPLIMENTARY" ? "Free" : `₹${p.amount}`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
