"use client";

import { Scissors } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { PublicService } from "@/lib/cataloguePublic";

/** In the booking view: the service the customer picked in the catalogue, with a way to change or remove it. */
export function SelectedServiceChip({ service, onChange, onRemove, restrictedToSomeBarbers }: { service: PublicService; onChange: () => void; onRemove: () => void; restrictedToSomeBarbers?: boolean }) {
  const { t } = useTranslation();
  const price = service.priceType === "ASK_SHOP" || service.finalPrice === null ? "" : ` · ₹${service.finalPrice}`;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3" role="status">
      <Scissors className="h-5 w-5 shrink-0 text-indigo-700" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-indigo-800">{t("catSelectedService")}</p>
        <p className="truncate text-sm font-semibold text-indigo-950">{service.name}{price} · {t("catMinutes").replace("{n}", String(service.durationMinutes))}</p>
        {restrictedToSomeBarbers && <p className="text-xs text-indigo-800">{t("catOnlyThese")}</p>}
      </div>
      <button type="button" onClick={onChange} className="min-h-11 px-2 text-sm font-medium text-indigo-800 underline">{t("catChangeService")}</button>
      <button type="button" onClick={onRemove} className="min-h-11 px-2 text-sm font-medium text-zinc-600">{t("catRemoveService")}</button>
    </div>
  );
}
