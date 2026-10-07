"use client";

import type { ReactNode } from "react";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { getWhatsAppNumber } from "@/lib/phone";

export interface HeroBranding { logoUrl?: string; coverUrl?: string; intro?: string; address?: string; mapUrl?: string; phone?: string; whatsapp?: string; instagram?: string; facebook?: string }

const hide = (e: { currentTarget: HTMLImageElement }) => { e.currentTarget.style.display = "none"; };
const initial = (name: string) => (Array.from(name.trim())[0] || "✂").toLocaleUpperCase();

/**
 * The top of a customer page, in the page's style (the CSS decides the layout). Shows the owner's cover and logo, or an
 * elegant monogram when there are none. `compact` is the shorter version above the booking steps; the full version
 * (intro, address, call / WhatsApp / social) is for the catalogue view. The cover is the page's main picture, so it loads first.
 */
export function TemplateHero({ name, subtitle, branding, compact, children }: { name: string; subtitle?: string; branding?: HeroBranding | null; compact: boolean; children?: ReactNode }) {
  const { t } = useTranslation();
  const b = branding || {};
  const wa = b.whatsapp || b.phone || "";
  const hasInfo = !!(b.intro || b.address || b.phone || wa || b.instagram || b.facebook);
  return (
    <header className="tp-hero" data-compact={compact ? "" : undefined} data-nocover={b.coverUrl ? undefined : ""} data-nologo={b.logoUrl ? undefined : ""}>
      <div className="tp-hero__media" aria-hidden="true">
        {b.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- owner-supplied address; the box reserves the space
          <img className="tp-hero__img" src={b.coverUrl} alt="" width={1200} height={600} loading="eager" fetchPriority="high" decoding="async" onError={hide} />
        ) : <span className="tp-mono">{initial(name)}</span>}
      </div>
      <div className="tp-hero__lang">{children}</div>
      <div className="tp-hero__shell">
        <div className="tp-hero__id">
          <div className="tp-logo tp-rise" aria-hidden={b.logoUrl ? undefined : "true"}>
            <span className="tp-logo__mono">{initial(name)}</span>
            {b.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- owner-supplied address
              <img src={b.logoUrl} alt={name} width={104} height={104} decoding="async" onError={hide} />
            )}
          </div>
          <div className="tp-hero__idtext tp-rise" data-d="1">
            <h1 className="tp-name">{name}</h1>
            {subtitle && <p className="tp-sub">{subtitle}</p>}
          </div>
        </div>
        {!compact && hasInfo && (
          <div className="tp-hero__info tp-rise" data-d="2">
            <div className="tp-orn" aria-hidden="true"><i /></div>
            {b.intro && <p className="tp-intro">{b.intro}</p>}
            {b.address && <p className="tp-addr"><MapPin size={16} aria-hidden="true" /><span>{b.address}{b.mapUrl && <> · <a href={b.mapUrl} target="_blank" rel="noreferrer">{t("catMap")}</a></>}</span></p>}
            {(b.phone || wa) && (
              <div className="tp-actions">
                {b.phone && <a className="tp-act tp-act--solid" href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}><Phone size={16} aria-hidden="true" />{t("catCall")}</a>}
                {wa && <a className="tp-act" href={`https://wa.me/${getWhatsAppNumber(wa)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" />WhatsApp</a>}
              </div>
            )}
            {(b.instagram || b.facebook) && (
              <div className="tp-social">
                {b.instagram && <a href={b.instagram} target="_blank" rel="noreferrer">Instagram</a>}
                {b.facebook && <a href={b.facebook} target="_blank" rel="noreferrer">Facebook</a>}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
