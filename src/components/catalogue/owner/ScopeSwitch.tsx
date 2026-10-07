"use client";

import type { CatalogueScope } from "@/lib/catalogueClient";
import { useTranslation } from "@/lib/i18n";

/** For a shop owner: edit his own catalogue, or the shop-wide one that customers see on the shop page. */
export function ScopeSwitch({ scope, onChange, shopName }: { scope: CatalogueScope; onChange: (s: CatalogueScope) => void; shopName: string }) {
  const { t } = useTranslation();
  const options: { id: CatalogueScope; label: string; hint: string }[] = [
    { id: "me", label: t("ownMyCatalogue"), hint: t("ownMyCatalogueHint") },
    { id: "shop", label: t("ownShopLabel").replace("{name}", shopName), hint: t("ownShopHint") },
  ];
  return (
    <div role="radiogroup" aria-label={t("ownWhichCatalogue")} className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={scope === o.id} onClick={() => onChange(o.id)}
          className={`min-h-14 rounded-xl border p-3 text-left transition-colors ${scope === o.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"}`}>
          <span className="block text-sm font-semibold">{o.label}</span>
          <span className={`block text-xs ${scope === o.id ? "text-zinc-300" : "text-zinc-500"}`}>{o.hint}</span>
        </button>
      ))}
    </div>
  );
}
