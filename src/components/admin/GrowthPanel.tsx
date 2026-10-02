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

  const worst = g.overall as "ok" | "warn" | "danger";

  const save = async (body: Record<string, unknown>, okMsg: string) => {
    const res = await fetch("/api/admin/growth", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    toast.add(d.success ? { title: "Success", description: okMsg, type: "success" } : { title: "Error", description: d.error?.message || "Could not save", type: "error" });
    mutate();
  };
  const numberField = (field: string, label: string, value: number, hint: string) => (
    <label className="flex flex-wrap items-center gap-2 text-zinc-600 dark:text-zinc-400">
      {label}
      <input
        key={`${field}-${value}`}
        type="number" min="1"
        defaultValue={value}
        onBlur={(e) => e.target.value !== String(value) && save({ [field]: Number(e.target.value) }, "Saved")}
        className="w-28 px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent"
      />
      <span className="text-zinc-500">{hint}</span>
    </label>
  );

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
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              {i.kind === "status" && <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${colors[i.level as keyof typeof colors]}`} />}
              {i.label}
            </p>
            {i.kind === "meter" && (
              <div className="h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div className={`h-full ${colors[i.level as keyof typeof colors]}`} style={{ width: `${Math.min(100, i.pct)}%` }} />
              </div>
            )}
            <p className="text-xs text-zinc-500">{i.value}</p>
            <p className={`text-xs ${text[i.level as keyof typeof text]} ${i.level !== "ok" ? "font-semibold" : ""}`}>{i.advice}</p>
            <div className="flex flex-wrap items-center gap-3">
              {i.checkKey && (
                <button onClick={() => save({ checkedNow: i.checkKey }, "Marked as checked today")} className="px-2.5 py-1 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  I checked it today
                </button>
              )}
              {i.link && <a className="text-xs text-blue-600 hover:underline" href={i.link} target="_blank" rel="noreferrer">Open dashboard</a>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 text-sm border-t border-zinc-100 dark:border-zinc-800 pt-4">
        <p className="text-xs text-zinc-500">The plans you pay for (so the warnings above use the right sizes — update these when you upgrade):</p>
        {numberField("pusherLimit", "Pusher connections", g.settings.pusherLimit, "(free = 100, Startup = 500, Pro = 2000)")}
        {numberField("pusherDailyMessages", "Pusher messages per day", g.settings.pusherDailyMessages, "(free = 200,000)")}
        {numberField("redisMonthlyCommands", "Redis commands per month", g.settings.redisMonthlyCommands, "(Upstash free = 500,000)")}
        <label className="flex flex-wrap items-center gap-2 text-zinc-600 dark:text-zinc-400">
          Vercel plan
          <select value={g.settings.vercelPlan} onChange={(e) => save({ vercelPlan: e.target.value }, "Vercel plan saved")} className="px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent">
            <option value="hobby">Hobby (free)</option>
            <option value="pro">Pro</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <a className="text-blue-600 hover:underline" href="https://dashboard.pusher.com" target="_blank" rel="noreferrer">Pusher dashboard</a>
        <a className="text-blue-600 hover:underline" href="https://vercel.com" target="_blank" rel="noreferrer">Vercel (Pro needed to charge shops)</a>
        <a className="text-blue-600 hover:underline" href="https://cloud.mongodb.com" target="_blank" rel="noreferrer">MongoDB Atlas</a>
        <a className="text-blue-600 hover:underline" href="https://console.upstash.com" target="_blank" rel="noreferrer">Upstash</a>
      </div>
      <p className="text-xs text-zinc-500">Next step: {g.stage.next} Full details are in BUSINESS.md. Message and command counts are the app's own estimates; the exact numbers are always on each service's own dashboard.</p>
    </div>
  );
}
