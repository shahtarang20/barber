"use client";

import { useState } from "react";
import useSWR from "swr";
import { Gift, Plus, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { getWheel, saveWheel, type CatalogueScope, type WheelConfig, type WheelSegment } from "@/lib/wheelClient";

const SLICE_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];
const REWARD_TYPES: WheelSegment["rewardType"][] = ["NONE", "PERCENTAGE", "FIXED", "FREE_SERVICE"];

export function WheelForm({ scope }: { scope: CatalogueScope }) {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR(["wheel", scope], () => getWheel(scope));
  if (isLoading || !data) return <p className="text-sm text-zinc-400">{t("ownCatLoading")}</p>;
  return <WheelFields key={scope} scope={scope} config={data.config} onSaved={() => mutate()} />;
}

function rewardTypeLabel(t: (k: "ownWheelPrizeNone" | "ownLoyaltyRewardPercent" | "ownLoyaltyRewardFixed" | "ownLoyaltyRewardFree") => string, rt: WheelSegment["rewardType"]): string {
  return rt === "NONE" ? t("ownWheelPrizeNone") : rt === "PERCENTAGE" ? t("ownLoyaltyRewardPercent") : rt === "FIXED" ? t("ownLoyaltyRewardFixed") : t("ownLoyaltyRewardFree");
}

function WheelFields({ scope, config, onSaved }: { scope: CatalogueScope; config: WheelConfig; onSaved: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<WheelConfig>(config);
  const [saving, setSaving] = useState(false);

  const setSeg = (i: number, patch: Partial<WheelSegment>) => setDraft((d) => ({ ...d, segments: d.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const addSeg = () => setDraft((d) => (d.segments.length >= 8 ? d : { ...d, segments: [...d.segments, { label: "Prize", weight: 10, rewardType: "NONE", rewardValue: 0 }] }));
  const removeSeg = (i: number) => setDraft((d) => ({ ...d, segments: d.segments.filter((_, j) => j !== i) }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveWheel(scope, draft);
      toast.add({ title: t("ownSaved"), type: "success" });
      onSaved();
    } catch (err) {
      toast.add({ title: t("ownCouldNotSave"), description: (err as Error).message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("ownWheelHint")}</p>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white"><Sparkles className="h-5 w-5" /></span>
          <span className="text-sm font-medium">{t("ownWheelEnable")}</span>
        </span>
        <button type="button" role="switch" aria-checked={draft.enabled} aria-label={t("ownWheelEnable")} onClick={() => setDraft((d) => ({ ...d, enabled: !d.enabled }))}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${draft.enabled ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-600"}`}>
          <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${draft.enabled ? "translate-x-7" : "translate-x-1"}`} />
        </button>
      </label>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">{t("ownWheelPrizes")}</legend>
        <p className="text-xs text-zinc-500">{t("ownWheelPrizesHint")}</p>
        <ul className="space-y-2">
          {draft.segments.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 p-2.5 dark:border-zinc-700">
              <span className="h-5 w-5 shrink-0 rounded-full" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} aria-hidden="true" />
              <Input aria-label={t("ownWheelPrizeLabel")} value={s.label} maxLength={40} onChange={(e) => setSeg(i, { label: e.target.value })} className="min-w-28 flex-1" />
              <select aria-label={t("ownWheelPrizeType")} value={s.rewardType} onChange={(e) => setSeg(i, { rewardType: e.target.value as WheelSegment["rewardType"] })}
                className="h-11 rounded-lg border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700">
                {REWARD_TYPES.map((rt) => <option key={rt} value={rt}>{rewardTypeLabel(t, rt)}</option>)}
              </select>
              {(s.rewardType === "PERCENTAGE" || s.rewardType === "FIXED") && (
                <Input aria-label={t("ownWheelPrizeValue")} type="number" min={1} value={s.rewardValue} onChange={(e) => setSeg(i, { rewardValue: Number(e.target.value) })} className="w-20" />
              )}
              <label className="flex items-center gap-1 text-xs text-zinc-500">
                {t("ownWheelOdds")}
                <Input aria-label={t("ownWheelOdds")} type="number" min={0} max={1000} value={s.weight} onChange={(e) => setSeg(i, { weight: Number(e.target.value) })} className="w-16" />
              </label>
              <button type="button" aria-label={t("ownWheelRemove")} onClick={() => removeSeg(i)} className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {draft.segments.length < 8 && (
          <Button type="button" variant="outline" className="h-11" onClick={addSeg}><Plus className="mr-1.5 h-4 w-4" />{t("ownWheelAddPrize")}</Button>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="wheel-per-customer">{t("ownWheelPerCustomer")}</Label>
          <Input id="wheel-per-customer" type="number" min={0} max={1000} value={draft.maxSpinsPerCustomer} onChange={(e) => setDraft((d) => ({ ...d, maxSpinsPerCustomer: Number(e.target.value) }))} />
          <p className="text-xs text-zinc-400">{t("ownWheelZeroUnlimited")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wheel-total">{t("ownWheelTotal")}</Label>
          <Input id="wheel-total" type="number" min={0} max={1000000} value={draft.maxSpinsTotal} onChange={(e) => setDraft((d) => ({ ...d, maxSpinsTotal: Number(e.target.value) }))} />
          <p className="text-xs text-zinc-400">{t("ownWheelZeroUnlimited")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wheel-cooldown">{t("ownWheelCooldown")}</Label>
          <Input id="wheel-cooldown" type="number" min={0} max={365} value={draft.cooldownDays} onChange={(e) => setDraft((d) => ({ ...d, cooldownDays: Number(e.target.value) }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wheel-valid">{t("ownLoyaltyValidDays")}</Label>
          <Input id="wheel-valid" type="number" min={0} max={365} value={draft.rewardValidDays} onChange={(e) => setDraft((d) => ({ ...d, rewardValidDays: Number(e.target.value) }))} />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <Gift className="h-4 w-4 shrink-0" /> {t("ownWheelOddsNote")}
      </div>

      <Button type="submit" disabled={saving} className="h-11">{saving ? t("ownSaving") : t("save")}</Button>
    </form>
  );
}
