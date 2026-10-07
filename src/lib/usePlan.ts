"use client";

import useSWR from "swr";
import { useI18nStore } from "@/lib/i18n";
import { formatInLanguage } from "@/lib/dateLocale";

export interface PlanPaymentRow { _id: string; amount: number; months: number; method: string; periodStart: string; periodEnd: string; createdAt: string }
export interface BarberPlan {
  status: "FREE" | "ACTIVE" | "GRACE" | "EXPIRED";
  tier: "FREE" | "PREMIUM" | "BUSINESS"; paidTier: "FREE" | "PREMIUM" | "BUSINESS";
  amount: number; endsOn: string | null; graceEndsOn: string | null; daysLeft: number | null; estimated: boolean; reminder: boolean; granted: boolean; graceDays: number;
  payments: PlanPaymentRow[];
}

/** "2026-11-05" → "5 Nov 2026" (the date is already an IST calendar date, so no time zone is applied). */
export const showDate = (d: string | null | undefined) => {
  if (!d) return "";
  const lang = useI18nStore.getState().language;
  // Month names in the language the owner chose (Intl's own English short names, like "Sept", would stay English).
  if (lang !== "en") return formatInLanguage(new Date(`${d}T00:00:00`), "d MMM yyyy", lang);
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

const fetcher = (url: string) => fetch(url).then(async (r) => { const j = await r.json().catch(() => null); if (!r.ok || !j?.success) throw new Error("plan"); return j.data as BarberPlan; });

/** The signed-in barber's plan, refreshed when the tab regains focus. */
export function usePlan() {
  return useSWR<BarberPlan>("/api/barber/plan", fetcher, { revalidateOnFocus: true, dedupingInterval: 60_000 });
}
