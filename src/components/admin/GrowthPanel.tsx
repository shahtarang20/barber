"use client";

import useSWR from "swr";
import { toast } from "@/components/ui/toast";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const colors = { ok: "bg-green-500", warn: "bg-orange-500", danger: "bg-red-500" } as const;
const text = { ok: "text-zinc-500", warn: "text-orange-600", danger: "text-red-600" } as const;

export function GrowthPanel() {
  const { data, mutate } = useSWR("/api/admin/growth", fetcher, { refreshInterval: 60000 });
  const g = data?.success ? data.data : null;
  if (!g) return null;

  const worst = g.items.some((i: any) => i.level === "danger") ? "danger" : g.items.some((i: any) => i.level === "warn") ? "warn" : "ok";

  const savePusher = async (value: string) => {
    const res = await fetch("/api/admin/growth", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pusherLimit: Number(value) }) });
    const d = await res.json();
    toast.add(d.success ? { title: "Success", description: "Pusher plan size saved", type: "success" } : { title: "Error", description: d.error?.message || "Could not save", type: "error" });
    mutate();
  };

  return (
    <div className={`rounded-2xl border shadow-sm p-5 sm:p-6 space-y-5 bg-white dark:bg-zinc-900 ${worst === "danger" ? "border-red-300" : worst === "warn" ? "border-orange-300" : "border-zinc-200 dark:border-zinc-800"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Growth &amp; limits</h2>
          <p className="text-sm text-zinc-500">{g.stage.name} · {g.shops} shops, {g.barbers} barbers · cost at this stage {g.stage.cost}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${worst === "danger" ? "bg-red-100 text-red-700" : worst === "warn" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
          {worst === "danger" ? "Upgrade now" : worst === "warn" ? "Upgrade soon" : "All fine"}
        </span>
      </div>

      <p className="text-sm text-zinc-700 dark:text-zinc-300"><span className="font-medium">Do at this stage:</span> {g.stage.doNow}</p>

      <div className="grid gap-4 md:grid-cols-3">
        {g.items.map((i: any) => (
          <div key={i.key} className="space-y-2">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{i.label}</p>
            <div className="h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className={`h-full ${colors[i.level as keyof typeof colors]}`} style={{ width: `${Math.min(100, i.pct)}%` }} />
            </div>
            <p className="text-xs text-zinc-500">{i.value}</p>
            <p className={`text-xs ${text[i.level as keyof typeof text]} ${i.level !== "ok" ? "font-semibold" : ""}`}>{i.advice}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm border-t border-zinc-100 dark:border-zinc-800 pt-4">
        <label className="text-zinc-600 dark:text-zinc-400">My Pusher plan allows</label>
        <input
          key={g.pusherLimit}
          type="number" min="1"
          defaultValue={g.pusherLimit}
          onBlur={(e) => e.target.value !== String(g.pusherLimit) && savePusher(e.target.value)}
          className="w-24 px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent"
        />
        <span className="text-zinc-500">connections (free = 100, Startup = 500, Pro = 2000)</span>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <a className="text-blue-600 hover:underline" href="https://dashboard.pusher.com" target="_blank" rel="noreferrer">Pusher dashboard</a>
        <a className="text-blue-600 hover:underline" href="https://vercel.com" target="_blank" rel="noreferrer">Vercel (Pro needed to charge shops)</a>
        <a className="text-blue-600 hover:underline" href="https://cloud.mongodb.com" target="_blank" rel="noreferrer">MongoDB Atlas</a>
        <a className="text-blue-600 hover:underline" href="https://console.upstash.com" target="_blank" rel="noreferrer">Upstash</a>
      </div>
      <p className="text-xs text-zinc-500">Next step: {g.stage.next} Full details are in BUSINESS.md. Numbers here are estimates: Pusher, Vercel and MongoDB speed can only be seen exactly on their own dashboards.</p>
    </div>
  );
}
