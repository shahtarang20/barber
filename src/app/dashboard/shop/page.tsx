"use client";

import { copyText } from "@/lib/shareLink";
import { StaffAccess } from "@/components/dashboard/StaffAccess";
import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { FrontDeskBooking } from "@/components/dashboard/FrontDeskBooking";
import { ShopCustomers } from "@/components/dashboard/ShopCustomers";
import { MyBarberCode } from "@/components/dashboard/MyBarberCode";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ShopMember {
  _id: string;
  name: string;
  barberCode: string;
  slug: string;
}

interface ShopData {
  _id: string;
  name: string;
  slug: string;
  ownerId: string;
  isOwner: boolean;
  viewerId: string;
  members: ShopMember[];
  pendingInvites?: { _id: string; name?: string; barberCode?: string }[];
  staff?: { userId: string; catalogue: boolean; analytics: boolean }[];
  staffLevel?: "NONE" | "BASIC" | "FULL";
}

interface MyInvite {
  _id: string;
  shopName: string;
  invitedBy?: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function ShopPage() {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR("/api/barber/shop", fetcher);
  const shop: ShopData | null = data?.success ? data.data : null;
  const { data: invitesData, mutate: mutateInvites } = useSWR("/api/barber/shop/invites", fetcher);
  const myInvites: MyInvite[] = invitesData?.success ? invitesData.data : [];
  const [answeringId, setAnsweringId] = useState<string | null>(null);

  const answerInvite = async (id: string, action: "accept" | "decline") => {
    setAnsweringId(id);
    try {
      const res = await fetch(`/api/barber/shop/invites/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      toast.add({
        title: result.success ? t('done') : t('error'),
        description: result.success ? result.data.message : result.error?.message || t('genericError'),
        type: result.success ? "success" : "error",
      });
      mutate();
      mutateInvites();
    } catch {
      toast.add({ title: t('error'), description: t('genericError'), type: "error" });
    } finally {
      setAnsweringId(null);
    }
  };

  const withdrawInvite = async (id: string) => {
    setAnsweringId(id);
    try {
      const res = await fetch(`/api/barber/shop/invites/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!result.success) toast.add({ title: t('error'), description: result.error?.message || t('genericError'), type: "error" });
      mutate();
    } finally {
      setAnsweringId(null);
    }
  };

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMemberCode, setNewMemberCode] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/barber/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      const result = await res.json();
      if (result.success) {
        toast.add({ title: t('done'), description: t('shopCreated'), type: "success" });
        mutate();
      } else {
        toast.add({ title: t('error'), description: result.error?.message || t('genericError'), type: "error" });
      }
    } catch {
      toast.add({ title: t('error'), description: t('genericError'), type: "error" });
    } finally {
      setCreating(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberCode.trim()) return;
    setAddingMember(true);
    try {
      const res = await fetch("/api/barber/shop/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barberCode: newMemberCode.trim() }),
      });
      const result = await res.json();
      if (result.success) {
        toast.add({ title: t('done'), description: result.data.message, type: "success" });
        setNewMemberCode("");
        mutate();
      } else {
        toast.add({ title: t('error'), description: result.error?.message || t('genericError'), type: "error" });
      }
    } catch {
      toast.add({ title: t('error'), description: t('genericError'), type: "error" });
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string, isSelf: boolean) => {
    if (!confirm(isSelf ? t('shopLeaveConfirm') : t('shopRemoveConfirm'))) return;
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/barber/shop/members/${memberId}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.add({ title: t('done'), description: result.data.message, type: "success" });
        mutate();
      } else {
        toast.add({ title: t('error'), description: result.error?.message || t('genericError'), type: "error" });
      }
    } catch {
      toast.add({ title: t('error'), description: t('genericError'), type: "error" });
    } finally {
      setRemovingId(null);
    }
  };

  const [copied, setCopied] = useState(false);
  const shopUrl = (slug: string) => `${window.location.origin}/s/${slug}`;

  const copyShopLink = async (slug: string) => {
    if (!(await copyText(shopUrl(slug)))) {
      toast.add({ title: t('error'), description: shopUrl(slug), type: "error" }); // refused: show it so it can be copied by hand
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Opens the phone's own share sheet (WhatsApp, SMS, ...). Where there is none (some computers) it copies instead.
  const shareShopLink = async (name: string, slug: string) => {
    if (typeof navigator.share !== "function") return copyShopLink(slug);
    try {
      await navigator.share({ title: t('linkShareTitle').replace('{name}', name), text: t('linkShareText'), url: shopUrl(slug) });
    } catch (err) {
      // Closing the share sheet is not an error; anything else falls back to copying.
      if ((err as { name?: string }).name !== "AbortError") await copyShopLink(slug);
    }
  };

  const handleDeleteShop = async () => {
    if (!confirm(t('shopDeleteConfirm'))) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/barber/shop", { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.add({ title: t('done'), description: t('shopDeleted'), type: "success" });
        mutate();
      } else {
        toast.add({ title: t('error'), description: result.error?.message || t('genericError'), type: "error" });
      }
    } catch {
      toast.add({ title: t('error'), description: t('genericError'), type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) return <div className="p-12 text-center text-zinc-500">{t('loading')}</div>;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t('shop')}</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          {t('shopIntro')}
        </p>
      </div>

      <MyBarberCode />

      {!shop && myInvites.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('shopInvitedTitle')}</h2>
          <p role="note" className="rounded-lg bg-white/70 p-3 text-sm text-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300">{t('shopJoinNotice')}</p>
          {myInvites.map((inv) => (
            <div key={inv._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-zinc-800 dark:text-zinc-200">
                <span className="font-semibold">{inv.shopName}</span>
                {inv.invitedBy ? <span className="text-sm text-zinc-500"> — {t('shopInvitedBy').replace('{name}', inv.invitedBy)}</span> : null}
              </p>
              <div className="flex gap-2">
                <Button className="h-11 px-5" disabled={answeringId === inv._id} onClick={() => answerInvite(inv._id, "accept")}>{t('shopAccept')}</Button>
                <Button variant="outline" className="h-11 px-5" disabled={answeringId === inv._id} onClick={() => answerInvite(inv._id, "decline")}>{t('shopDecline')}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!shop ? (
        <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('shopCreateTitle')}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('shopCreateDesc')}
          </p>
          <div className="space-y-2">
            <Label>{t('shopNameLabel')}</Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={t('shopNamePh')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('shopUrlLabel')}</Label>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="whitespace-nowrap">{typeof window !== "undefined" ? window.location.host : ""}/s/</span>
              <Input
                value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                placeholder="rahul-hair-studio"
              />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating || !name || !slug}>
            {creating ? t('shopCreating') : t('shopCreateBtn')}
          </Button>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('shopAfterCreateHint')}</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 min-w-0 break-words">{shop.name}</h2>
              {shop.isOwner && (
                <Button variant="ghost" className="text-red-600 hover:text-red-700 shrink-0" onClick={handleDeleteShop} disabled={deleting}>
                  {deleting ? t('shopDeleting') : t('shopDelete')}
                </Button>
              )}
            </div>
            <p className="text-sm text-blue-600 break-all">
              {typeof window !== "undefined" ? window.location.origin : ""}/s/{shop.slug}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="h-11 flex-1 sm:flex-none" onClick={() => copyShopLink(shop.slug)}>
                {copied ? t('linkCopied') : <><Copy className="w-4 h-4 mr-2" /> {t('linkCopy')}</>}
              </Button>
              <Button variant="outline" className="h-11 flex-1 sm:flex-none" onClick={() => shareShopLink(shop.name, shop.slug)}>
                <Share2 className="w-4 h-4 mr-2" /> {t('linkShare')}
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('shopMembers')}</h2>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {shop.members.map((m) => {
                const isOwnerRow = m._id === shop.ownerId;
                const isSelfRow = m._id === shop.viewerId;
                // Owner row: no button (removed only via Delete Shop).
                // Any other row: the shop owner can remove them, or the
                // barber themselves can leave.
                const canAct = !isOwnerRow && (shop.isOwner || isSelfRow);

                return (
                  <div key={m._id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {m.name} {isOwnerRow && <span className="text-xs text-zinc-500">{t('shopOwner')}</span>}
                      </p>
                      <p className="text-xs text-zinc-500">{m.barberCode}</p>
                    </div>
                    {canAct && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleRemoveMember(m._id, isSelfRow)}
                        disabled={removingId === m._id}
                      >
                        {isSelfRow ? t('shopLeave') : t('shopRemove')}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {shop.isOwner && (shop.pendingInvites?.length ?? 0) > 0 && (
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t('shopWaiting')}</h3>
                {shop.pendingInvites!.map((inv) => (
                  <div key={inv._id} className="flex items-center justify-between">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{inv.name} <span className="text-xs text-zinc-500">{inv.barberCode}</span></p>
                    <Button variant="ghost" size="sm" className="text-red-600" disabled={answeringId === inv._id} onClick={() => withdrawInvite(inv._id)}>{t('shopWithdraw')}</Button>
                  </div>
                ))}
              </div>
            )}

            {shop.isOwner && (
              <div className="flex items-center gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <Input
                  value={newMemberCode}
                  onChange={(e) => setNewMemberCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newMemberCode.trim() && !addingMember) handleAddMember(); }}
                  placeholder={t('shopCodePh')}
                />
                <Button onClick={handleAddMember} disabled={addingMember || !newMemberCode.trim()}>
                  {addingMember ? t('shopSending') : t('shopInvite')}
                </Button>
              </div>
            )}
          </div>

          {shop.isOwner && <StaffAccess members={shop.members} ownerId={shop.ownerId} staff={shop.staff ?? []} level={shop.staffLevel ?? "NONE"} onChanged={() => mutate()} />}

          <FrontDeskBooking shopSlug={shop.slug} members={shop.members} />
          <ShopCustomers />
        </>
      )}
    </div>
  );
}
