"use client";

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Clock, Heart, MessageCircle, Tag } from "lucide-react";
import { useTranslation, type Language } from "@/lib/i18n";
import { formatInLanguage } from "@/lib/dateLocale";
import { getWhatsAppNumber } from "@/lib/phone";
import { useFavourites } from "@/lib/useFavourites";
import { OfferNotify } from "@/components/catalogue/OfferNotify";
import type { PublicCatalogue as Catalogue, PublicService } from "@/lib/cataloguePublic";

const fmtDate = (d: string, language: Language) => formatInLanguage(new Date(`${d}T00:00:00`), "d MMM", language);
const rupees = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;
const RATIO: Record<string, string> = { portrait: "4 / 5", square: "1 / 1", wide: "16 / 10" };
/** Cards mounted at first, and added each time the customer scrolls near the end: a 150-service menu costs no more to open than a 20-service one. */
const CHUNK = 10;
const hide = (e: { currentTarget: HTMLImageElement }) => { e.currentTarget.style.display = "none"; };
const initial = (name: string) => (Array.from(name.trim())[0] || "✂").toLocaleUpperCase();

interface CardProps { service: PublicService; whatsapp: string; shopName: string; onBook: (s: PublicService) => void; saved: boolean; onToggleSave: (id: string) => void; first: boolean }

/**
 * One service. Memoised and fed only stable props, so changing the category filter or saving one service
 * re-renders just the cards that really changed. The picture is the 480px thumbnail; the monogram behind it shows
 * while it loads and if it fails (no state, no re-render per image).
 */
const ServiceCard = memo(function ServiceCard({ service, whatsapp, shopName, onBook, saved, onToggleSave, first }: CardProps) {
  const { t, language } = useTranslation();
  const badges = [
    service.badges.featured && t("catFeatured"),
    service.badges.popular && t("catPopular"),
    service.badges.isNew && t("catNew"),
    service.badges.premium && t("catPremium"),
  ].filter(Boolean) as string[];

  const discount = service.discount ? (service.discount.type === "PERCENTAGE" ? `${service.discount.value}% ${t("catOff")}` : `${rupees(service.discount.value)} ${t("catOff")}`) : null;
  const hasPrice = service.priceType !== "ASK_SHOP" && service.finalPrice !== null;
  const askLink = whatsapp ? `https://wa.me/${getWhatsAppNumber(whatsapp)}?text=${encodeURIComponent(t("catWhatsappMsg").replace("{service}", service.name))}` : "";
  const pic = service.thumb || service.images[0];
  const oldPrice = discount ? service.price : service.originalPrice !== null && service.price !== null && service.originalPrice > service.price ? service.originalPrice : null;

  return (
    <article className="tp-card" aria-label={service.name} data-nopic={pic ? undefined : ""}>
      <div className="tp-media">
        <span className="tp-mono" aria-hidden="true">{initial(service.name)}</span>
        {pic && (
          // eslint-disable-next-line @next/next/no-img-element -- owner-supplied addresses; the box reserves the space (aspect-ratio)
          <img className="tp-img" src={pic} alt="" width={480} height={600} loading={first ? "eager" : "lazy"} decoding="async" onError={hide} />
        )}
        {badges.length > 0 && <div className="tp-badges">{badges.map((b) => <span key={b} className="tp-badge">{b}</span>)}</div>}
        {discount && <span className="tp-disc">{discount}</span>}
        <button type="button" className={`tp-heart ${saved ? "tp-heart--on" : ""}`} aria-pressed={saved} aria-label={(saved ? t("catUnsaveAria") : t("catSaveAria")).replace("{name}", service.name)} onClick={() => onToggleSave(service.id)}>
          <span><Heart size={16} aria-hidden="true" /></span>
        </button>
      </div>

      <div className="tp-body">
        {badges.length > 0 && <p className="tp-tags">{badges.map((b) => <span key={b} className="tp-tag">{b}</span>)}</p>}
        <h3 className="tp-card__name">{service.name}</h3>
        {service.offer && <p className="tp-card__offer"><Tag size={14} aria-hidden="true" /><span>{service.offer.title} · {t("catOfferEnds").replace("{date}", fmtDate(service.offer.endsOn, language))}</span></p>}
        {service.description && <p className="tp-card__desc">{service.description}</p>}

        <div className="tp-meta">
          <p className="tp-dur"><Clock size={15} aria-hidden="true" />{t("catMinutes").replace("{n}", String(service.durationMinutes))}</p>
          <span className="tp-leader" aria-hidden="true" />
          <div className="tp-price">
            {hasPrice ? (
              <>
                {service.priceType === "STARTING_FROM" && <p className="tp-price__from">{t("catStartingFrom")}</p>}
                {oldPrice !== null && <p className="tp-price__old">{rupees(oldPrice)}</p>}
                <p className="tp-price__now">{rupees(discount ? (service.finalPrice as number) : (service.price as number))}</p>
              </>
            ) : <p className="tp-price__ask">{t("catAskShop")}</p>}
          </div>
        </div>

        <button type="button" className="tp-book" onClick={() => onBook(service)}>{t("catBookService")}</button>
        {askLink && (
          <a href={askLink} target="_blank" rel="noreferrer" aria-label={`${t("catAskWhatsapp")}: ${service.name} (${shopName})`} className="tp-ask">
            <MessageCircle size={16} aria-hidden="true" /> {t("catAskWhatsapp")}
          </a>
        )}
      </div>
    </article>
  );
});

export function CatalogueSkeleton() {
  return (
    <div className="tp-grid" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="tp-skel">
          <i style={{ aspectRatio: "4 / 5" }} />
          <div style={{ padding: 16, display: "grid", gap: 10 }}><i style={{ height: 18, width: "60%", borderRadius: 6 }} /><i style={{ height: 12, borderRadius: 6 }} /><i style={{ height: 48, borderRadius: 12 }} /></div>
        </div>
      ))}
    </div>
  );
}

/** The catalogue: offers, category chips and service cards in the page's style. "Book this service" hands the choice to the booking view. */
export function PublicCatalogue({ catalogue, loading, error, onBook, allowedBarberIds, notifyTarget }: { catalogue: Catalogue | null; loading: boolean; error?: boolean; onBook: (s: PublicService) => void; allowedBarberIds?: string[]; notifyTarget?: { kind: "barber" | "shop"; slug: string } }) {
  const { t, language } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [limit, setLimit] = useState(CHUNK);
  const sentinel = useRef<HTMLDivElement>(null);
  const favourites = useFavourites();
  const saved = useMemo(() => new Set(favourites.ids), [favourites.ids]);

  const categories = useMemo(() => {
    if (!catalogue) return [];
    // On a shop page after choosing one barber, only the services that barber performs (none named = any barber).
    return catalogue.categories
      .map((c) => ({ ...c, services: allowedBarberIds?.length ? c.services.filter((s) => s.barberIds.length === 0 || s.barberIds.some((b) => allowedBarberIds.includes(b))) : c.services }))
      .filter((c) => c.services.length > 0);
  }, [catalogue, allowedBarberIds]);
  const savedCount = useMemo(() => categories.reduce((n, c) => n + c.services.filter((s) => saved.has(s.id)).length, 0), [categories, saved]);
  const shown = useMemo(() => activeCategory === "SAVED"
    ? categories.map((c) => ({ ...c, services: c.services.filter((s) => saved.has(s.id)) })).filter((c) => c.services.length > 0)
    : activeCategory === "ALL" ? categories : categories.filter((c) => c.id === activeCategory), [activeCategory, categories, saved]);
  // Only the first `limit` services (across categories, in order) are mounted.
  const total = useMemo(() => shown.reduce((n, c) => n + c.services.length, 0), [shown]);
  // Browsers without IntersectionObserver (very old) simply get everything at once.
  const canObserve = typeof IntersectionObserver !== "undefined";
  const cap = canObserve ? limit : Infinity;
  const visible = useMemo(() => {
    const out: typeof shown = [];
    let left = cap;
    for (const c of shown) {
      if (left <= 0) break;
      const part = c.services.slice(0, left);
      left -= part.length;
      out.push({ ...c, services: part });
    }
    return out;
  }, [shown, cap]);
  const more = cap < total;
  useEffect(() => {
    const el = sentinel.current;
    if (!more || !el) return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + CHUNK); }, { rootMargin: "2400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, limit]);
  const b = catalogue?.branding;
  const whatsapp = b?.whatsapp || b?.phone || "";
  const shopName = b?.name || "";
  const list = b?.layout === "list";
  const gridStyle = { "--tp-ratio": RATIO[b?.imageRatio || "portrait"] || RATIO.portrait } as CSSProperties;
  const chips = useMemo(() => [{ id: "ALL", name: t("catAllCategories") }, ...(savedCount > 0 ? [{ id: "SAVED", name: t("catSavedFilter").replace("{n}", String(savedCount)) }] : []), ...categories.map((c) => ({ id: c.id, name: c.name }))], [t, savedCount, categories]);

  return (
    <section id="view-panel-catalogue" role="tabpanel" aria-labelledby="view-tab-catalogue">
      {catalogue && catalogue.offers.length > 0 && (
        <div className="tp-offers" role="region" aria-label={t("catOffersTitle")}>
          {catalogue.offers.map((o) => (
            <div key={o.id} className="tp-offer">
              <Tag size={20} aria-hidden="true" />
              <div className="min-w-0">
                <p className="tp-offer__title">{o.title} · {o.discount.type === "PERCENTAGE" ? `${o.discount.value}% ${t("catOff")}` : `${rupees(o.discount.value)} ${t("catOff")}`}</p>
                {o.description && <p className="tp-offer__desc">{o.description}</p>}
                <p className="tp-offer__end">{t("catOfferEnds").replace("{date}", fmtDate(o.endsOn, language))}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && !catalogue ? <CatalogueSkeleton /> : error ? (
        <p role="alert" className="tp-error">{t("catLoadError")}</p>
      ) : categories.length === 0 ? (
        <p className="tp-empty">{t("catEmpty")}</p>
      ) : (
        <>
          {(categories.length > 1 || savedCount > 0) && (
            <div className="tp-chips" role="group" aria-label={t("catAllCategories")}>
              {chips.map((c) => (
                <button key={c.id} type="button" className="tp-chip" aria-pressed={activeCategory === c.id} onClick={() => { setActiveCategory(c.id); setLimit(CHUNK); }}>{c.name}</button>
              ))}
            </div>
          )}
          <div className="tp-cats">
            {visible.map((c, ci) => (
              <div key={c.id}>
                <div className="tp-cat__head">
                  <h2 className="tp-cat__title">{c.name}</h2>
                </div>
                {c.description && <p className="tp-cat__desc">{c.description}</p>}
                <div className="tp-cat__rule" aria-hidden="true" />
                <div className="tp-grid" data-list={list ? "1" : undefined} style={gridStyle}>
                  {c.services.map((s, si) => <ServiceCard key={s.id} service={s} whatsapp={whatsapp} shopName={shopName} onBook={onBook} saved={saved.has(s.id)} onToggleSave={favourites.toggle} first={ci === 0 && si === 0} />)}
                </div>
              </div>
            ))}
          </div>
          {more && <div ref={sentinel} className="tp-more" aria-hidden="true" />}
        </>
      )}

      {notifyTarget && catalogue?.available && <OfferNotify kind={notifyTarget.kind} slug={notifyTarget.slug} name={b?.name || ""} />}
    </section>
  );
}
