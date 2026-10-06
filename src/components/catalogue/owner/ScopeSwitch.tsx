"use client";

import type { CatalogueScope } from "@/lib/catalogueClient";

/** For a shop owner: edit his own catalogue, or the shop-wide one that customers see on the shop page. */
export function ScopeSwitch({ scope, onChange, shopName }: { scope: CatalogueScope; onChange: (s: CatalogueScope) => void; shopName: string }) {
  const options: { id: CatalogueScope; label: string; hint: string }[] = [
    { id: "me", label: "My catalogue", hint: "Shown on your own booking page" },
    { id: "shop", label: `${shopName} (shop)`, hint: "Shown on the shop page for all barbers" },
  ];
  return (
    <div role="radiogroup" aria-label="Which catalogue to edit" className="grid gap-2 sm:grid-cols-2">
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
