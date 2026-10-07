"use client";

import { Scissors } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { PublicService } from "@/lib/cataloguePublic";

/** In the booking view: the service the customer picked in the catalogue, with a way to change or remove it. */
export function SelectedServiceChip({ service, onChange, onRemove, restrictedToSomeBarbers }: { service: PublicService; onChange: () => void; onRemove: () => void; restrictedToSomeBarbers?: boolean }) {
  const { t } = useTranslation();
  const price = service.priceType === "ASK_SHOP" || service.finalPrice === null ? "" : ` · ₹${service.finalPrice}`;
  return (
    <div className="tp-selected" role="status">
      <Scissors className="tp-selected__icon" size={20} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="tp-selected__label">{t("catSelectedService")}</p>
        <p className="tp-selected__name">{service.name}{price} · {t("catMinutes").replace("{n}", String(service.durationMinutes))}</p>
        {restrictedToSomeBarbers && <p className="tp-selected__label">{t("catOnlyThese")}</p>}
      </div>
      <button type="button" className="tp-link" onClick={onChange}>{t("catChangeService")}</button>
      <button type="button" onClick={onRemove}>{t("catRemoveService")}</button>
    </div>
  );
}
