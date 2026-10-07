"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/catalogue/owner/ConfirmDialog";
import { ScopeSwitch } from "@/components/catalogue/owner/ScopeSwitch";
import { catalogueApi, useOwnerCatalogue, useShopOwnership, type CategoryDoc } from "@/lib/catalogueClient";
import { useCatalogueScope } from "@/lib/useCatalogueScope";
import { useTranslation } from "@/lib/i18n";

const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6";

/** Rename inline: the field saves when it loses focus or Enter is pressed, and only if the name really changed. */
function CategoryName({ category, disabled, onSave }: { category: CategoryDoc; disabled: boolean; onSave: (name: string) => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(category.name);
  const commit = () => { const v = value.trim(); if (v.length >= 2 && v !== category.name) onSave(v); else setValue(category.name); };
  return <Input aria-label={t("ocatNameOf").replace("{name}", category.name)} value={value} maxLength={60} disabled={disabled} onChange={(e) => setValue(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />;
}

export default function CatalogueCategoriesPage() {
  const { t } = useTranslation();
  const { canManageShop: isShopOwner, shop } = useShopOwnership();
  const [scope, setScope] = useCatalogueScope(isShopOwner);
  const { categories, services, settings, refresh, loading } = useOwnerCatalogue(scope);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CategoryDoc | null>(null);
  const [moveTo, setMoveTo] = useState("");

  const cats = useMemo(() => categories.data ?? [], [categories.data]);
  const countIn = (id: string) => (services.data ?? []).filter((s) => s.categoryId === id).length;
  const backQuery = scope === "shop" ? "?scope=shop" : "";
  const plan = settings.data?.plan;

  const run = async (id: string, action: () => Promise<unknown>, doneMessage?: string): Promise<boolean> => {
    setBusyId(id);
    try {
      await action();
      await refresh();
      if (doneMessage) toast.add({ title: t("ownDone"), description: doneMessage, type: "success" });
      return true;
    } catch (err) {
      toast.add({ title: t("ownCouldNotDoThat"), description: (err as Error).message, type: "error" });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.add({ title: t("ocatNameNeeded"), description: t("ocatNameNeededDesc"), type: "error" }); return; }
    setAdding(true);
    const ok = await run("new", () => catalogueApi("POST", "/api/barber/catalogue/categories", scope, { name: name.trim() }), t("ocatAdded"));
    if (ok) setName("");
    setAdding(false);
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...cats];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void run(cats[index]._id, () => catalogueApi("POST", "/api/barber/catalogue/reorder", scope, { type: "category", ids: next.map((c) => c._id) }));
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const inside = countIn(toDelete._id);
    const ok = await run(toDelete._id, () => catalogueApi("DELETE", `/api/barber/catalogue/categories/${toDelete._id}${inside > 0 ? `?moveTo=${moveTo}` : ""}`, scope), inside > 0 ? t("ocatDelMoved") : t("ocatDeleted"));
    if (ok) { setToDelete(null); setMoveTo(""); }
  };

  const others = toDelete ? cats.filter((c) => c._id !== toDelete._id) : [];
  const deleteCount = toDelete ? countIn(toDelete._id) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <Link href={`/dashboard/catalogue${backQuery}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"><ArrowLeft className="h-4 w-4" /> {t("ownCatalogue")}</Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t("ownCategories")}</h1>
        <p className="mt-1 text-zinc-500">{t("ocatSub")}</p>
      </div>

      {isShopOwner && shop && <ScopeSwitch scope={scope} onChange={setScope} shopName={shop.name} />}

      <form onSubmit={add} className={`${card} flex flex-wrap items-end gap-3`} noValidate>
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <Label htmlFor="new-category">{t("ocatNew")}</Label>
          <Input id="new-category" value={name} maxLength={60} placeholder={t("ocatPh")} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" className="h-11" disabled={adding || (!!plan && cats.length >= plan.maxCategories)}>{adding ? t("ocatAdding") : t("ocatAdd")}</Button>
        {plan && <p className="basis-full text-xs text-zinc-500">{t("ocatUsed").replace("{n}", String(cats.length)).replace("{max}", String(plan.maxCategories)).replace("{tier}", plan.tier.toLowerCase())}</p>}
      </form>

      <section className={card} aria-label={t("ocatAria")}>
        {categories.error ? <p role="alert" className="text-red-700">{(categories.error as Error).message}</p> : loading ? <p className="animate-pulse text-zinc-400">{t("ownLoading")}</p> : cats.length === 0 ? (
          <p className="text-center text-zinc-500">{t("ocatNone")}</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {cats.map((c, i) => (
              <li key={c._id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-[10rem] flex-1">
                  <CategoryName category={c} disabled={busyId === c._id} onSave={(v) => void run(c._id, () => catalogueApi("PATCH", `/api/barber/catalogue/categories/${c._id}`, scope, { name: v }), t("ocatRenamed"))} />
                  <p className="mt-1 text-xs text-zinc-500">{t("ocatServicesN").replace("{n}", String(countIn(c._id)))}</p>
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="h-5 w-5" checked={c.isPublished} disabled={busyId === c._id} onChange={(e) => void run(c._id, () => catalogueApi("PATCH", `/api/barber/catalogue/categories/${c._id}`, scope, { isPublished: e.target.checked }))} />
                  {t("ocatVisible")}
                </label>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label={t("ownMoveUp").replace("{name}", c.name)} disabled={i === 0 || busyId !== null} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button variant="ghost" size="icon" aria-label={t("ownMoveDown").replace("{name}", c.name)} disabled={i === cats.length - 1 || busyId !== null} onClick={() => move(i, 1)}><ArrowDown /></Button>
                  <Button variant="ghost" size="icon" aria-label={t("ownDeleteX").replace("{name}", c.name)} className="text-red-600" onClick={() => { setToDelete(c); setMoveTo(cats.find((o) => o._id !== c._id)?._id ?? ""); }}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!toDelete}
        title={t("ocatDelTitle")}
        description={(deleteCount > 0 ? t("ocatDelDescN") : t("ocatDelDescEmpty")).replace("{name}", toDelete?.name ?? "").replace("{n}", String(deleteCount))}
        confirmLabel={t("ocatDelBtn")}
        busy={busyId !== null}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      >
        {deleteCount > 0 && (others.length === 0 ? (
          <p role="alert" className="text-sm text-red-700">{t("ocatNoOther")}</p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="move-to">{t("ocatMoveTo")}</Label>
            <select id="move-to" className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              {others.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
            </select>
          </div>
        ))}
      </ConfirmDialog>
    </div>
  );
}
