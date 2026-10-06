"use client";

import { useMemo, useState } from "react";
import { Clock, Heart, MapPin, MessageCircle, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { getWhatsAppNumber } from "@/lib/phone";
import { useFavourites } from "@/lib/useFavourites";
import { OfferNotify } from "@/components/catalogue/OfferNotify";
import type { PublicCatalogue as Catalogue, PublicService } from "@/lib/cataloguePublic";

const ACCENT: Record<string, { bar: string; chipOn: string; badge: string }> = {
  indigo: { bar: "bg-indigo-600", chipOn: "bg-indigo-600 text-white", badge: "bg-indigo-100 text-indigo-800" },
  emerald: { bar: "bg-emerald-600", chipOn: "bg-emerald-600 text-white", badge: "bg-emerald-100 text-emerald-800" },
  rose: { bar: "bg-rose-600", chipOn: "bg-rose-600 text-white", badge: "bg-rose-100 text-rose-800" },
  amber: { bar: "bg-amber-500", chipOn: "bg-amber-500 text-zinc-900", badge: "bg-amber-100 text-amber-900" },
  sky: { bar: "bg-sky-600", chipOn: "bg-sky-600 text-white", badge: "bg-sky-100 text-sky-800" },
  zinc: { bar: "bg-zinc-900", chipOn: "bg-zinc-900 text-white", badge: "bg-zinc-200 text-zinc-800" },
};

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const rupees = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

/** A picture that never leaves a broken-image icon: a calm placeholder shows while loading, and if it cannot load. */
const RATIO: Record<string, string> = { portrait: "aspect-[4/5]", square: "aspect-square", wide: "aspect-[16/10]" };

function CardImage({ src, alt, ratio, className = "" }: { src?: string; alt: string; ratio: string; className?: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">(src ? "loading" : "failed");
  return (
    <div className={`relative w-full overflow-hidden bg-zinc-100 ${RATIO[ratio] || RATIO.portrait} ${className}`}>
      {state !== "ready" && <div aria-hidden="true" className={`absolute inset-0 flex items-center justify-center text-4xl font-bold text-zinc-300 ${state === "loading" ? "animate-pulse" : ""}`}>{alt.charAt(0).toUpperCase()}</div>}
      {src && state !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element -- owner-supplied addresses; sizes are fixed by the card
        <img src={src} alt={alt} loading="lazy" decoding="async" onLoad={() => setState("ready")} onError={() => setState("failed")} className={`h-full w-full object-cover transition-opacity duration-300 ${state === "ready" ? "opacity-100" : "opacity-0"}`} />
      )}
    </div>
  );
}

function ServiceCard({ service, accent, whatsapp, shopName, onBook, list, ratio, saved, onToggleSave }: { service: PublicService; accent: (typeof ACCENT)[string]; whatsapp: string; shopName: string; onBook: (s: PublicService) => void; list: boolean; ratio: string; saved: boolean; onToggleSave: (id: string) => void }) {
  const { t } = useTranslation();
  const badges = [
    service.badges.featured && t("catFeatured"),
    service.badges.popular && t("catPopular"),
    service.badges.isNew && t("catNew"),
    service.badges.premium && t("catPremium"),
  ].filter(Boolean) as string[];

  const discount = service.discount ? (service.discount.type === "PERCENTAGE" ? `${service.discount.value}% ${t("catOff")}` : `${rupees(service.discount.value)} ${t("catOff")}`) : null;
  const hasPrice = service.priceType !== "ASK_SHOP" && service.finalPrice !== null;
  const askLink = whatsapp ? `https://wa.me/${getWhatsAppNumber(whatsapp)}?text=${encodeURIComponent(t("catWhatsappMsg").replace("{service}", service.name))}` : "";

  return (
    <article className={`flex overflow-hidden ${list ? "flex-row" : "flex-col"} rounded-2xl border border-zinc-200 bg-white shadow-sm`} aria-label={service.name}>
      <div className={`relative ${list ? "w-32 shrink-0 sm:w-40" : ""}`}>
        <CardImage src={service.images[0]} alt={service.name} ratio={list ? "square" : ratio} className={list ? "h-full" : ""} />
        {badges.length > 0 && (
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {badges.map((b) => <span key={b} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${accent.badge}`}>{b}</span>)}
          </div>
        )}
        {discount && <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{discount}</span>}
        <button type="button" aria-pressed={saved} aria-label={(saved ? t("catUnsaveAria") : t("catSaveAria")).replace("{name}", service.name)} onClick={() => onToggleSave(service.id)} className="absolute bottom-1 right-1 flex h-11 w-11 items-center justify-center rounded-full">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow"><Heart className={`h-4 w-4 ${saved ? "fill-red-500 text-red-500" : "text-zinc-600"}`} aria-hidden="true" /></span>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-base font-semibold text-zinc-900">{service.name}</h3>
        {service.offer && <p className="flex items-center gap-1 text-xs font-semibold text-red-700"><Tag className="h-3.5 w-3.5" aria-hidden="true" />{service.offer.title} · {t("catOfferEnds").replace("{date}", fmtDate(service.offer.endsOn))}</p>}
        {service.description && <p className="line-clamp-3 text-sm text-zinc-600">{service.description}</p>}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <p className="flex items-center gap-1 text-sm text-zinc-500"><Clock className="h-4 w-4" aria-hidden="true" />{t("catMinutes").replace("{n}", String(service.durationMinutes))}</p>
          <div className="text-right">
            {hasPrice ? (
              <>
                {service.priceType === "STARTING_FROM" && <p className="text-xs text-zinc-500">{t("catStartingFrom")}</p>}
                {/* Show the old price crossed out only when there really is a discount or an owner-given original price. */}
                {(discount || (service.originalPrice !== null && service.price !== null && service.originalPrice > service.price)) && (
                  <p className="text-xs text-zinc-400 line-through">{rupees(discount ? (service.price as number) : (service.originalPrice as number))}</p>
                )}
                <p className="text-lg font-bold text-zinc-900">{rupees(discount ? (service.finalPrice as number) : (service.price as number))}</p>
              </>
            ) : <p className="text-sm font-medium text-zinc-600">{t("catAskShop")}</p>}
          </div>
        </div>

        <Button type="button" className="h-12 w-full text-base" onClick={() => onBook(service)}>{t("catBookService")}</Button>
        {askLink && (
          <a href={askLink} target="_blank" rel="noreferrer" aria-label={`${t("catAskWhatsapp")}: ${service.name} (${shopName})`} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-green-200 text-sm font-medium text-green-700 hover:bg-green-50">
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> {t("catAskWhatsapp")}
          </a>
        )}
      </div>
    </article>
  );
}

export function CatalogueSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="aspect-[4/5] animate-pulse bg-zinc-100" />
          <div className="space-y-3 p-4"><div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100" /><div className="h-3 w-full animate-pulse rounded bg-zinc-100" /><div className="h-12 w-full animate-pulse rounded-lg bg-zinc-100" /></div>
        </div>
      ))}
    </div>
  );
}

/** The premium catalogue: branding, category chips and service cards. "Book this service" hands the choice to the booking view. */
export function PublicCatalogue({ catalogue, loading, error, onBook, allowedBarberIds, notifyTarget }: { catalogue: Catalogue | null; loading: boolean; error?: boolean; onBook: (s: PublicService) => void; allowedBarberIds?: string[]; notifyTarget?: { kind: "barber" | "shop"; slug: string } }) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const favourites = useFavourites();

  const accent = ACCENT[catalogue?.branding.accent || "indigo"] || ACCENT.indigo;
  const categories = useMemo(() => {
    if (!catalogue) return [];
    // On a shop page after choosing one barber, only the services that barber performs (none named = any barber).
    return catalogue.categories
      .map((c) => ({ ...c, services: allowedBarberIds?.length ? c.services.filter((s) => s.barberIds.length === 0 || s.barberIds.some((b) => allowedBarberIds.includes(b))) : c.services }))
      .filter((c) => c.services.length > 0);
  }, [catalogue, allowedBarberIds]);
  const savedCount = categories.reduce((n, c) => n + c.services.filter((s) => favourites.has(s.id)).length, 0);
  const shown = activeCategory === "SAVED"
    ? categories.map((c) => ({ ...c, services: c.services.filter((s) => favourites.has(s.id)) })).filter((c) => c.services.length > 0)
    : activeCategory === "ALL" ? categories : categories.filter((c) => c.id === activeCategory);
  const b = catalogue?.branding;

  return (
    <section id="view-panel-catalogue" role="tabpanel" aria-labelledby="view-tab-catalogue" className="pb-8">
      {b && (b.coverUrl || b.logoUrl || b.intro || b.address || b.instagram || b.facebook) && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {b.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- owner-supplied address
            <img src={b.coverUrl} alt="" loading="lazy" decoding="async" className="h-32 w-full object-cover sm:h-44" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}
          <div className="flex items-start gap-3 p-4">
            {b.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- owner-supplied address
              <img src={b.logoUrl} alt={b.name} loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-full border border-zinc-200 object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}
            <div className="min-w-0 text-sm text-zinc-600">
              <div className={`mb-2 h-1 w-10 rounded-full ${accent.bar}`} aria-hidden="true" />
              {b.intro && <p className="mb-2 text-zinc-700">{b.intro}</p>}
              {b.address && <p className="flex items-start gap-1"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{b.address}{b.mapUrl && <> · <a href={b.mapUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">{t("catMap")}</a></>}</span></p>}
              {(b.instagram || b.facebook) && (
                <div className="mt-2 flex gap-4">
                  {b.instagram && <a href={b.instagram} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-medium text-blue-700 underline">Instagram</a>}
                  {b.facebook && <a href={b.facebook} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-medium text-blue-700 underline">Facebook</a>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {catalogue && catalogue.offers.length > 0 && (
        <div className="mb-6 space-y-2" role="region" aria-label={t("catOffersTitle")}>
          {catalogue.offers.map((o) => (
            <div key={o.id} className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3">
              <Tag className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-red-900">{o.title} · {o.discount.type === "PERCENTAGE" ? `${o.discount.value}% ${t("catOff")}` : `${rupees(o.discount.value)} ${t("catOff")}`}</p>
                {o.description && <p className="text-red-900/80">{o.description}</p>}
                <p className="text-xs text-red-800/70">{t("catOfferEnds").replace("{date}", fmtDate(o.endsOn))}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && !catalogue ? <CatalogueSkeleton /> : error ? (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">{t("catLoadError")}</p>
      ) : categories.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-500">{t("catEmpty")}</p>
      ) : (
        <>
          {(categories.length > 1 || savedCount > 0) && (
            <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={t("catAllCategories")}>
              {[{ id: "ALL", name: t("catAllCategories") }, ...(savedCount > 0 ? [{ id: "SAVED", name: t("catSavedFilter").replace("{n}", String(savedCount)) }] : []), ...categories.map((c) => ({ id: c.id, name: c.name }))].map((c) => (
                <button key={c.id} type="button" aria-pressed={activeCategory === c.id} onClick={() => setActiveCategory(c.id)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium ${activeCategory === c.id ? `${accent.chipOn} border-transparent` : "border-zinc-300 bg-white text-zinc-700"}`}>{c.name}</button>
              ))}
            </div>
          )}
          <div className="space-y-8">
            {shown.map((c) => (
              <div key={c.id}>
                <h2 className="mb-1 text-lg font-bold text-zinc-900">{c.name}</h2>
                {c.description && <p className="mb-3 text-sm text-zinc-500">{c.description}</p>}
                <div className={`grid gap-4 ${b?.layout === "list" ? "" : "sm:grid-cols-2"}`}>
                  {c.services.map((s) => <ServiceCard list={b?.layout === "list"} ratio={b?.imageRatio || "portrait"} key={s.id} service={s} accent={accent} whatsapp={b?.whatsapp || b?.phone || ""} shopName={b?.name || ""} onBook={onBook} saved={favourites.has(s.id)} onToggleSave={favourites.toggle} />)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {notifyTarget && catalogue?.available && <OfferNotify kind={notifyTarget.kind} slug={notifyTarget.slug} name={b?.name || ""} />}
    </section>
  );
}
