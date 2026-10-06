"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

type Tier = "FREE" | "PREMIUM" | "BUSINESS";
const FIELDS = [
  ["maxCategories", "Categories"], ["maxServices", "Published services"], ["maxImagesPerService", "Pictures / service"], ["maxVideosPerService", "Videos / service"], ["maxMediaMB", "Storage (MB)"], ["maxActiveOffers", "Live offers"], ["maxCampaignsPerWeek", "Customer notifications / week"],
] as const;
type Limits = Record<(typeof FIELDS)[number][0], number>;
interface Config { businessFromAmount: number; graceDays: number; tiers: Record<Tier, Limits> }

/** Admin: the size of each plan, the price from which a barber counts as Business, and the grace period after a plan ends. */
export function PlanSettingsCard() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch("/api/admin/plans").then((r) => r.json()).then((j) => j.success && setCfg(j.data.config)).catch(() => {}); }, []);
  if (!cfg) return null;

  const setTier = (t: Tier, k: keyof Limits, v: string) => setCfg({ ...cfg, tiers: { ...cfg.tiers, [t]: { ...cfg.tiers[t], [k]: Number(v) } } });
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/plans", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error?.message || "Could not save");
      setCfg(j.data.config);
      toast.add({ title: "Saved", description: "Plan settings updated. They apply right away.", type: "success" });
    } catch (e) { toast.add({ title: "Could not save", description: (e as Error).message, type: "error" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Plans and limits</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">A barber&apos;s plan follows the monthly amount in Manage Stores: nothing = Free, any amount = Premium, from the Business amount below = Business. Changes apply to everyone at once.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="biz-from">Business from (₹ / month)</Label><Input id="biz-from" type="number" min="1" value={cfg.businessFromAmount} onChange={(e) => setCfg({ ...cfg, businessFromAmount: Number(e.target.value) })} /></div>
        <div className="space-y-1"><Label htmlFor="grace-days">Grace period after a plan ends (days)</Label><Input id="grace-days" type="number" min="0" max="60" value={cfg.graceDays} onChange={(e) => setCfg({ ...cfg, graceDays: Number(e.target.value) })} /></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-zinc-500"><th className="py-2 pr-4 font-medium">Limit</th>{(["FREE", "PREMIUM", "BUSINESS"] as Tier[]).map((t) => <th key={t} className="px-2 py-2 font-medium">{t[0] + t.slice(1).toLowerCase()}</th>)}</tr></thead>
          <tbody>
            {FIELDS.map(([k, label]) => (
              <tr key={k}>
                <td className="py-1 pr-4">{label}</td>
                {(["FREE", "PREMIUM", "BUSINESS"] as Tier[]).map((t) => (
                  <td key={t} className="px-2 py-1"><Input aria-label={`${label} for ${t.toLowerCase()} plan`} type="number" min="0" className="w-24" value={cfg.tiers[t][k]} onChange={(e) => setTier(t, k, e.target.value)} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">After a plan and its grace period end, the barber is limited to the Free column. Nothing is deleted; renewing brings everything back.</p>
      <Button onClick={save} disabled={saving} className="h-11">{saving ? "Saving…" : "Save plan settings"}</Button>
    </div>
  );
}
