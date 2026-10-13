"use client";

import { useState } from "react";
import useSWR from "swr";
import { Gift, Percent, IndianRupee, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { getLoyalty, saveLoyalty, type CatalogueScope, type LoyaltyConfig } from "@/lib/loyaltyClient";

const REWARD_TYPES: { id: LoyaltyConfig["rewardType"]; label: "ownLoyaltyRewardFree" | "ownLoyaltyRewardPercent" | "ownLoyaltyRewardFixed"; Icon: typeof Gift }[] = [
  { id: "FREE_SERVICE", label: "ownLoyaltyRewardFree", Icon: Gift },
  { id: "PERCENTAGE", label: "ownLoyaltyRewardPercent", Icon: Percent },
  { id: "FIXED", label: "ownLoyaltyRewardFixed", Icon: IndianRupee },
];

/** The punch-card settings form. Lives on its own data (it is not part of the branding payload), so it loads its config itself. */
export function LoyaltyForm({ scope }: { scope: CatalogueScope }) {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR(["loyalty", scope], () => getLoyalty(scope));
  if (isLoading || !data) return <p className="text-sm text-zinc-400">{t("ownCatLoading")}</p>;
  // Remount on scope change so the draft starts from the freshly loaded config.
  return <LoyaltyFields key={scope} scope={scope} config={data.config} onSaved={() => mutate()} />;
}

type Draft = LoyaltyConfig;

/** The reward as the customer will read it, built from the owner's choices (used in the live preview). */
function rewardText(d: Draft): string {
  if (d.rewardLabel.trim()) return d.rewardLabel.trim();
  if (d.rewardType === "PERCENTAGE") return `${d.rewardValue || 0}% off`;
  if (d.rewardType === "FIXED") return `₹${d.rewardValue || 0} off`;
  return "Free service";
}

function LoyaltyFields({ scope, config, onSaved }: { scope: CatalogueScope; config: LoyaltyConfig; onSaved: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(config);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const showValue = draft.rewardType !== "FREE_SERVICE";
  const need = Math.max(1, Math.min(draft.stampsNeeded || 1, 50));
  const previewDots = Math.min(need, 12); // keep the preview tidy for long cards

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveLoyalty(scope, draft);
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
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("ownLoyaltyHint")}</p>

      {/* Enable: a prominent switch row */}
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white"><Gift className="h-5 w-5" /></span>
          <span className="text-sm font-medium">{t("ownLoyaltyEnable")}</span>
        </span>
        <button type="button" role="switch" aria-checked={draft.enabled} aria-label={t("ownLoyaltyEnable")} onClick={() => set("enabled", !draft.enabled)}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${draft.enabled ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-600"}`}>
          <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${draft.enabled ? "translate-x-7" : "translate-x-1"}`} />
        </button>
      </label>

      {/* Live preview — exactly what a customer sees as their card fills */}
      <div className="rounded-xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-4 dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-800/50">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{t("ownLoyaltyPreview")}</p>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"><Gift className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{rewardText(draft)}</p>
            <p className="text-xs text-zinc-500">{t("catLoyaltyProgress").replace("{have}", "3").replace("{need}", String(need))}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
          {Array.from({ length: previewDots }).map((_, i) => (
            <span key={i} className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] ${i < 3 ? "border-transparent bg-indigo-600 text-white shadow-sm" : "border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-600"}`}>
              {i < 3 ? <Scissors className="h-3 w-3" /> : i + 1}
            </span>
          ))}
          {need > previewDots && <span className="self-center text-xs text-zinc-400">+{need - previewDots}</span>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="loyalty-stamps">{t("ownLoyaltyStamps")}</Label>
        <Input id="loyalty-stamps" type="number" min={2} max={50} value={draft.stampsNeeded} onChange={(e) => set("stampsNeeded", Number(e.target.value))} className="max-w-32" />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("ownLoyaltyReward")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("ownLoyaltyReward")}>
          {REWARD_TYPES.map(({ id, label, Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={draft.rewardType === id} onClick={() => set("rewardType", id)}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${draft.rewardType === id ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300" : "border-zinc-300 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"}`}>
              <Icon className="h-4 w-4" /> {t(label)}
            </button>
          ))}
        </div>
      </fieldset>

      {showValue && (
        <div className="space-y-1.5">
          <Label htmlFor="loyalty-value">{draft.rewardType === "PERCENTAGE" ? t("ownLoyaltyRewardPercent") : t("ownLoyaltyRewardFixed")}</Label>
          <Input id="loyalty-value" type="number" min={1} value={draft.rewardValue} onChange={(e) => set("rewardValue", Number(e.target.value))} className="max-w-32" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="loyalty-label">{t("ownLoyaltyRewardLabel")}</Label>
        <Input id="loyalty-label" value={draft.rewardLabel} maxLength={60} onChange={(e) => set("rewardLabel", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="loyalty-valid">{t("ownLoyaltyValidDays")}</Label>
        <Input id="loyalty-valid" type="number" min={0} max={365} value={draft.rewardValidDays} onChange={(e) => set("rewardValidDays", Number(e.target.value))} className="max-w-32" />
      </div>

      <Button type="submit" disabled={saving} className="h-11">{saving ? t("ownSaving") : t("save")}</Button>
    </form>
  );
}
