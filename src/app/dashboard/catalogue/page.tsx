"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, ExternalLink, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { BrandingForm } from "@/components/catalogue/owner/BrandingForm";
import { ConfirmDialog } from "@/components/catalogue/owner/ConfirmDialog";
import { ScopeSwitch } from "@/components/catalogue/owner/ScopeSwitch";
import { catalogueApi, useMySlug, useOwnerCatalogue, useShopOwnership, type ServiceDoc } from "@/lib/catalogueClient";
import { useCatalogueScope } from "@/lib/useCatalogueScope";
import { copyText, shareOrCopy } from "@/lib/shareLink";
import { useTranslation } from "@/lib/i18n";

const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6";

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const { t } = useTranslation();
  const pct = Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><span className={pct >= 100 ? "font-semibold text-red-600" : "text-zinc-500"}>{t("ownMeterOf").replace("{used}", String(used)).replace("{max}", String(max))}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className={`h-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange-500" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CatalogueManagerPage() {
  const { t } = useTranslation();
  const { canManageShop: isShopOwner, shop } = useShopOwnership();
  const [scope, setScope] = useCatalogueScope(isShopOwner);
  const mine = useMySlug();
  const { categories, services, settings, refresh, loading } = useOwnerCatalogue(scope);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ServiceDoc | null>(null);
  const [toggling, setToggling] = useState(false);

  const data = settings.data;
  const cats = useMemo(() => categories.data ?? [], [categories.data]);
  const list = useMemo(() => services.data ?? [], [services.data]);
  const grouped = useMemo(() => cats.map((c) => ({ category: c, services: list.filter((s) => s.categoryId === c._id) })), [cats, list]);
  const scopeQuery = scope === "shop" ? "?scope=shop" : "";

  const publicPath = scope === "shop" ? (shop ? `/s/${shop.slug}` : "") : mine?.slug ? `/b/${mine.slug}` : "";
  const publicUrl = publicPath && typeof window !== "undefined" ? `${window.location.origin}${publicPath}?view=catalogue` : "";

  const run = async (id: string, action: () => Promise<unknown>, doneMessage?: string) => {
    setBusyId(id);
    try {
      await action();
      await refresh();
      if (doneMessage) toast.add({ title: t("ownDone"), description: doneMessage, type: "success" });
    } catch (err) {
      toast.add({ title: t("ownCouldNotDoThat"), description: (err as Error).message, type: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const toggleEnabled = async () => {
    if (!data) return;
    setToggling(true);
    try {
      await catalogueApi("PUT", "/api/barber/catalogue/settings", scope, { enabled: !data.settings.enabled });
      await settings.mutate();
    } catch (err) {
      toast.add({ title: t("ownCouldNotChange"), description: (err as Error).message, type: "error" });
    } finally {
      setToggling(false);
    }
  };

  const move = (categoryServices: ServiceDoc[], index: number, direction: -1 | 1) => {
    const next = [...categoryServices];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void run(categoryServices[index]._id, () => catalogueApi("POST", "/api/barber/catalogue/reorder", scope, { type: "service", ids: next.map((s) => s._id) }));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <Link href="/dashboard/settings" className="inline-flex min-h-11 items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"><ArrowLeft className="h-4 w-4" /> {t("ownSettings")}</Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t("ownCatTitle")}</h1>
        <p className="mt-1 text-zinc-500">{t("ownCatSub")}</p>
      </div>

      {isShopOwner && shop && <ScopeSwitch scope={scope} onChange={setScope} shopName={shop.name} />}

      {settings.error ? (
        <div role="alert" className={`${card} border-red-200 text-red-700`}>{(settings.error as Error).message}</div>
      ) : loading || !data ? (
        <div className={`${card} animate-pulse text-zinc-400`}>{t("ownCatLoading")}</div>
      ) : (
        <>
          <section className={`${card} space-y-4`} aria-labelledby="status-heading">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 id="status-heading" className="text-lg font-semibold">{t("ownShowCat")}</h2>
                <p className="text-sm text-zinc-500">{data.settings.enabled ? t("ownCatOn") : t("ownCatOff")}</p>
              </div>
              <button type="button" role="switch" aria-checked={data.settings.enabled} aria-label={t("ownShowCat")} disabled={toggling} onClick={toggleEnabled}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${data.settings.enabled ? "bg-green-600" : "bg-zinc-300"}`}>
                <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${data.settings.enabled ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Meter label={t("ownMeterCategories")} used={data.usage.categories} max={data.plan.maxCategories} />
              <Meter label={t("ownMeterPublished")} used={data.usage.publishedServices} max={data.plan.maxServices} />
            </div>
            <p className="text-xs text-zinc-500">{t("ownPlanLine").replace("{tier}", data.plan.tier.charAt(0) + data.plan.tier.slice(1).toLowerCase()).replace("{n}", String(data.plan.maxImagesPerService)).replace("{videos}", data.plan.maxVideosPerService > 0 ? t("ownPlanVideos").replace("{n}", String(data.plan.maxVideosPerService)) : t("ownPlanNoVideos"))}</p>
          </section>

          <section className={`${card} space-y-3`} aria-labelledby="share-heading">
            <h2 id="share-heading" className="text-lg font-semibold">{t("ownPreviewShare")}</h2>
            {publicUrl ? (
              <>
                <p className="break-all text-sm text-blue-700">{publicUrl}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="h-11" onClick={() => window.open(publicUrl, "_blank", "noopener")}><ExternalLink /> {t("ownPreview")}</Button>
                  <Button variant="outline" className="h-11" onClick={async () => { const ok = await copyText(publicUrl); toast.add(ok ? { title: t("ownCopied"), description: t("ownCatLinkCopied"), type: "success" } : { title: t("ownCouldNotCopy"), description: publicUrl, type: "error" }); }}><Copy /> {t("ownCopyLink")}</Button>
                  <Button variant="outline" className="h-11" onClick={async () => { const r = await shareOrCopy({ title: scope === "shop" && shop ? shop.name : mine?.name || t("ownCatalogue"), text: t("ownShareText"), url: publicUrl }); if (r === "copied") toast.add({ title: t("ownCopied"), description: t("ownShareCopied"), type: "success" }); }}><Share2 /> {t("ownShare")}</Button>
                </div>
              </>
            ) : <p className="text-sm text-zinc-500">{t("ownLinkAppear")}</p>}
          </section>

          <section className={`${card} space-y-3`} aria-labelledby="grow-heading">
            <h2 id="grow-heading" className="text-lg font-semibold">{t("ownGrow")}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <Link href={`/dashboard/catalogue/offers${scopeQuery}`} className="rounded-xl border border-zinc-200 p-3 hover:border-zinc-400 dark:border-zinc-700"><span className="block text-sm font-semibold">{t("ownOffersMsgs")}</span><span className="block text-xs text-zinc-500">{t("ownOffersMsgsHint")}</span></Link>
              <Link href={`/dashboard/analytics${scopeQuery}`} className="rounded-xl border border-zinc-200 p-3 hover:border-zinc-400 dark:border-zinc-700"><span className="block text-sm font-semibold">{t("ownYourNumbers")}</span><span className="block text-xs text-zinc-500">{t("ownNumbersHint")}</span></Link>
            </div>
          </section>

          <section className={`${card} space-y-4`} aria-labelledby="services-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="services-heading" className="text-lg font-semibold">{t("ownServicesStyles")}</h2>
              <div className="flex gap-2">
                <Link href={`/dashboard/catalogue/categories${scopeQuery}`} className="inline-flex h-11 items-center rounded-lg border border-zinc-200 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">{t("ownCategories")}</Link>
                <Link href={`/dashboard/catalogue/services/new${scopeQuery}`} aria-disabled={cats.length === 0} className={`inline-flex h-11 items-center gap-1 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white ${cats.length === 0 ? "pointer-events-none opacity-50" : ""}`}><Plus className="h-4 w-4" /> {t("ownAddService")}</Link>
              </div>
            </div>

            {cats.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center">
                <p className="mb-3 text-zinc-600">{t("ownStartByCat")}</p>
                <Link href={`/dashboard/catalogue/categories${scopeQuery}`} className="inline-flex h-11 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white">{t("ownCreateCat")}</Link>
              </div>
            ) : (
              <div className="space-y-6">
                {grouped.map(({ category, services: items }) => (
                  <div key={category._id}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">{category.name}{!category.isPublished && <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs normal-case tracking-normal text-zinc-700">{t("ownHidden")}</span>}</h3>
                    {items.length === 0 ? <p className="text-sm text-zinc-400">{t("ownNoServicesInCat")}</p> : (
                      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                        {items.map((s, i) => (
                          <li key={s._id} className="flex flex-wrap items-center gap-3 p-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{s.name}</p>
                              <p className="text-xs text-zinc-500">{s.priceType === "ASK_SHOP" ? t("ownAskShop") : `${s.priceType === "STARTING_FROM" ? t("ownFromPrice") : ""}₹${s.price ?? 0}`} · {t("catMinutes").replace("{n}", String(s.durationMinutes))} {s.discountType && s.discountValue ? `· ${t("ownOffSuffix").replace("{v}", s.discountType === "PERCENTAGE" ? `${s.discountValue}%` : `₹${s.discountValue}`)}` : ""}</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.status === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-700"}`}>{s.status === "PUBLISHED" ? t("ownPublished") : t("ownDraft")}</span>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" aria-label={t("ownMoveUp").replace("{name}", s.name)} disabled={i === 0 || busyId !== null} onClick={() => move(items, i, -1)}><ArrowUp /></Button>
                              <Button variant="ghost" size="icon" aria-label={t("ownMoveDown").replace("{name}", s.name)} disabled={i === items.length - 1 || busyId !== null} onClick={() => move(items, i, 1)}><ArrowDown /></Button>
                              <Button variant="outline" size="sm" disabled={busyId === s._id} onClick={() => run(s._id, () => catalogueApi("PATCH", `/api/barber/catalogue/services/${s._id}`, scope, { status: s.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }), s.status === "PUBLISHED" ? t("ownMovedDrafts") : t("ownNowLive"))}>{s.status === "PUBLISHED" ? t("ownUnpublish") : t("ownPublish")}</Button>
                              <Link href={`/dashboard/catalogue/services/${s._id}/edit${scopeQuery}`} aria-label={t("ownEditX").replace("{name}", s.name)} className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:size-8"><Pencil className="h-4 w-4" /></Link>
                              <Button variant="ghost" size="icon" aria-label={t("ownDeleteX").replace("{name}", s.name)} className="text-red-600" onClick={() => setToDelete(s)}><Trash2 /></Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={card} aria-labelledby="brand-heading">
            <h2 id="brand-heading" className="mb-4 text-lg font-semibold">{t("ownBranding")}</h2>
            <BrandingForm key={`${scope}-${data.settings.accent}-${data.settings.logoUrl ?? ""}-${data.settings.coverUrl ?? ""}`} scope={scope} settings={data.settings} onSaved={() => settings.mutate()} />
          </section>
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t("ownDelSvcTitle")}
        description={toDelete ? t("ownDelSvcDesc").replace("{name}", toDelete.name) : ""}
        confirmLabel={t("ownDelSvcBtn")}
        busy={busyId !== null}
        onCancel={() => setToDelete(null)}
        onConfirm={() => { if (!toDelete) return; const target = toDelete; void run(target._id, () => catalogueApi("DELETE", `/api/barber/catalogue/services/${target._id}`, scope), t("ownSvcDeleted")).then(() => setToDelete(null)); }}
      />
    </div>
  );
}
