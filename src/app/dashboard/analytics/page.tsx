"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Lock } from "lucide-react";
import { ScopeSwitch } from "@/components/catalogue/owner/ScopeSwitch";
import { useShopOwnership, withScope } from "@/lib/catalogueClient";
import { useCatalogueScope } from "@/lib/useCatalogueScope";
import { showDate } from "@/lib/usePlan";
import type { Analytics } from "@/lib/analytics";

const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6";
const fetcher = (url: string) => fetch(url).then(async (r) => { const j = await r.json().catch(() => null); if (!r.ok || !j?.success) throw new Error(j?.error?.message || "Could not load"); return j.data as Analytics; });
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const rupees = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"><p className="text-xs text-zinc-500">{label}</p><p className="text-2xl font-bold">{value}</p>{hint && <p className="text-xs text-zinc-500">{hint}</p>}</div>;
}
function Bars({ rows, label }: { rows: { key: string; label: string; value: number; note?: string }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul aria-label={label} className="space-y-2">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex justify-between gap-2 text-sm"><span className="truncate">{r.label}</span><span className="shrink-0 text-zinc-500">{r.value}{r.note ? ` · ${r.note}` : ""}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden="true"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default function AnalyticsPage() {
  const { canViewShopNumbers, shop } = useShopOwnership();
  const [scope, setScope] = useCatalogueScope(canViewShopNumbers);
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const { data, error } = useSWR<Analytics>(`${withScope("/api/barber/analytics", scope)}&range=${range}`, fetcher);
  const a = data?.advanced;
  const t = data?.totals;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <Link href="/dashboard/settings" className="inline-flex min-h-11 items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"><ArrowLeft className="h-4 w-4" /> Settings</Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Your numbers</h1>
        <p className="mt-1 text-zinc-500">{data ? `${showDate(data.from)} – ${showDate(data.to)}` : "Bookings, visits and what your services bring in."}</p>
      </div>
      {canViewShopNumbers && shop && <ScopeSwitch scope={scope} onChange={setScope} shopName={shop.name} />}
      <div role="radiogroup" aria-label="Period" className="flex gap-2">
        {([7, 30, 90] as const).map((r) => (
          <button key={r} type="button" role="radio" aria-checked={range === r} onClick={() => setRange(r)} className={`min-h-11 rounded-full border px-4 text-sm ${range === r ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"}`}>Last {r} days</button>
        ))}
      </div>

      {error ? <div role="alert" className={`${card} text-red-700`}>{(error as Error).message}</div> : !data || !t ? <div className={`${card} animate-pulse text-zinc-400`}>Loading…</div> : (
        <>
          <section className={`${card} space-y-4`} aria-labelledby="sum-heading">
            <h2 id="sum-heading" className="text-lg font-semibold">Bookings</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total" value={t.bookings} /><Stat label="Completed" value={t.completed} /><Stat label="Upcoming" value={t.upcoming} /><Stat label="Cancelled" value={t.cancelled} />
              <Stat label="No-shows" value={t.noShows} hint={t.noShowRate === null ? "no finished visits yet" : `${t.noShowRate}% of finished visits`} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">Bookings per day</h3>
              <div className="flex h-28 items-end gap-px" role="img" aria-label={`Bookings per day over the last ${data.range} days`}>
                {data.daily.map((d) => { const max = Math.max(1, ...data.daily.map((x) => x.bookings)); return <div key={d.date} title={`${showDate(d.date)}: ${d.bookings}`} className="flex-1 rounded-t bg-indigo-500/80" style={{ height: `${Math.max(d.bookings ? 6 : 1, (d.bookings / max) * 100)}%` }} />; })}
              </div>
            </div>
          </section>

          {!a ? (
            <section className={`${card} flex items-start gap-3`}><Lock className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden="true" /><div><h2 className="font-semibold">Revenue, top services and customers</h2><p className="text-sm text-zinc-500">These are part of the Premium plan: what your catalogue brought in, your best services, new vs returning customers and your busiest hours. Ask your admin to upgrade.</p></div></section>
          ) : (
            <>
              <section className={`${card} space-y-3`} aria-labelledby="rev-heading">
                <h2 id="rev-heading" className="text-lg font-semibold">Revenue from the catalogue</h2>
                <div className="grid grid-cols-2 gap-3"><Stat label="Earned (completed visits)" value={rupees(a.revenue.total)} /><Stat label="Priced visits" value={a.revenue.bookingsWithPrice} hint={a.revenue.completedWithoutPrice > 0 ? `${a.revenue.completedWithoutPrice} completed without a price` : undefined} /></div>
                <p className="text-xs text-zinc-500">Counts only completed visits where the customer chose a service with a price. It is not your whole till (walk-ins and “ask shop” prices are not included).</p>
              </section>
              <section className={`${card} space-y-3`} aria-labelledby="svc-heading">
                <h2 id="svc-heading" className="text-lg font-semibold">Top services</h2>
                {a.topServices.length === 0 ? <p className="text-sm text-zinc-500">No bookings with a chosen service in this period yet.</p> : <Bars label="Top services by bookings" rows={a.topServices.map((s) => ({ key: s.name, label: s.name, value: s.bookings, note: s.revenue ? rupees(s.revenue) : undefined }))} />}
              </section>
              <section className={`${card} space-y-3`} aria-labelledby="cust-heading">
                <h2 id="cust-heading" className="text-lg font-semibold">Customers</h2>
                <div className="grid grid-cols-3 gap-3"><Stat label="Customers" value={a.customers.unique} /><Stat label="Returning" value={a.customers.returning} /><Stat label="New" value={a.customers.new} /></div>
              </section>
              <section className={`${card} space-y-4`} aria-labelledby="busy-heading">
                <h2 id="busy-heading" className="text-lg font-semibold">Busy times</h2>
                {a.peakHours.length === 0 ? <p className="text-sm text-zinc-500">Not enough bookings yet.</p> : <Bars label="Busiest hours" rows={a.peakHours.map((h) => ({ key: String(h.hour), label: hourLabel(h.hour), value: h.bookings }))} />}
                <Bars label="Bookings by weekday" rows={a.weekdays.map((d) => ({ key: String(d.day), label: DAYS[d.day], value: d.bookings }))} />
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
