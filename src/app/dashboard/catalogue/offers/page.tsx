"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/catalogue/owner/ConfirmDialog";
import { ScopeSwitch } from "@/components/catalogue/owner/ScopeSwitch";
import { catalogueApi, useOwnerCatalogue, useShopOwnership, withScope, type CatalogueScope, type OfferDoc } from "@/lib/catalogueClient";
import { useCatalogueScope } from "@/lib/useCatalogueScope";
import { showDate } from "@/lib/usePlan";
import { useTranslation, translate } from "@/lib/i18n";

const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6";
const fetcher = (url: string) => fetch(url).then(async (r) => { const j = await r.json().catch(() => null); if (!r.ok || !j?.success) throw new Error(j?.error?.message || translate("ownCouldNotLoad")); return j.data; });

interface OffersPayload { offers: OfferDoc[]; today: string; maxActiveOffers: number }
interface CampaignPayload { subscribers: number; limit: number; sentThisWeek: number; nextAt: string | null; pushReady: boolean; history: { _id: string; message: string; audience: number; delivered: number; createdAt: string }[] }

const stateOf = (o: OfferDoc, today: string) => o.status === "PAUSED" ? "Paused" : o.endsOn < today ? "Ended" : o.startsOn > today ? "Scheduled" : "Live";
const STATE_LABEL = { Live: "offLive", Scheduled: "offScheduled", Paused: "offPaused", Ended: "offEnded" } as const;
const STATE_STYLE: Record<string, string> = { Live: "bg-green-100 text-green-800", Scheduled: "bg-blue-100 text-blue-800", Paused: "bg-zinc-200 text-zinc-700", Ended: "bg-zinc-100 text-zinc-500" };

function OfferForm({ scope, offer, services, today, onDone, onCancel }: { scope: CatalogueScope; offer: OfferDoc | null; services: { _id: string; name: string }[]; today: string; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(offer?.title ?? "");
  const [description, setDescription] = useState(offer?.description ?? "");
  const [discountType, setDiscountType] = useState<OfferDoc["discountType"]>(offer?.discountType ?? "PERCENTAGE");
  const [value, setValue] = useState(String(offer?.discountValue ?? ""));
  const [startsOn, setStartsOn] = useState(offer?.startsOn ?? today);
  const [endsOn, setEndsOn] = useState(offer?.endsOn ?? "");
  const [ids, setIds] = useState<string[]>(offer?.serviceIds ?? []);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endsOn) { toast.add({ title: t("ownCouldNotSave"), description: t("ownOffNeedEnd"), type: "error" }); return; }
    setBusy(true);
    try {
      const body = { title, description, discountType, discountValue: Number(value), startsOn, endsOn, serviceIds: ids, status: offer?.status ?? "ACTIVE" };
      if (offer) await catalogueApi("PUT", `/api/barber/catalogue/offers/${offer._id}`, scope, body);
      else await catalogueApi("POST", "/api/barber/catalogue/offers", scope, body);
      toast.add({ title: t("ownSaved"), description: t("offSaved"), type: "success" });
      onDone();
    } catch (err) { toast.add({ title: t("ownCouldNotSave"), description: (err as Error).message, type: "error" }); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="of-title">{t("offName")}</Label><Input id="of-title" value={title} maxLength={60} placeholder={t("offNamePh")} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="of-desc">{t("offDesc")}</Label><Textarea id="of-desc" rows={2} maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label htmlFor="of-type">{t("offDiscount")}</Label>
          <select id="of-type" value={discountType} onChange={(e) => setDiscountType(e.target.value as OfferDoc["discountType"])} className="h-11 w-full rounded-lg border border-zinc-300 bg-transparent px-2 text-sm"><option value="PERCENTAGE">{t("offPercentOff")}</option><option value="FIXED">{t("offRupeesOff")}</option></select></div>
        <div className="space-y-1.5"><Label htmlFor="of-value">{discountType === "PERCENTAGE" ? t("offPercentLbl") : t("offRupees")}</Label><Input id="of-value" type="number" inputMode="numeric" min="1" value={value} onChange={(e) => setValue(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="of-start">{t("offStarts")}</Label><Input id="of-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="of-end">{t("offEnds")}</Label><Input id="of-end" type="date" value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} /></div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("offAppliesTo")}</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={ids.length === 0} onChange={() => setIds([])} /> {t("offAllServices")}</label>
        {services.map((s) => (
          <label key={s._id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={ids.includes(s._id)} onChange={(e) => setIds(e.target.checked ? [...ids, s._id] : ids.filter((x) => x !== s._id))} /> {s.name}</label>
        ))}
      </fieldset>
      <p className="text-xs text-zinc-500">{t("offLiveNote")}</p>
      <div className="flex gap-2"><Button type="submit" disabled={busy} className="h-11">{busy ? t("ownSaving") : t("offSave")}</Button><Button type="button" variant="outline" className="h-11" onClick={onCancel}>{t("ownCancel")}</Button></div>
    </form>
  );
}

function Campaigns({ scope, liveOffers }: { scope: CatalogueScope; liveOffers: OfferDoc[] }) {
  const { t } = useTranslation();
  const { data, mutate } = useSWR<CampaignPayload>(withScope("/api/barber/catalogue/campaigns", scope), fetcher);
  const [message, setMessage] = useState("");
  const [offerId, setOfferId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const blocked = data.limit === 0 ? t("offBlockedPremium") : !data.pushReady ? t("offBlockedPush") : data.sentThisWeek >= data.limit ? t("offBlockedWeekly").replace("{n}", String(data.limit)).replace("{next}", data.nextAt ? t("offNextAfter").replace("{date}", showDate(data.nextAt.slice(0, 10))) : "") : "";

  const send = async () => {
    setBusy(true);
    try {
      const r = await catalogueApi<{ audience: number; delivered: number }>("POST", "/api/barber/catalogue/campaigns", scope, { message, offerId: offerId || undefined });
      toast.add({ title: t("offSent"), description: t("offDelivered").replace("{d}", String(r.delivered)).replace("{a}", String(r.audience)), type: "success" });
      setMessage(""); setOfferId(""); setConfirm(false); await mutate();
    } catch (err) { toast.add({ title: t("offCouldNotSend"), description: (err as Error).message, type: "error" }); setConfirm(false); }
    finally { setBusy(false); }
  };

  return (
    <section className={`${card} space-y-4`} aria-labelledby="camp-heading">
      <h2 id="camp-heading" className="text-lg font-semibold">{t("offMsgHead")}</h2>
      <p className="text-sm text-zinc-500">{t("offMsgIntro").replace("{subs}", String(data.subscribers)).replace("{limit}", String(data.limit)).replace("{used}", String(data.sentThisWeek))}</p>
      {blocked && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{blocked}</p>}
      <div className="space-y-1.5"><Label htmlFor="camp-msg">{t("offMsgLabel").replace("{n}", String(message.length))}</Label><Textarea id="camp-msg" rows={2} maxLength={120} value={message} disabled={!!blocked} placeholder={t("offMsgPh")} onChange={(e) => setMessage(e.target.value)} /></div>
      {liveOffers.length > 0 && (
        <div className="space-y-1.5"><Label htmlFor="camp-offer">{t("offAboutOffer")}</Label>
          <select id="camp-offer" value={offerId} disabled={!!blocked} onChange={(e) => setOfferId(e.target.value)} className="h-11 w-full rounded-lg border border-zinc-300 bg-transparent px-2 text-sm"><option value="">{t("offNoParticular")}</option>{liveOffers.map((o) => <option key={o._id} value={o._id}>{o.title}</option>)}</select></div>
      )}
      <Button className="h-11" disabled={!!blocked || message.trim().length < 5 || data.subscribers === 0} onClick={() => setConfirm(true)}><Send /> {t("offSendBtn")}</Button>
      {data.history.length > 0 && (
        <div><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("offSentSoFar")}</h3>
          <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">{data.history.map((h) => <li key={h._id} className="py-1.5"><span>{h.message}</span> <span className="text-xs text-zinc-500">· {new Date(h.createdAt).toLocaleDateString("en-IN")} · {t("offDeliveredLine").replace("{d}", String(h.delivered)).replace("{a}", String(h.audience))}</span></li>)}</ul></div>
      )}
      <ConfirmDialog open={confirm} title={t("offConfirmTitle")} description={t("offConfirmDesc").replace("{n}", String(data.subscribers)).replace("{limit}", String(data.limit))} confirmLabel={t("offSendNow")} busy={busy} onCancel={() => setConfirm(false)} onConfirm={send}>
        <p className="rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-800">{message}</p>
      </ConfirmDialog>
    </section>
  );
}

export default function OffersPage() {
  const { t } = useTranslation();
  const { canManageShop, shop } = useShopOwnership();
  const [scope, setScope] = useCatalogueScope(canManageShop);
  const { services } = useOwnerCatalogue(scope);
  const { data, error, mutate } = useSWR<OffersPayload>(withScope("/api/barber/catalogue/offers", scope), fetcher);
  const [editing, setEditing] = useState<OfferDoc | "new" | null>(null);
  const [toDelete, setToDelete] = useState<OfferDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const today = data?.today ?? "";
  const live = useMemo(() => (data?.offers ?? []).filter((o) => stateOf(o, today) === "Live"), [data, today]);
  // Offers change customer prices and messages reach customers: owner or full-access staff only (the server enforces it too).
  const canSend = scope === "me" || shop?.isOwner || shop?.myAccess?.level === "FULL";
  const svcList = (services.data ?? []).map((s) => ({ _id: s._id, name: s.name }));

  const toggle = async (o: OfferDoc) => {
    try { await catalogueApi("PUT", `/api/barber/catalogue/offers/${o._id}`, scope, { title: o.title, description: o.description, discountType: o.discountType, discountValue: o.discountValue, serviceIds: o.serviceIds, startsOn: o.startsOn, endsOn: o.endsOn, status: o.status === "ACTIVE" ? "PAUSED" : "ACTIVE" }); await mutate(); }
    catch (err) { toast.add({ title: t("ownCouldNotChange"), description: (err as Error).message, type: "error" }); }
  };
  const remove = async () => {
    if (!toDelete) return; setBusy(true);
    try { await catalogueApi("DELETE", `/api/barber/catalogue/offers/${toDelete._id}`, scope); await mutate(); setToDelete(null); }
    catch (err) { toast.add({ title: t("offCouldNotDelete"), description: (err as Error).message, type: "error" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <Link href={scope === "shop" ? "/dashboard/catalogue?scope=shop" : "/dashboard/catalogue"} className="inline-flex min-h-11 items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"><ArrowLeft className="h-4 w-4" /> {t("ownCatalogue")}</Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t("offTitle")}</h1>
        <p className="mt-1 text-zinc-500">{t("offSub")}</p>
      </div>
      {canManageShop && shop && <ScopeSwitch scope={scope} onChange={setScope} shopName={shop.name} />}
      {error ? <div role="alert" className={`${card} text-red-700`}>{(error as Error).message}</div> : !data ? <div className={`${card} animate-pulse text-zinc-400`}>{t("ownLoading")}</div> : (
        <>
          <section className={`${card} space-y-4`} aria-labelledby="offers-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="offers-heading" className="text-lg font-semibold">{t("offYourOffers")} <span className="text-sm font-normal text-zinc-500">{t("offUpToLive").replace("{n}", String(data.maxActiveOffers))}</span></h2>
              {!editing && canSend && <Button className="h-11" onClick={() => setEditing("new")}><Plus /> {t("offNew")}</Button>}
            </div>
            {editing && <OfferForm key={editing === "new" ? "new" : editing._id} scope={scope} offer={editing === "new" ? null : editing} services={svcList} today={today} onDone={() => { setEditing(null); void mutate(); }} onCancel={() => setEditing(null)} />}
            {!canSend && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("offManagedByOwner")}</p>}
            {data.offers.length === 0 && !editing ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">{t("offNone")}</p> : (
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {data.offers.map((o) => { const st = stateOf(o, today); return (
                  <li key={o._id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{o.title}</p>
                      <p className="text-xs text-zinc-500">{t("ownOffSuffix").replace("{v}", o.discountType === "PERCENTAGE" ? `${o.discountValue}%` : `₹${o.discountValue}`)} · {showDate(o.startsOn)} – {showDate(o.endsOn)} · {o.serviceIds.length === 0 ? t("offAllLower") : t("offNSvc").replace("{n}", String(o.serviceIds.length))}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATE_STYLE[st]}`}>{t(STATE_LABEL[st as keyof typeof STATE_LABEL])}</span>
                    {st !== "Ended" && <Button variant="outline" size="sm" disabled={!canSend} onClick={() => toggle(o)}>{o.status === "ACTIVE" ? t("offPause") : t("offResume")}</Button>}
                    <Button variant="ghost" size="icon" disabled={!canSend} aria-label={t("ownEditX").replace("{name}", o.title)} onClick={() => setEditing(o)}><Pencil /></Button>
                    <Button variant="ghost" size="icon" disabled={!canSend} aria-label={t("ownDeleteX").replace("{name}", o.title)} className="text-red-600" onClick={() => setToDelete(o)}><Trash2 /></Button>
                  </li>); })}
              </ul>
            )}
          </section>
          {canSend && <Campaigns scope={scope} liveOffers={live} />}
        </>
      )}
      <ConfirmDialog open={!!toDelete} title={t("offDelTitle")} description={toDelete ? t("offDelDesc").replace("{name}", toDelete.title) : ""} confirmLabel={t("offDelBtn")} busy={busy} onCancel={() => setToDelete(null)} onConfirm={remove} />
    </div>
  );
}
