"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

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
        title: result.success ? "Done" : "Error",
        description: result.success ? result.data.message : result.error?.message || "Something went wrong",
        type: result.success ? "success" : "error",
      });
      mutate();
      mutateInvites();
    } catch {
      toast.add({ title: "Error", description: "Something went wrong", type: "error" });
    } finally {
      setAnsweringId(null);
    }
  };

  const withdrawInvite = async (id: string) => {
    setAnsweringId(id);
    try {
      const res = await fetch(`/api/barber/shop/invites/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!result.success) toast.add({ title: "Error", description: result.error?.message || "Something went wrong", type: "error" });
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
        toast.add({ title: "Success", description: "Shop created!", type: "success" });
        mutate();
      } else {
        toast.add({ title: "Error", description: result.error?.message || "Failed to create shop", type: "error" });
      }
    } catch {
      toast.add({ title: "Error", description: "Error creating shop", type: "error" });
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
        toast.add({ title: "Success", description: result.data.message, type: "success" });
        setNewMemberCode("");
        mutate();
      } else {
        toast.add({ title: "Error", description: result.error?.message || "Failed to add barber", type: "error" });
      }
    } catch {
      toast.add({ title: "Error", description: "Error adding barber", type: "error" });
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string, isSelf: boolean) => {
    if (!confirm(isSelf ? "Leave this shop?" : "Remove this barber from your shop?")) return;
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/barber/shop/members/${memberId}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.add({ title: "Success", description: result.data.message, type: "success" });
        mutate();
      } else {
        toast.add({ title: "Error", description: result.error?.message || "Failed to remove", type: "error" });
      }
    } catch {
      toast.add({ title: "Error", description: "Error removing barber", type: "error" });
    } finally {
      setRemovingId(null);
    }
  };

  const handleDeleteShop = async () => {
    if (!confirm("Delete this shop? All members (including you) will become solo barbers again — their own bookings and public links are unaffected.")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/barber/shop", { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.add({ title: "Success", description: "Shop deleted.", type: "success" });
        mutate();
      } else {
        toast.add({ title: "Error", description: result.error?.message || "Failed to delete shop", type: "error" });
      }
    } catch {
      toast.add({ title: "Error", description: "Error deleting shop", type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) return <div className="p-12 text-center text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Shop</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          Group multiple barbers under one shop so customers can pick who they want from a single storefront.
        </p>
      </div>

      {!shop && myInvites.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">You've been invited to a shop</h2>
          {myInvites.map((inv) => (
            <div key={inv._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-zinc-800 dark:text-zinc-200">
                <span className="font-semibold">{inv.shopName}</span>
                {inv.invitedBy ? <span className="text-sm text-zinc-500"> — invited by {inv.invitedBy}</span> : null}
              </p>
              <div className="flex gap-2">
                <Button className="h-11 px-5" disabled={answeringId === inv._id} onClick={() => answerInvite(inv._id, "accept")}>Accept</Button>
                <Button variant="outline" className="h-11 px-5" disabled={answeringId === inv._id} onClick={() => answerInvite(inv._id, "decline")}>Decline</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!shop ? (
        <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Create a Shop</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            You're currently a solo barber — your existing public link keeps working exactly as before.
            Creating a shop lets you invite other barbers to join under one name.
          </p>
          <div className="space-y-2">
            <Label>Shop Name</Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Rahul Hair Studio"
            />
          </div>
          <div className="space-y-2">
            <Label>Shop URL</Label>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="whitespace-nowrap">yoursite.com/s/</span>
              <Input
                value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                placeholder="rahul-hair-studio"
              />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating || !name || !slug}>
            {creating ? "Creating..." : "Create Shop"}
          </Button>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{shop.name}</h2>
                <button
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/s/${shop.slug}`);
                    toast.add({ title: "Copied", description: "Shop link copied to clipboard.", type: "success" });
                  }}
                >
                  {typeof window !== "undefined" ? window.location.origin : ""}/s/{shop.slug} (copy)
                </button>
              </div>
              {shop.isOwner && (
                <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={handleDeleteShop} disabled={deleting}>
                  {deleting ? "Deleting..." : "Delete Shop"}
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Members</h2>
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
                        {m.name} {isOwnerRow && <span className="text-xs text-zinc-500">(Owner)</span>}
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
                        {isSelfRow ? "Leave" : "Remove"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {shop.isOwner && (shop.pendingInvites?.length ?? 0) > 0 && (
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Waiting for a reply</h3>
                {shop.pendingInvites!.map((inv) => (
                  <div key={inv._id} className="flex items-center justify-between">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{inv.name} <span className="text-xs text-zinc-500">{inv.barberCode}</span></p>
                    <Button variant="ghost" size="sm" className="text-red-600" disabled={answeringId === inv._id} onClick={() => withdrawInvite(inv._id)}>Withdraw</Button>
                  </div>
                ))}
              </div>
            )}

            {shop.isOwner && (
              <div className="flex items-center gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <Input
                  value={newMemberCode}
                  onChange={(e) => setNewMemberCode(e.target.value)}
                  placeholder="Barber code (e.g. b002)"
                />
                <Button onClick={handleAddMember} disabled={addingMember || !newMemberCode.trim()}>
                  {addingMember ? "Sending..." : "Invite"}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
