"use client";

import { useState } from "react";
import useSWR from "swr";
import { CreditCard, Calendar, Check, Plus, IndianRupee, Ticket, Lock, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { catalogueApi } from "@/lib/catalogueClient";
import type { ServiceDoc } from "@/lib/catalogueClient";
import {
  getMembershipPlans, createMembershipPlan, updateMembershipPlan,
  type CatalogueScope, type MembershipPlan, type MembershipPlanInput,
} from "@/lib/membershipClient";

const EMPTY_DRAFT: MembershipPlanInput = { name: "", price: 500, durationDays: 30, includedVisits: 0, serviceIds: [], active: true };

/** The owner's membership plans: create, edit, deactivate. Loads its own data (not part of the branding payload). */
export function MembershipPlans({ scope }: { scope: CatalogueScope }) {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR(["membership-plans", scope], () => getMembershipPlans(scope));
  const [editing, setEditing] = useState<MembershipPlan | "new" | null>(null);

  if (isLoading || !data) return <p className="text-sm text-zinc-400">{t("ownCatLoading")}</p>;

  if (data.plan.membershipEnabled === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-zinc-700">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800"><Lock className="h-5 w-5" /></span>
        <p className="text-sm text-zinc-500">{t("ownMemberBusinessOnly")}</p>
      </div>
    );
  }

  const plans = data.plans;

  const deactivate = async (plan: MembershipPlan) => {
    try {
      await updateMembershipPlan(scope, plan.id, { active: false });
      mutate();
    } catch (err) {
      toast.add({ title: t("ownCouldNotSave"), description: (err as Error).message, type: "error" });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("ownMemberHint")}</p>
        {editing === null && (
          <Button type="button" className="h-11 shrink-0" onClick={() => setEditing("new")}>
            <Plus className="mr-1 h-4 w-4" /> {t("ownMemberNewPlan")}
          </Button>
        )}
      </div>

      {editing !== null && (
        <PlanForm
          scope={scope}
          plan={editing === "new" ? null : editing}
          onDone={() => { setEditing(null); mutate(); }}
          onCancel={() => setEditing(null)}
        />
      )}

      {plans.length === 0 && editing === null ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-zinc-700">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800"><CreditCard className="h-5 w-5" /></span>
          <p className="text-sm text-zinc-500">{t("ownMemberNoPlans")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {plans.map((p) => (
            <li key={p.id} className={`rounded-xl border p-4 ${p.active ? "border-zinc-200 dark:border-zinc-700" : "border-zinc-200 bg-zinc-50 opacity-70 dark:border-zinc-800 dark:bg-zinc-900"}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"><CreditCard className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold leading-snug">{p.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400"><IndianRupee className="h-3.5 w-3.5" />{p.price}</span>
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{t("ownMemberDaysShort").replace("{n}", String(p.durationDays))}</span>
                    <span className="inline-flex items-center gap-1"><Ticket className="h-3.5 w-3.5" />{p.includedVisits === 0 ? t("ownMemberUnlimited") : t("ownMemberVisitsShort").replace("{n}", String(p.includedVisits))}</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">{p.serviceIds.length === 0 ? t("ownMemberAllServices") : t("ownMemberSomeServices").replace("{n}", String(p.serviceIds.length))}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button type="button" variant="outline" className="h-11" onClick={() => setEditing(p)}>{t("ownMemberEdit")}</Button>
                {p.active ? (
                  <Button type="button" variant="outline" className="h-11" onClick={() => void deactivate(p)}>
                    <Power className="mr-1 h-4 w-4" /> {t("ownMemberDeactivate")}
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500 dark:bg-zinc-800">{t("ownMemberInactive")}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlanForm({ scope, plan, onDone, onCancel }: { scope: CatalogueScope; plan: MembershipPlan | null; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const { data: services } = useSWR(["membership-form-services", scope], () => catalogueApi<ServiceDoc[]>("GET", "/api/barber/catalogue/services", scope));
  const [draft, setDraft] = useState<MembershipPlanInput>(plan ? { name: plan.name, price: plan.price, durationDays: plan.durationDays, includedVisits: plan.includedVisits, serviceIds: plan.serviceIds, active: plan.active } : { ...EMPTY_DRAFT });
  const [allServices, setAllServices] = useState(draft.serviceIds.length === 0);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof MembershipPlanInput>(key: K, value: MembershipPlanInput[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const toggleService = (id: string) => setDraft((d) => ({ ...d, serviceIds: d.serviceIds.includes(id) ? d.serviceIds.filter((s) => s !== id) : [...d.serviceIds, id] }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) { toast.add({ title: t("ownMemberNameNeeded"), type: "error" }); return; }
    setSaving(true);
    const body: Partial<MembershipPlanInput> = { ...draft, serviceIds: allServices ? [] : draft.serviceIds };
    try {
      if (plan) await updateMembershipPlan(scope, plan.id, body);
      else await createMembershipPlan(scope, body);
      toast.add({ title: t("ownSaved"), type: "success" });
      onDone();
    } catch (err) {
      toast.add({ title: t("ownCouldNotSave"), description: (err as Error).message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="member-name">{t("ownMemberName")}</Label>
        <Input id="member-name" value={draft.name} maxLength={60} onChange={(e) => set("name", e.target.value)} placeholder={t("ownMemberNamePlaceholder")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="member-price">{t("ownMemberPrice")}</Label>
          <Input id="member-price" type="number" min={1} value={draft.price} onChange={(e) => set("price", Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="member-days">{t("ownMemberDuration")}</Label>
          <Input id="member-days" type="number" min={1} max={3650} value={draft.durationDays} onChange={(e) => set("durationDays", Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="member-visits">{t("ownMemberVisits")}</Label>
          <Input id="member-visits" type="number" min={0} max={1000} value={draft.includedVisits} onChange={(e) => set("includedVisits", Number(e.target.value))} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-zinc-400">{t("ownMemberVisitsHint")}</p>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("ownMemberCovers")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("ownMemberCovers")}>
          <button type="button" role="radio" aria-checked={allServices} onClick={() => setAllServices(true)}
            className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${allServices ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300" : "border-zinc-300 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"}`}>
            <Check className="h-4 w-4" /> {t("ownMemberAllServices")}
          </button>
          <button type="button" role="radio" aria-checked={!allServices} onClick={() => setAllServices(false)}
            className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${!allServices ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300" : "border-zinc-300 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"}`}>
            {t("ownMemberPickServices")}
          </button>
        </div>
        {!allServices && (
          <div className="mt-3 flex max-h-56 flex-wrap gap-2 overflow-auto">
            {(services || []).map((s) => {
              const on = draft.serviceIds.includes(s._id);
              return (
                <button key={s._id} type="button" aria-pressed={on} onClick={() => toggleService(s._id)}
                  className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${on ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"}`}>
                  {on && <Check className="h-3.5 w-3.5" />} {s.name}
                </button>
              );
            })}
            {(services || []).length === 0 && <p className="text-xs text-zinc-400">{t("ownMemberNoServices")}</p>}
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving} className="h-11">{saving ? t("ownSaving") : t("save")}</Button>
        <Button type="button" variant="outline" className="h-11" onClick={onCancel}>{t("ownMemberCancel")}</Button>
      </div>
    </form>
  );
}
