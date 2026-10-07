"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { showDate } from "@/lib/usePlan";

export interface GrantPlanInfo { status: string; tier: string; granted: boolean; endsOn: string | null }
const MONTHS = [1, 3, 6, 12, 24, 36];

/**
 * Admin: give a barber, or a shop (through its owner), free access to Premium or Business without a payment, for a
 * number of months, or take it away. It does not touch the price or the payment history.
 */
export function PlanGrantPanel({ endpoint, plan, onChanged, label }: { endpoint: string; plan: GrantPlanInfo | null; onChanged: () => void; label: string }) {
  const [tier, setTier] = useState<"PREMIUM" | "BUSINESS">("PREMIUM");
  const [months, setMonths] = useState(12);
  const [busy, setBusy] = useState(false);

  const send = async (body: object, ok: string) => {
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(j?.error?.message || "Could not save.");
      toast.add({ title: "Done", description: ok, type: "success" });
      onChanged();
    } catch (e) { toast.add({ title: "Could not change it", description: (e as Error).message, type: "error" }); }
    finally { setBusy(false); }
  };

  const nice = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();
  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900" aria-label={`Free access for ${label}`}>
      <div>
        <h3 className="text-sm font-semibold">Free access (no payment)</h3>
        <p className="text-xs text-zinc-500">
          {plan ? <>In force now: <strong>{nice(plan.tier)}</strong>{plan.granted ? ` · given free until ${showDate(plan.endsOn)}` : plan.tier === "FREE" ? "" : plan.endsOn ? ` · paid, until ${showDate(plan.endsOn)}` : ""}.</> : "Loading…"} Unlocks the catalogue sizes, photos/videos, offers, messages and numbers of that plan for {label}.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">Plan
          <select value={tier} onChange={(e) => setTier(e.target.value as "PREMIUM" | "BUSINESS")} className="mt-1 block h-10 rounded-lg border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"><option value="PREMIUM">Premium</option><option value="BUSINESS">Business</option></select>
        </label>
        <label className="text-xs">For
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="mt-1 block h-10 rounded-lg border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700">{MONTHS.map((m) => <option key={m} value={m}>{m} month{m === 1 ? "" : "s"}</option>)}</select>
        </label>
        <Button disabled={busy} className="h-10" onClick={() => send({ tier, months }, `${nice(tier)} access given for ${months} month${months === 1 ? "" : "s"}.`)}>{busy ? "Working…" : "Give free access"}</Button>
        {plan?.granted && <Button variant="outline" disabled={busy} className="h-10" onClick={() => send({ tier: "NONE" }, "Free access removed.")}>Remove free access</Button>}
      </div>
    </section>
  );
}
