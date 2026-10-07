"use client";

import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";

interface Member { _id: string; name: string; barberCode: string }
interface Grant { userId: string; catalogue: boolean; analytics: boolean }

/**
 * Shop owner: choose what each other barber of the shop may do. "Catalogue" = services, categories, pictures and offers
 * of the shop; with the Business plan staff can also change branding / the on-off switch, send customer messages and see
 * the shop numbers. Access follows the owner's plan: it pauses if the plan lapses.
 */
export function StaffAccess({ members, ownerId, staff, level, onChanged }: { members: Member[]; ownerId: string; staff: Grant[]; level: "NONE" | "BASIC" | "FULL"; onChanged: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const others = members.filter((m) => m._id !== ownerId);
  if (others.length === 0) return null;
  const grantOf = (id: string) => staff.find((s) => s.userId === id) ?? { userId: id, catalogue: false, analytics: false };

  const set = async (id: string, patch: Partial<Grant>) => {
    const next = { ...grantOf(id), ...patch };
    setBusy(id);
    try {
      const res = await fetch("/api/barber/shop/staff", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id, catalogue: next.catalogue, analytics: next.analytics }) });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(j?.error?.message || t("ownCouldNotSave"));
      onChanged();
    } catch (e) { toast.add({ title: t("ownStaffChangeFail"), description: (e as Error).message, type: "error" }); }
    finally { setBusy(null); }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8" aria-labelledby="staff-heading">
      <h2 id="staff-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("ownStaffHeading")}</h2>
      <p className="text-sm text-zinc-500">
        {level === "NONE" ? t("ownStaffNone") : level === "BASIC" ? t("ownStaffBasic") : t("ownStaffFull")}
      </p>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {others.map((m) => {
          const g = grantOf(m._id);
          return (
            <li key={m._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div><p className="font-medium">{m.name}</p><p className="text-xs text-zinc-500">{m.barberCode}</p></div>
              <div className="flex flex-wrap gap-4">
                <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" disabled={level === "NONE" || busy === m._id} checked={g.catalogue} onChange={(e) => set(m._id, { catalogue: e.target.checked })} aria-label={t("ownStaffMayEdit").replace("{name}", m.name)} /> {t("ownStaffEdit")}</label>
                <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" disabled={level !== "FULL" || busy === m._id} checked={g.analytics} onChange={(e) => set(m._id, { analytics: e.target.checked })} aria-label={t("ownStaffMaySee").replace("{name}", m.name)} /> {t("ownStaffSee")}</label>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
