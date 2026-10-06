"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { UploadButton } from "@/components/catalogue/owner/UploadButton";
import { catalogueApi, type CatalogueScope, type SettingsDoc } from "@/lib/catalogueClient";

const ACCENTS: { id: SettingsDoc["accent"]; label: string; swatch: string }[] = [
  { id: "indigo", label: "Indigo", swatch: "bg-indigo-600" },
  { id: "emerald", label: "Green", swatch: "bg-emerald-600" },
  { id: "rose", label: "Rose", swatch: "bg-rose-600" },
  { id: "amber", label: "Amber", swatch: "bg-amber-500" },
  { id: "sky", label: "Sky", swatch: "bg-sky-600" },
  { id: "zinc", label: "Black", swatch: "bg-zinc-900" },
];

type Draft = Required<Pick<SettingsDoc, "logoUrl" | "coverUrl" | "intro" | "address" | "mapUrl" | "phone" | "whatsapp" | "instagram" | "facebook" | "accent" | "layout" | "imageRatio">>;
const toDraft = (s: SettingsDoc): Draft => ({ logoUrl: s.logoUrl || "", coverUrl: s.coverUrl || "", intro: s.intro || "", address: s.address || "", mapUrl: s.mapUrl || "", phone: s.phone || "", whatsapp: s.whatsapp || "", instagram: s.instagram || "", facebook: s.facebook || "", accent: s.accent || "indigo", layout: s.layout || "grid", imageRatio: s.imageRatio || "portrait" });

/** Logo, cover banner, introduction, contact and colour of the public catalogue. Pictures can be uploaded or pasted as a web address. */
export function BrandingForm({ scope, settings, onSaved }: { scope: CatalogueScope; settings: SettingsDoc; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await catalogueApi("PUT", "/api/barber/catalogue/settings", scope, draft);
      toast.add({ title: "Saved", description: "Branding updated.", type: "success" });
      onSaved();
    } catch (err) {
      toast.add({ title: "Could not save", description: (err as Error).message, type: "error" });
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
      <UploadButton scope={scope} kind="image" label="Upload picture" onUploaded={(url) => set(id, url)} />
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
        {picture("logoUrl", "Logo or profile picture")}
        {picture("coverUrl", "Cover banner")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="brand-intro">Short introduction</Label>
        <Textarea id="brand-intro" value={draft.intro} maxLength={400} rows={3} placeholder="Tell customers what makes your shop special" onChange={(e) => set("intro", e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("address", "Address", "Shop address")}
        {field("mapUrl", "Map link", "https://maps.google.com/…")}
        {field("phone", "Phone", "98XXXXXXXX", "tel")}
        {field("whatsapp", "WhatsApp number", "98XXXXXXXX", "tel")}
        {field("instagram", "Instagram link", "https://instagram.com/…")}
        {field("facebook", "Facebook link", "https://facebook.com/…")}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Accent colour</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={draft.accent === a.id} onClick={() => set("accent", a.id)}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm ${draft.accent === a.id ? "border-zinc-900 ring-2 ring-zinc-900" : "border-zinc-300"}`}>
              <span className={`h-4 w-4 rounded-full ${a.swatch}`} aria-hidden="true" /> {a.label}
            </button>
          ))}
        </div>
      </fieldset>
      <ChoiceGroup legend="Service layout" value={draft.layout} onChange={(v) => set("layout", v as Draft["layout"])} options={[["grid", "Cards"], ["list", "List"]]} />
      <ChoiceGroup legend="Picture shape" value={draft.imageRatio} onChange={(v) => set("imageRatio", v as Draft["imageRatio"])} options={[["portrait", "Tall"], ["square", "Square"], ["wide", "Wide"]]} />
      <Button type="submit" disabled={saving} className="h-11">{saving ? "Saving…" : "Save branding"}</Button>
    </form>
  );
}

function ChoiceGroup({ legend, value, onChange, options }: { legend: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={legend}>
        {options.map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)}
            className={`min-h-11 rounded-full border px-4 text-sm ${value === id ? "border-zinc-900 ring-2 ring-zinc-900" : "border-zinc-300"}`}>{label}</button>
        ))}
      </div>
    </fieldset>
  );
}
