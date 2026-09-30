"use client";

import { useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useDateFormat } from "@/lib/dateLocale";
import { parseDateOnly } from "@/lib/timeSort";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ShopCustomer { _id: string; name: string; phone: string; visits: number; upcoming: number; lastVisit: string | null; barberCount: number; barbers: string[] }

/** The shop owner's list of every customer across all the shop's barbers (private notes are not shown). */
export function ShopCustomers() {
  const { t } = useTranslation();
  const fmt = useDateFormat();
  const [search, setSearch] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [limit, setLimit] = useState(20);
  const { data } = useSWR(`/api/barber/shop/customers?limit=${limit}&search=${encodeURIComponent(search)}${repeat ? "&repeat=1" : ""}`, fetcher, { keepPreviousData: true });
  const rows: ShopCustomer[] = data?.success ? data.data : [];
  const total: number = data?.success ? data.pagination.total : 0;

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("shopCustomersTitle")}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t("shopCustomersDesc")}</p>
      </div>
      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setLimit(20); }}
        placeholder={t("shopSearchCustomers")}
        className="w-full h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 text-sm"
      />
      <label className="flex items-center gap-3 min-h-11 cursor-pointer">
        <input type="checkbox" className="w-6 h-6" checked={repeat} onChange={(e) => { setRepeat(e.target.checked); setLimit(20); }} />
        <span className="text-sm text-zinc-700 dark:text-zinc-300">{t("shopRepeatOnly")}</span>
      </label>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("shopNoCustomers")}</p>
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((c) => (
            <div key={c._id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-zinc-900 dark:text-zinc-100 break-words">{c.name}</p>
                <p className="text-sm text-zinc-500">{c.phone || t("custNoPhone")}</p>
                <p className="text-xs text-zinc-500 mt-1">{t("shopSeenBy").replace("{names}", c.barbers.join(", "))}</p>
              </div>
              <div className="text-right shrink-0">
                {c.barberCount >= 2 && <span className="inline-block mb-1 px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{c.barberCount} ×</span>}
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{c.visits} {c.visits === 1 ? t("visit") : t("visits")} · {t("shopBookedCount").replace("{u}", String(c.upcoming))}</p>
                {c.lastVisit && <p className="text-xs text-zinc-500">{fmt(parseDateOnly(c.lastVisit), "d MMM yyyy")}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {rows.length < total && <Button variant="outline" className="w-full" onClick={() => setLimit(limit + 20)}>{t("shopLoadMore")} ({rows.length}/{total})</Button>}
    </div>
  );
}
