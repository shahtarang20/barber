"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";
import { darken, normalizeHex, readableInk } from "@/lib/brandColor";
import type { PageBranding } from "@/lib/catalogueTemplateServer";
import "./templates.css";

export interface PageScope { template: number; enabled: boolean; branding: PageBranding | null }
const TemplateContext = createContext<PageScope>({ template: 1, enabled: false, branding: null });
/** The page style (1-5) and first-paint branding of the shop / barber being viewed. Decided on the server, so there is no flash of another style. */
export const usePageScope = () => useContext(TemplateContext);

/** Wraps a customer page in its style: the CSS tokens live on `.tpl[data-tpl="N"]`, the heading font comes in as a class. */
export function TemplateScope({ template, fontClass, enabled, branding, children }: { template: number; fontClass: string; enabled: boolean; branding: PageBranding | null; children: ReactNode }) {
  const { language } = useTranslation();
  // Owner-chosen brand colour: buttons, the Book/Catalogue switch and the selected chip take it (with readable text) and a thin line in
  // the colour edges the page. Backgrounds and text stay the style's own, so the page remains easy to read.
  const brand = normalizeHex(branding?.brandColor);
  const brandVars = brand
    ? ({ "--t-brand": brand, "--t-btn-bg": `linear-gradient(180deg, ${brand}, ${darken(brand, 0.3)})`, "--t-btn-ink": readableInk(brand) } as CSSProperties)
    : undefined;
  return (
    <TemplateContext.Provider value={{ template, enabled, branding }}>
      <div className={`tpl ${fontClass}`} data-tpl={template} data-lang={language} data-brand={brand ? "" : undefined} style={brandVars}>{children}</div>
    </TemplateContext.Provider>
  );
}
