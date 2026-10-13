"use client";

import { useState } from "react";
import useSWR from "swr";
import { Gift, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { listLoyaltyRewards, redeemLoyaltyReward, type CatalogueScope } from "@/lib/loyaltyClient";

/** First letter of a customer's name (or phone) for the avatar; falls back to a dot. */
function initial(name: string, phone: string): string {
  const s = (name.trim() || phone.trim());
  return s ? Array.from(s)[0].toLocaleUpperCase() : "•";
}

/** The coupons this catalogue has issued, newest first, with a one-tap "Redeem" for any that is still live. */
export function LoyaltyRewards({ scope }: { scope: CatalogueScope }) {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR(["loyalty-rewards", scope], () => listLoyaltyRewards(scope));
  const [busyId, setBusyId] = useState<string | null>(null);

  if (isLoading || !data) return <p className="text-sm text-zinc-400">{t("ownCatLoading")}</p>;
  const rewards = data.rewards;

  if (rewards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-zinc-700">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800"><Gift className="h-5 w-5" /></span>
        <p className="text-sm text-zinc-500">{t("ownLoyaltyNoRewards")}</p>
      </div>
    );
  }

  const redeem = async (id: string) => {
    setBusyId(id);
    try {
      await redeemLoyaltyReward(scope, id);
      await mutate();
    } catch (err) {
      toast.add({ title: t("ownCouldNotSave"), description: (err as Error).message, type: "error" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {rewards.map((r) => {
        const redeemed = r.status !== "ACTIVE";
        return (
          <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${redeemed ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800" : "bg-indigo-600 text-white"}`} aria-hidden="true">
              {initial(r.customerName, r.customerPhone)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium leading-snug">{r.customerName || r.customerPhone || "—"}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400"><Gift className="h-3.5 w-3.5" />{r.label}</span>
                {r.customerPhone && <span>· {r.customerPhone}</span>}
              </p>
            </div>
            {redeemed ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <Check className="h-3.5 w-3.5" /> {t("ownLoyaltyRedeemed")}
              </span>
            ) : (
              <Button className="h-11 shrink-0" disabled={busyId === r.id} onClick={() => redeem(r.id)}>{t("ownLoyaltyRedeem")}</Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
