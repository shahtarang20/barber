"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { UploadButton } from "@/components/catalogue/owner/UploadButton";
import { catalogueApi, type CatalogueScope, type CategoryDoc, type PlanInfo, type ServiceDoc } from "@/lib/catalogueClient";

interface Props {
  scope: CatalogueScope;
  categories: CategoryDoc[];
  plan: PlanInfo;
  /** The shop's barbers, offered for a shop catalogue ("who performs it"). */
  members?: { _id: string; name: string }[];
  existing?: ServiceDoc;
  /** Where "Cancel" and a successful save go back to. */
  backTo: string;
}

const selectClass = "h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const num = (v: string): number | undefined => (v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

/** Create or edit one service / hairstyle card. All checks run on the server too; this form just explains problems early. */
export function ServiceForm({ scope, categories, plan, members = [], existing, backTo }: Props) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? categories[0]?._id ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [duration, setDuration] = useState(String(existing?.durationMinutes ?? 30));
  const [priceType, setPriceType] = useState<ServiceDoc["priceType"]>(existing?.priceType ?? "FIXED_PRICE");
  const [price, setPrice] = useState(existing?.price !== undefined ? String(existing.price) : "");
  const [originalPrice, setOriginalPrice] = useState(existing?.originalPrice !== undefined ? String(existing.originalPrice) : "");
  const [discountType, setDiscountType] = useState<"" | "PERCENTAGE" | "FIXED">(existing?.discountType ?? "");
  const [discountValue, setDiscountValue] = useState(existing?.discountValue !== undefined ? String(existing.discountValue) : "");
  const { mutate } = useSWRConfig();
  const [images, setImages] = useState<string[]>(existing?.images?.length ? existing.images : [""]);
  const [videos, setVideos] = useState<string[]>(existing?.videos ?? []);
  const [barberIds, setBarberIds] = useState<string[]>(existing?.barberIds ?? []);
  const [badges, setBadges] = useState({ isFeatured: !!existing?.isFeatured, isPopular: !!existing?.isPopular, isNew: !!existing?.isNew, isPremium: !!existing?.isPremium });
  const [status, setStatus] = useState<ServiceDoc["status"]>(existing?.status ?? "PUBLISHED");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const setList = (list: string[], set: (v: string[]) => void, index: number, value: string) => set(list.map((x, i) => (i === index ? value : x)));

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Enter the service name (at least 2 letters).";
    if (!categoryId) e.categoryId = "Choose a category (create one first if you have none).";
    const d = num(duration);
    if (d === undefined || !Number.isInteger(d) || d < 5 || d > 600) e.duration = "Duration must be a whole number of minutes, 5 to 600.";
    if (priceType !== "ASK_SHOP" && num(price) === undefined) e.price = "Enter a price, or choose 'Ask shop'.";
    if (discountType && !num(discountValue)) e.discountValue = "Enter the discount amount.";
    if (discountType === "PERCENTAGE" && (num(discountValue) ?? 0) > 90) e.discountValue = "A percentage discount can be at most 90%.";
    if (discountType === "FIXED" && priceType !== "ASK_SHOP" && (num(discountValue) ?? 0) >= (num(price) ?? 0)) e.discountValue = "A fixed discount must be smaller than the price.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const askShop = priceType === "ASK_SHOP";
    const body = {
      name: name.trim(), categoryId, description: description.trim(), durationMinutes: num(duration),
      priceType, ...(askShop ? {} : { price: num(price), originalPrice: num(originalPrice) }),
      ...(!askShop && discountType ? { discountType, discountValue: num(discountValue) } : {}),
      images: images.map((i) => i.trim()).filter(Boolean), videos: videos.map((v) => v.trim()).filter(Boolean),
      barberIds: scope === "shop" ? barberIds : [], ...badges, status,
    };
    try {
      if (existing) await catalogueApi("PATCH", `/api/barber/catalogue/services/${existing._id}`, scope, body);
      else await catalogueApi("POST", "/api/barber/catalogue/services", scope, body);
      toast.add({ title: "Saved", description: status === "PUBLISHED" ? "The service is live for customers." : "Saved as a draft. Customers cannot see it yet.", type: "success" });
      // Refresh the lists now: the page we return to would otherwise reuse data fetched a moment ago and miss this change.
      await mutate((key) => typeof key === "string" && key.startsWith("/api/barber/catalogue"));
      router.push(backTo);
    } catch (err) {
      toast.add({ title: "Could not save", description: (err as Error).message, type: "error" });
      setSaving(false);
    }
  };

  const err = (key: string) => errors[key] ? <p role="alert" className="text-sm font-medium text-red-600">{errors[key]}</p> : null;

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="svc-name">Service name</Label>
        <Input id="svc-name" value={name} maxLength={80} aria-invalid={!!errors.name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Skin fade haircut" />
        {err("name")}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="svc-category">Category</Label>
          <select id="svc-category" className={selectClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-invalid={!!errors.categoryId}>
            {categories.length === 0 && <option value="">No categories yet</option>}
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          {err("categoryId")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="svc-duration">Duration (minutes)</Label>
          <Input id="svc-duration" inputMode="numeric" value={duration} aria-invalid={!!errors.duration} onChange={(e) => setDuration(e.target.value)} />
          {err("duration")}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="svc-desc">Short description</Label>
        <Textarea id="svc-desc" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is included, who it suits…" />
      </div>

      <fieldset className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <legend className="px-1 text-sm font-semibold">Price</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="svc-ptype">Price type</Label>
            <select id="svc-ptype" className={selectClass} value={priceType} onChange={(e) => setPriceType(e.target.value as ServiceDoc["priceType"])}>
              <option value="FIXED_PRICE">Fixed price</option>
              <option value="STARTING_FROM">Starting from</option>
              <option value="ASK_SHOP">Ask shop (no price shown)</option>
            </select>
          </div>
          {priceType !== "ASK_SHOP" && (
            <div className="space-y-1.5">
              <Label htmlFor="svc-price">Price (₹)</Label>
              <Input id="svc-price" inputMode="decimal" value={price} aria-invalid={!!errors.price} onChange={(e) => setPrice(e.target.value)} />
              {err("price")}
            </div>
          )}
        </div>
        {priceType !== "ASK_SHOP" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="svc-orig">Original price (optional)</Label>
              <Input id="svc-orig" inputMode="decimal" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-dtype">Discount</Label>
              <select id="svc-dtype" className={selectClass} value={discountType} onChange={(e) => setDiscountType(e.target.value as "" | "PERCENTAGE" | "FIXED")}>
                <option value="">None</option>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed amount (₹)</option>
              </select>
            </div>
            {discountType && (
              <div className="space-y-1.5">
                <Label htmlFor="svc-dval">{discountType === "PERCENTAGE" ? "Discount (%)" : "Discount (₹)"}</Label>
                <Input id="svc-dval" inputMode="decimal" value={discountValue} aria-invalid={!!errors.discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                {err("discountValue")}
              </div>
            )}
          </div>
        )}
        {priceType !== "ASK_SHOP" && discountType && num(price) !== undefined && num(discountValue) ? (
          <p className="text-sm text-zinc-600">Customers will pay <strong>₹{discountType === "PERCENTAGE" ? Math.round((num(price) as number) * (1 - (num(discountValue) as number) / 100)) : Math.round((num(price) as number) - (num(discountValue) as number))}</strong> (the price above, minus the discount).</p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <legend className="px-1 text-sm font-semibold">Pictures and video</legend>
        <p className="text-xs text-zinc-500">Upload from your phone, or paste a web address. Your {plan.tier.toLowerCase()} plan allows {plan.maxImagesPerService} picture{plan.maxImagesPerService === 1 ? "" : "s"} and {plan.maxVideosPerService === 0 ? "no videos" : `${plan.maxVideosPerService} video${plan.maxVideosPerService === 1 ? "" : "s"}`} per service.</p>
        {images.map((img, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input aria-label={`Picture ${i + 1} address`} value={img} placeholder="https://…" onChange={(e) => setList(images, setImages, i, e.target.value)} />
            {/* eslint-disable-next-line @next/next/no-img-element -- small preview of an owner-supplied address */}
            {img.trim().startsWith("http") && <img src={img.trim()} alt="" className="h-11 w-11 shrink-0 rounded object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove picture ${i + 1}`} onClick={() => setImages(images.filter((_, j) => j !== i))}><X /></Button>
          </div>
        ))}
        {images.length < plan.maxImagesPerService && (
          <div className="flex flex-wrap gap-2">
            <UploadButton scope={scope} kind="image" label="Upload picture" onUploaded={(url) => setImages([...images.filter((i) => i.trim()), url])} />
            <Button type="button" variant="outline" onClick={() => setImages([...images, ""])}><Plus /> Add address</Button>
          </div>
        )}
        {plan.maxVideosPerService > 0 && (
          <>
            {videos.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input aria-label={`Video ${i + 1} address`} value={v} placeholder="https://… (short video)" onChange={(e) => setList(videos, setVideos, i, e.target.value)} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove video ${i + 1}`} onClick={() => setVideos(videos.filter((_, j) => j !== i))}><X /></Button>
              </div>
            ))}
            {videos.length < plan.maxVideosPerService && (
              <div className="flex flex-wrap gap-2">
                <UploadButton scope={scope} kind="video" label="Upload video" onUploaded={(url) => setVideos([...videos.filter((v) => v.trim()), url])} />
                <Button type="button" variant="outline" onClick={() => setVideos([...videos, ""])}><Plus /> Add address</Button>
              </div>
            )}
          </>
        )}
      </fieldset>

      {scope === "shop" && members.length > 0 && (
        <fieldset className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <legend className="px-1 text-sm font-semibold">Who performs it</legend>
          <p className="text-xs text-zinc-500">Leave all unticked if any barber of the shop can do it.</p>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <label key={m._id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${barberIds.includes(m._id) ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"}`}>
                <input type="checkbox" className="sr-only" checked={barberIds.includes(m._id)} onChange={(e) => setBarberIds(e.target.checked ? [...barberIds, m._id] : barberIds.filter((b) => b !== m._id))} />
                {m.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">Badges</legend>
        <div className="flex flex-wrap gap-2">
          {([["isFeatured", "Featured"], ["isPopular", "Popular"], ["isNew", "New"], ["isPremium", "Premium"]] as const).map(([key, label]) => (
            <label key={key} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${badges[key] ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"}`}>
              <input type="checkbox" className="sr-only" checked={badges[key]} onChange={(e) => setBadges({ ...badges, [key]: e.target.checked })} /> {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="svc-status">Visibility</Label>
        <select id="svc-status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ServiceDoc["status"])}>
          <option value="PUBLISHED">Published: customers can see it</option>
          <option value="DRAFT">Draft: only you can see it</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving} className="h-12 px-6">{saving ? "Saving…" : existing ? "Save changes" : "Add service"}</Button>
        <Button type="button" variant="outline" className="h-12" onClick={() => router.push(backTo)} disabled={saving}>Cancel</Button>
      </div>
    </form>
  );
}
