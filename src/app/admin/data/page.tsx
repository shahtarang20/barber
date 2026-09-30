"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface RetentionData {
  config: { enabled: boolean; months: number; storageLimitMB: number; lastRun?: { at: string; bookingsDeleted: number; slotsDeleted: number } };
  cutoff: string;
  eligible: number;
  totalBookings: number;
  sizeMB: number | null;
}

export default function DataPage() {
  const { data, mutate, isLoading } = useSWR("/api/admin/retention", fetcher);
  const info: RetentionData | null = data?.success ? data.data : null;

  const [enabled, setEnabled] = useState(false);
  const [months, setMonths] = useState("6");
  const [limit, setLimit] = useState("512");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (info) {
      setEnabled(info.config.enabled);
      setMonths(String(info.config.months));
      setLimit(String(info.config.storageLimitMB));
    }
  }, [info?.config.enabled, info?.config.months, info?.config.storageLimitMB]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/retention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, months: Number(months), storageLimitMB: Number(limit) }),
      });
      const result = await res.json();
      toast.add({
        title: result.success ? "Saved" : "Error",
        description: result.success ? "Cleanup settings updated." : result.error?.message || "Could not save",
        type: result.success ? "success" : "error",
      });
      mutate();
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    if (!confirm(`Delete finished bookings older than ${info?.cutoff}? This cannot be undone. Download the CSV first if you want a copy.`)) return;
    setRunning(true);
    try {
      const res = await fetch("/api/admin/retention/run", { method: "POST" });
      const result = await res.json();
      toast.add({
        title: result.success ? "Cleanup done" : "Error",
        description: result.success ? `${result.data.bookingsDeleted} bookings and ${result.data.slotsDeleted} old schedule days removed.` : result.error?.message || "Failed",
        type: result.success ? "success" : "error",
      });
      mutate();
    } finally {
      setRunning(false);
    }
  };

  if (isLoading || !info) return <div className="p-12 text-center text-zinc-500">Loading...</div>;

  const used = info.sizeMB;
  const pct = used !== null ? Math.min(100, Math.round((used / Number(limit || info.config.storageLimitMB)) * 100)) : null;
  const barColor = pct === null ? "bg-zinc-400" : pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-500" : "bg-green-500";

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Data &amp; Storage</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">Keep the database small by removing old finished bookings automatically.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Storage</h2>
        {used === null ? (
          <p className="text-sm text-zinc-500">The database did not report its size.</p>
        ) : (
          <>
            <div className="h-3 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {used} MB used of {limit} MB ({pct}%)
              {pct !== null && pct >= 90 && <span className="ml-2 font-semibold text-red-600">Almost full — clean up or upgrade your database plan.</span>}
              {pct !== null && pct >= 70 && pct < 90 && <span className="ml-2 font-semibold text-orange-600">Getting full.</span>}
            </p>
          </>
        )}
        <p className="text-xs text-zinc-500">{info.totalBookings.toLocaleString()} {info.totalBookings === 1 ? "booking" : "bookings"} stored.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Automatic cleanup</h2>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="w-5 h-5" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="text-zinc-800 dark:text-zinc-200 font-medium">Remove old finished bookings every day</span>
        </label>
        <div className="space-y-2">
          <Label>Keep finished bookings for (months)</Label>
          <div className="flex items-center gap-3">
            <Input type="number" min={1} max={60} value={months} onChange={(e) => setMonths(e.target.value)} className="w-24" />
            {[3, 6, 12, 24].map((m) => (
              <button key={m} type="button" onClick={() => setMonths(String(m))} className="text-sm text-blue-600 hover:underline">{m}</button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">Only completed, cancelled and no-show bookings are removed. Upcoming and confirmed bookings are never touched. Customers, their private notes, and each customer&apos;s visit count and last visit date are kept.</p>
        </div>
        <div className="space-y-2">
          <Label>Database plan size (MB) — used for the warning above</Label>
          <Input type="number" min={50} value={limit} onChange={(e) => setLimit(e.target.value)} className="w-32" />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">What would be removed</h2>
        <p className="text-zinc-700 dark:text-zinc-300">
          <span className="text-2xl font-bold">{info.eligible.toLocaleString()}</span> finished {info.eligible === 1 ? "booking" : "bookings"} dated before <strong>{info.cutoff}</strong>.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="/api/admin/retention/export" className="inline-flex items-center h-10 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">Download them as CSV first</a>
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={running || !info.config.enabled || info.eligible === 0} onClick={runNow}>
            {running ? "Cleaning..." : "Clean up now"}
          </Button>
        </div>
        {!info.config.enabled && <p className="text-xs text-zinc-500">Turn the cleanup on and save to enable &quot;Clean up now&quot;.</p>}
        {info.config.lastRun && (
          <p className="text-xs text-zinc-500">Last cleanup: {format(new Date(info.config.lastRun.at), "d MMM yyyy, h:mm a")} — {info.config.lastRun.bookingsDeleted} bookings and {info.config.lastRun.slotsDeleted} old schedule days removed.</p>
        )}
      </div>
    </div>
  );
}
