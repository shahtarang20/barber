"use client";

import { useState } from "react";
import useSWR from "swr";
import { CreditCard, Calendar, Ticket, UserPlus, Check, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import {
  getMembershipPlans, listMembers, sellMembership,
  type CatalogueScope, type Member,
} from "@/lib/membershipClient";

/** First letter of a customer's name (or phone) for the avatar; falls back to a dot. */
function initial(name: string, phone: string): string {
  const s = name.trim() || phone.trim();
  return s ? Array.from(s)[0].toLocaleUpperCase() : "•";
}

const PAYMENT_MODES: { id: Member["paymentMode"]; label: "ownMemberPayCash" | "ownMemberPayUpi" | "ownMemberPayOther" }[] = [
  { id: "CASH", label: "ownMemberPayCash" },
  { id: "UPI", label: "ownMemberPayUpi" },
  { id: "OTHER", label: "ownMemberPayOther" },
];

/** The owner's current members, with a "Sell membership" inline form. */
export function MembershipMembers({ scope }: { scope: CatalogueScope }) {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR(["members", scope], () => listMembers(scope));
  const { data: plansData } = useSWR(["membership-plans", scope], () => getMembershipPlans(scope));
  const [selling, setSelling] = useState(false);

  if (isLoading || !data) return <p className="text-sm text-zinc-400">{t("ownCatLoading")}</p>;
  const members = data.members;
  const activePlans = (plansData?.plans || []).filter((p) => p.active);
  const locked = plansData?.plan.membershipEnabled === 0;

  return (
    <div className="space-y-4">
      {!locked && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("ownMemberMembersHint")}</p>
          {!selling && (
            <Button type="button" className="h-11 shrink-0" disabled={activePlans.length === 0} onClick={() => setSelling(true)}>
              <UserPlus className="mr-1 h-4 w-4" /> {t("ownMemberSell")}
            </Button>
          )}
        </div>
      )}

      {!locked && activePlans.length === 0 && !selling && (
        <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-700">{t("ownMemberNeedActivePlan")}</p>
      )}

      {selling && (
        <SellForm scope={scope} plans={activePlans} onDone={() => { setSelling(false); mutate(); }} onCancel={() => setSelling(false)} />
      )}

      {members.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-zinc-700">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800"><CreditCard className="h-5 w-5" /></span>
          <p className="text-sm text-zinc-500">{t("ownMemberNoMembers")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {members.map((m) => {
            const expired = m.status !== "ACTIVE";
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${expired ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800" : "bg-indigo-600 text-white"}`} aria-hidden="true">
                  {initial(m.customerName, m.customerPhone)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-snug">{m.customerName || m.customerPhone || "—"}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400"><CreditCard className="h-3.5 w-3.5" />{m.planName}</span>
                    <span className="inline-flex items-center gap-1"><Ticket className="h-3.5 w-3.5" />{m.remainingVisits < 0 ? t("ownMemberUnlimited") : t("ownMemberVisitsLeft").replace("{n}", String(m.remainingVisits))}</span>
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{t("ownMemberExpires").replace("{date}", m.expiresOn)}</span>
                  </p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${expired ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>
                  {expired ? t("ownMemberExpiredChip") : <><Check className="h-3.5 w-3.5" /> {t("ownMemberActiveChip")}</>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SellForm({ scope, plans, onDone, onCancel }: { scope: CatalogueScope; plans: { id: string; name: string }[]; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [planId, setPlanId] = useState(plans[0]?.id || "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMode, setPaymentMode] = useState<Member["paymentMode"]>("CASH");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planId) { toast.add({ title: t("ownMemberPickPlanFirst"), type: "error" }); return; }
    if (!name.trim()) { toast.add({ title: t("ownMemberNameNeeded"), type: "error" }); return; }
    setSaving(true);
    try {
      await sellMembership(scope, { planId, customerName: name.trim(), customerPhone: phone.trim(), paymentMode });
      toast.add({ title: t("ownMemberSold"), type: "success" });
      onDone();
    } catch (err) {
      toast.add({ title: t("ownCouldNotSave"), description: (err as Error).message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50" noValidate>
      <div className="space-y-1.5">
        <Label>{t("ownMemberPickPlan")}</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("ownMemberPickPlan")}>
          {plans.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={planId === p.id} onClick={() => setPlanId(p.id)}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${planId === p.id ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300" : "border-zinc-300 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"}`}>
              <CreditCard className="h-4 w-4" /> {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sell-name">{t("ownMemberCustomerName")}</Label>
          <Input id="sell-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sell-phone">{t("ownMemberCustomerPhone")}</Label>
          <Input id="sell-phone" value={phone} maxLength={20} inputMode="tel" onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Wallet className="h-4 w-4" /> {t("ownMemberPaymentMode")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("ownMemberPaymentMode")}>
          {PAYMENT_MODES.map(({ id, label }) => (
            <button key={id} type="button" role="radio" aria-checked={paymentMode === id} onClick={() => setPaymentMode(id)}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${paymentMode === id ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300" : "border-zinc-300 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"}`}>
              {t(label)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving} className="h-11">{saving ? t("ownSaving") : t("ownMemberSellCta")}</Button>
        <Button type="button" variant="outline" className="h-11" onClick={onCancel}>{t("ownMemberCancel")}</Button>
      </div>
    </form>
  );
}
