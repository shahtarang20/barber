"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { UploadButton } from "@/components/catalogue/owner/UploadButton";
import { BRAND_PRESETS, darken, normalizeHex, readableInk } from "@/lib/brandColor";
import { catalogueApi, type CatalogueScope, type SettingsDoc } from "@/lib/catalogueClient";

const ACCENTS: { id: SettingsDoc["accent"]; label: "ownAccentIndigo" | "ownAccentGreen" | "ownAccentRose" | "ownAccentAmber" | "ownAccentSky" | "ownAccentBlack"; swatch: string }[] = [
  { id: "indigo", label: "ownAccentIndigo", swatch: "bg-indigo-600" },
  { id: "emerald", label: "ownAccentGreen", swatch: "bg-emerald-600" },
  { id: "rose", label: "ownAccentRose", swatch: "bg-rose-600" },
  { id: "amber", label: "ownAccentAmber", swatch: "bg-amber-500" },
  { id: "sky", label: "ownAccentSky", swatch: "bg-sky-600" },
  { id: "zinc", label: "ownAccentBlack", swatch: "bg-zinc-900" },
];

const PRESET_LABEL = { burgundy: "ownPresetBurgundy", forest: "ownPresetForest", navy: "ownPresetNavy", charcoal: "ownPresetCharcoal", gold: "ownPresetGold", purple: "ownPresetPurple" } as const;

type Draft = Required<Pick<SettingsDoc, "logoUrl" | "coverUrl" | "intro" | "address" | "mapUrl" | "phone" | "whatsapp" | "instagram" | "facebook" | "accent" | "layout" | "imageRatio" | "brandColor">>;
const toDraft = (s: SettingsDoc): Draft => ({ logoUrl: s.logoUrl || "", coverUrl: s.coverUrl || "", intro: s.intro || "", address: s.address || "", mapUrl: s.mapUrl || "", phone: s.phone || "", whatsapp: s.whatsapp || "", instagram: s.instagram || "", facebook: s.facebook || "", accent: s.accent || "indigo", layout: s.layout || "grid", imageRatio: s.imageRatio || "portrait", brandColor: s.brandColor || "" });

/** Logo, cover banner, introduction, contact and colour of the public catalogue. Pictures can be uploaded or pasted as a web address. */
export function BrandingForm({ scope, settings, onSaved, shopName = "" }: { scope: CatalogueScope; settings: SettingsDoc; onSaved: () => void; shopName?: string }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [saving, setSaving] = useState(false);
  const brand = normalizeHex(draft.brandColor);
  const shopInitial = (Array.from(shopName.trim())[0] || "A").toLocaleUpperCase();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await catalogueApi("PUT", "/api/barber/catalogue/settings", scope, draft);
      toast.add({ title: t("ownSaved"), description: t("ownBrandSaved"), type: "success" });
      onSaved();
    } catch (err) {
      toast.add({ title: t("ownCouldNotSave"), description: (err as Error).message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const picture = (id: "logoUrl" | "coverUrl", label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`brand-${id}`}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={`brand-${id}`} value={draft[id]} placeholder="https://…" onChange={(e) => set(id, e.target.value)} />
        {/* eslint-disable-next-line @next/next/no-img-element -- small preview of the chosen picture */}
        {draft[id].startsWith("http") || draft[id].startsWith("/") ? <img src={draft[id]} alt="" className="h-11 w-11 shrink-0 rounded object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : null}
      </div>
      <UploadButton scope={scope} kind="image" label={t("ownUploadPicture")} onUploaded={(url) => set(id, url)} />
    </div>
  );

  const field = (id: keyof Draft, label: string, placeholder: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`brand-${id}`}>{label}</Label>
      <Input id={`brand-${id}`} type={type} value={draft[id]} placeholder={placeholder} onChange={(e) => set(id, e.target.value as Draft[typeof id])} />
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        {picture("logoUrl", t("ownBrandLogo"))}
        {picture("coverUrl", t("ownBrandCover"))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="brand-intro">{t("ownBrandIntro")}</Label>
        <Textarea id="brand-intro" value={draft.intro} maxLength={400} rows={3} placeholder={t("ownBrandIntroPh")} onChange={(e) => set("intro", e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("address", t("ownBrandAddress"), t("ownBrandAddressPh"))}
        {field("mapUrl", t("ownBrandMap"), "https://maps.google.com/…")}
        {field("phone", t("ownBrandPhone"), "98XXXXXXXX", "tel")}
        {field("whatsapp", t("ownBrandWhatsapp"), "98XXXXXXXX", "tel")}
        {field("instagram", t("ownBrandInstagram"), "https://instagram.com/…")}
        {field("facebook", t("ownBrandFacebook"), "https://facebook.com/…")}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("ownBrandAccent")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("ownBrandAccent")}>
          {ACCENTS.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={draft.accent === a.id} onClick={() => set("accent", a.id)}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm ${draft.accent === a.id ? "border-zinc-900 ring-2 ring-zinc-900" : "border-zinc-300"}`}>
              <span className={`h-4 w-4 rounded-full ${a.swatch}`} aria-hidden="true" /> {t(a.label)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t("ownBrandColor")}</legend>
        <p className="mb-2 text-xs text-zinc-500">{t("ownBrandColorHint")}</p>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("ownBrandColor")}>
          {BRAND_PRESETS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={brand === p.hex} onClick={() => set("brandColor", p.hex)}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm ${brand === p.hex ? "border-zinc-900 ring-2 ring-zinc-900" : "border-zinc-300"}`}>
              <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: p.hex }} aria-hidden="true" /> {t(PRESET_LABEL[p.id])}
            </button>
          ))}
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-zinc-300 px-3 text-sm">
            <input type="color" aria-label={t("ownBrandColorCustom")} value={brand ?? "#4f46e5"} onChange={(e) => set("brandColor", e.target.value)} className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0" />
            {t("ownBrandColorCustom")}
          </label>
          <Button type="button" variant="outline" className="h-11" disabled={!brand} onClick={() => set("brandColor", "")}>{t("ownBrandColorReset")}</Button>
        </div>
        {/* live preview: the page edge, a button and the app icon colour exactly as customers will see them */}
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200" aria-hidden="true" data-testid="brand-preview">
          <div className="h-1.5" style={{ background: brand ?? "#d4d4d8" }} />
          <div className="flex items-center gap-3 bg-zinc-50 p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold" style={{ background: brand ? `linear-gradient(135deg, ${brand}, ${darken(brand, 0.45)})` : "#e4e4e7", color: brand ? readableInk(brand) : "#52525b" }}>{shopInitial}</span>
            <span className="inline-flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold" style={{ background: brand ? `linear-gradient(180deg, ${brand}, ${darken(brand, 0.3)})` : "#e4e4e7", color: brand ? readableInk(brand) : "#52525b" }}>{t("catBookService")}</span>
          </div>
        </div>
      </fieldset>
      <Button type="submit" disabled={saving} className="h-11">{saving ? t("ownSaving") : t("ownBrandSave")}</Button>
    </form>
  );
}
