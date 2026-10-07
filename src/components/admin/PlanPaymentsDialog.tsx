"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { showDate } from "@/lib/usePlan";
import { PlanGrantPanel } from "@/components/admin/PlanGrantPanel";

interface Row { _id: string; amount: number; months: number; method: string; periodStart: string; periodEnd: string; status: "PAID" | "VOID"; reference?: string; note?: string; voidReason?: string; recordedByName: string; createdAt: string }
interface Plan { status: string; tier: string; paidTier: string; granted: boolean; endsOn: string | null; graceEndsOn: string | null; daysLeft: number | null; estimated: boolean }

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error?.message || "Something went wrong.");
  return json.data as T;
}

/** Admin: record a payment for one barber (extends the plan), see the history, and void a mistake with a reason. */
type Barber = { _id: string; name: string; premiumAmount: number };

export function PlanPaymentsDialog({ barber, onClose, onChanged }: { barber: Barber | null; onClose: () => void; onChanged: () => void }) {
  // The panel is mounted fresh for each barber, so its form always starts clean.
  return barber ? <Panel key={barber._id} barber={barber} onClose={onClose} onChanged={onChanged} /> : null;
}

function Panel({ barber, onClose, onChanged }: { barber: Barber; onClose: () => void; onChanged: () => void }) {
  const history = useSWR<{ plan: Plan; payments: Row[] }>(`/api/admin/barbers/${barber._id}/payments`, (url: string) => api(url, "GET"), { revalidateOnFocus: false });
  const plan = history.data?.plan ?? null;
  const rows = history.data?.payments ?? [];
  const [amount, setAmount] = useState(String(barber.premiumAmount || ""));
  const [months, setMonths] = useState("1");
  const [method, setMethod] = useState("UPI");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = () => history.mutate();

  const record = async () => {
    setBusy(true);
    try {
      await api(`/api/admin/barbers/${barber._id}/payments`, "POST", { amount: Number(amount), months: Number(months), method, reference: reference || undefined, note: note || undefined });
      toast.add({ title: "Payment recorded", description: "The plan has been extended.", type: "success" });
      setReference(""); setNote("");
      await load(); onChanged();
    } catch (e) { toast.add({ title: "Could not record", description: (e as Error).message, type: "error" }); }
    finally { setBusy(false); }
  };

  const doVoid = async (id: string) => {
    setBusy(true);
    try {
      await api(`/api/admin/barbers/${barber._id}/payments/${id}/void`, "POST", { reason });
      toast.add({ title: "Payment voided", description: "It stays in the history, marked void.", type: "success" });
      setVoiding(null); setReason("");
      await load(); onChanged();
    } catch (e) { toast.add({ title: "Could not void", description: (e as Error).message, type: "error" }); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Plan and payments — {barber.name}</DialogTitle>
          <DialogDescription>
            {plan ? `${plan.status}${plan.endsOn ? ` · ${plan.estimated ? "monthly due date" : "ends"} ${showDate(plan.endsOn)}` : ""}${plan.status === "GRACE" ? ` · grace until ${showDate(plan.graceEndsOn)}` : ""}` : history.error ? "Could not load the history. Close and try again." : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        <PlanGrantPanel endpoint={`/api/admin/barbers/${barber._id}/grant`} plan={plan} onChanged={() => { load(); onChanged(); }} label={barber.name} />

        <h3 className="text-sm font-semibold">Record a payment</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="pay-amount">Amount paid (₹)</Label><Input id="pay-amount" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="pay-months">Months covered</Label><Input id="pay-months" type="number" min="1" max="24" value={months} onChange={(e) => setMonths(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="pay-method">How</Label>
            <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)} className="h-10 w-full rounded-lg border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700">
              <option value="UPI">UPI</option><option value="CASH">Cash</option><option value="BANK">Bank transfer</option><option value="OTHER">Other</option><option value="COMPLIMENTARY">Free / complimentary</option>
            </select></div>
          <div className="space-y-1"><Label htmlFor="pay-ref">Reference (optional)</Label><Input id="pay-ref" maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI ref / receipt no." /></div>
          <div className="col-span-2 space-y-1"><Label htmlFor="pay-note">Note (optional)</Label><Input id="pay-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <Button onClick={record} disabled={busy || !amount || !months} className="h-11">{busy ? "Working…" : "Record payment and extend plan"}</Button>

        <h3 className="mt-2 text-sm font-semibold">History</h3>
        {rows.length === 0 ? <p className="text-sm text-zinc-500">No payments recorded yet.</p> : (
          <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {rows.map((r) => (
              <li key={r._id} className={`py-2 ${r.status === "VOID" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className={r.status === "VOID" ? "line-through" : ""}>{showDate(r.periodStart)} – {showDate(r.periodEnd)} · {r.months} mo</span>
                  <span className="font-medium">₹{r.amount} · {r.method}</span>
                </div>
                <div className="text-xs text-zinc-500">
                  {new Date(r.createdAt).toLocaleString("en-IN")} · by {r.recordedByName}{r.reference ? ` · ref ${r.reference}` : ""}{r.note ? ` · ${r.note}` : ""}
                  {r.status === "VOID" && <span className="font-semibold text-red-600"> · VOID: {r.voidReason}</span>}
                </div>
                {r.status === "PAID" && (voiding === r._id ? (
                  <div className="mt-2 flex gap-2">
                    <Input aria-label="Reason for voiding" placeholder="Why is this a mistake?" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
                    <Button variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => doVoid(r._id)}>Void</Button>
                    <Button variant="outline" onClick={() => { setVoiding(null); setReason(""); }}>Cancel</Button>
                  </div>
                ) : <button type="button" className="mt-1 text-xs text-red-600 underline" onClick={() => { setVoiding(r._id); setReason(""); }}>Void this payment</button>)}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
