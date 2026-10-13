"use client";

import { useState } from "react";
import useSWR from "swr";
import { Cake, Gift, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { getBirthday, saveBirthday, type AutoOfferConfig, type CatalogueScope } from "@/lib/birthdayClient";

/** The automatic birthday-greeting settings. Loads its own config (it is not part of the branding payload). */
export function BirthdayForm({ scope }: { scope: CatalogueScope }) {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR(["birthday", scope], () => getBirthday(scope));
  if (isLoading || !data) return <p className="text-sm text-zinc-400">{t("ownCatLoading")}</p>;
  // Remount on scope change so the draft starts from the freshly loaded config.
  return <BirthdayFields key={scope} scope={scope} config={data.config} onSaved={() => mutate()} />;
}

type Draft = AutoOfferConfig;

function BirthdayFields({ scope, config, onSaved }: { scope: CatalogueScope; config: AutoOfferConfig; onSaved: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(config);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const previewMessage = draft.birthdayMessage.trim() || t("ownBirthdayMessagePlaceholder");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveBirthday(scope, draft);
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
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("ownBirthdayHint")}</p>

      {/* Enable: a prominent switch row */}
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-600 text-white"><Cake className="h-5 w-5" /></span>
          <span className="text-sm font-medium">{t("ownBirthdayEnable")}</span>
        </span>
        <button type="button" role="switch" aria-checked={draft.birthdayEnabled} aria-label={t("ownBirthdayEnable")} onClick={() => set("birthdayEnabled", !draft.birthdayEnabled)}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${draft.birthdayEnabled ? "bg-pink-600" : "bg-zinc-300 dark:bg-zinc-600"}`}>
          <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${draft.birthdayEnabled ? "translate-x-7" : "translate-x-1"}`} />
        </button>
      </label>

      {/* Live preview — the greeting card the customer will see */}
      <div className="rounded-xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-4 dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-800/50">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{t("ownBirthdayPreview")}</p>
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-600 text-white"><PartyPopper className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("catBirthdayTitle").replace("{name}", "Riya")}</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{previewMessage}</p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="birthday-message" className="flex items-center gap-1.5"><Gift className="h-4 w-4 text-pink-600" />{t("ownBirthdayMessage")}</Label>
        <Textarea id="birthday-message" value={draft.birthdayMessage} maxLength={120} rows={3} placeholder={t("ownBirthdayMessagePlaceholder")}
          onChange={(e) => set("birthdayMessage", e.target.value)} />
        <p className="text-xs text-zinc-400">{draft.birthdayMessage.length}/120</p>
      </div>

      <Button type="submit" disabled={saving} className="h-11">{saving ? t("ownSaving") : t("save")}</Button>
    </form>
  );
}
