"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlanGrantPanel } from "@/components/admin/PlanGrantPanel";
import { ShopCustomersPanel } from "@/components/admin/ShopCustomersPanel";
import { showDate } from "@/lib/usePlan";
import { toast } from "@/components/ui/toast";
import { PaginationControls } from "@/components/ui/pagination-controls";

interface ShopRow {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  memberCount: number;
  owner: { name: string; barberCode: string } | null;
  createdAt: string;
  /** The shop's plan and catalogue switch are its owner's. */
  plan?: { status: string; tier: string; granted: boolean; endsOn: string | null } | null;
  catalogueEnabled?: boolean;
  visitorLimit?: number | null;
  visitorUsed?: number;
  visitorLimitEffective?: number;
}

interface ShopMember {
  _id: string;
  name: string;
  barberCode: string;
  slug: string;
  isActive: boolean;
}

interface ShopDetail {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  ownerId: string;
  members: ShopMember[];
}

export default function AdminShopsPage() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; pages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ShopDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newMemberCode, setNewMemberCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchShops();
  }, [page, limit]);

  const fetchShops = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/shops?page=${page}&limit=${limit}`);
      const data = await res.json();
      if (data.success) {
        setShops(data.data);
        setPagination(data.pagination || null);
      }
    } catch (error) {
      console.error("Failed to fetch shops", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (shopId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`);
      const data = await res.json();
      if (data.success) setDetail(data.data);
    } catch (error) {
      console.error("Failed to fetch shop detail", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleExpand = (shopId: string) => {
    if (expandedId === shopId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(shopId);
    setDetail(null);
    fetchDetail(shopId);
  };

  const handleToggleActive = async (shop: ShopRow) => {
    try {
      const res = await fetch(`/api/admin/shops/${shop._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !shop.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: "Success", description: `${shop.name} ${!shop.isActive ? "reactivated" : "suspended"}.`, type: "success" });
        fetchShops();
        if (expandedId === shop._id) fetchDetail(shop._id);
      } else {
        toast.add({ title: "Error", description: data.error?.message || "Failed to update shop", type: "error" });
      }
    } catch (error) {
      toast.add({ title: "Error", description: "Error updating shop", type: "error" });
    }
  };

  const handleDeleteShop = async (shop: ShopRow) => {
    if (!confirm(`Delete "${shop.name}"? All ${shop.memberCount} member(s) will revert to being solo barbers — their own bookings and public links are unaffected.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/shops/${shop._id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: "Success", description: "Shop deleted.", type: "success" });
        setExpandedId(null);
        fetchShops();
      } else {
        toast.add({ title: "Error", description: data.error?.message || "Failed to delete shop", type: "error" });
      }
    } catch (error) {
      toast.add({ title: "Error", description: "Error deleting shop", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleAddMember = async (shopId: string) => {
    if (!newMemberCode.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barberCode: newMemberCode.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: "Success", description: data.data.message, type: "success" });
        setNewMemberCode("");
        fetchDetail(shopId);
        fetchShops();
      } else {
        toast.add({ title: "Error", description: data.error?.message || "Failed to add barber", type: "error" });
      }
    } catch (error) {
      toast.add({ title: "Error", description: "Error adding barber", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (shopId: string, barberId: string, name: string) => {
    if (!confirm(`Remove ${name} from this shop?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/members/${barberId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: "Success", description: data.data.message, type: "success" });
        fetchDetail(shopId);
        fetchShops();
      } else {
        toast.add({ title: "Error", description: data.error?.message || "Failed to remove barber", type: "error" });
      }
    } catch (error) {
      toast.add({ title: "Error", description: "Error removing barber", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Shops</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          Multi-barber storefronts — groups of barbers sharing one public booking page.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500">Loading shops...</div>
        ) : shops.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">No shops have been created yet.</div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {shops.map((shop) => {
              const isExpanded = expandedId === shop._id;
              return (
                <div key={shop._id}>
                  <div
                    onClick={() => toggleExpand(shop._id)}
                    className="p-4 sm:p-6 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-950/50"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${shop.isActive ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 line-through"}`}>{shop.name}</h3>
                        {!shop.isActive && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Suspended</span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 mt-1">
                        /s/{shop.slug} &middot; {shop.memberCount} barber{shop.memberCount === 1 ? "" : "s"} &middot; Owner: {shop.owner?.name || "Unknown"}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${shop.plan && shop.plan.tier !== "FREE" ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-600"}`}>
                          {shop.plan ? `${shop.plan.tier.charAt(0)}${shop.plan.tier.slice(1).toLowerCase()}${shop.plan.granted ? " · free access" : ""}${shop.plan.tier !== "FREE" && shop.plan.endsOn ? ` · until ${showDate(shop.plan.endsOn)}` : ""}` : "Free"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${shop.catalogueEnabled === false ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-800"}`}>Catalogue {shop.catalogueEnabled === false ? "off" : "on"}</span>
                      </p>
                    </div>
                    <div className="ml-auto mr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number" min="0"
                        key={`${shop._id}-${(shop as any).linkBookingLimit ?? "d"}`}
                        defaultValue={(shop as any).linkBookingLimit ?? ""}
                        placeholder="Default"
                        title="Bookings per month through the shop link (empty = platform default, 0 = unlimited)"
                        onBlur={async (e) => {
                          const v = e.target.value.trim();
                          if (v === String((shop as any).linkBookingLimit ?? "")) return;
                          const res = await fetch(`/api/admin/shops/${shop._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ linkBookingLimit: v === "" ? null : Number(v) }) });
                          const d = await res.json();
                          toast.add(d.success ? { title: "Success", description: "Link limit saved", type: "success" } : { title: "Error", description: d.error?.message || "Could not save", type: "error" });
                          fetchShops();
                        }}
                        className="w-24 px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent text-sm"
                      />
                      <div className={`text-xs mt-1 ${(shop as any).linkLimitEffective > 0 && (shop as any).linkUsed >= (shop as any).linkLimitEffective ? "text-red-600 font-medium" : "text-zinc-500"}`}>
                        {(shop as any).linkUsed ?? 0} this month{(shop as any).linkLimitEffective > 0 ? ` / ${(shop as any).linkLimitEffective}` : ""}
                      </div>
                    </div>
                    <div className="mr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number" min="0"
                        aria-label={`Visitor limit for ${shop.name}`}
                        key={`${shop._id}-v${shop.visitorLimit ?? "d"}`}
                        defaultValue={shop.visitorLimit ?? ""}
                        placeholder="Default"
                        title="Different visitors (unique IP addresses) who may open the shop link per month (empty = platform default, 0 = unlimited)"
                        onBlur={async (e) => {
                          const v = e.target.value.trim();
                          if (v === String(shop.visitorLimit ?? "")) return;
                          const res = await fetch(`/api/admin/shops/${shop._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitorLimit: v === "" ? null : Number(v) }) });
                          const d = await res.json();
                          toast.add(d.success ? { title: "Success", description: "Visitor limit saved", type: "success" } : { title: "Error", description: d.error?.message || "Could not save", type: "error" });
                          fetchShops();
                        }}
                        className="w-24 px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent text-sm"
                      />
                      <div className={`text-xs mt-1 ${(shop.visitorLimitEffective ?? 0) > 0 && (shop.visitorUsed ?? 0) >= (shop.visitorLimitEffective ?? 0) ? "text-red-600 font-medium" : "text-zinc-500"}`}>
                        {(shop.visitorUsed ?? 0)} visitors{(shop.visitorLimitEffective ?? 0) > 0 ? ` / ${(shop.visitorLimitEffective ?? 0)}` : ""}
                      </div>
                    </div>
                    <svg className={`w-5 h-5 text-zinc-400 transform transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isExpanded && (
                    <div className="px-4 sm:px-6 pb-6 bg-zinc-50/50 dark:bg-zinc-950/20 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                      {detailLoading || !detail ? (
                        <div className="py-6 text-center text-zinc-500 text-sm">Loading details...</div>
                      ) : (
                        <div className="space-y-4 pt-4">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleToggleActive(shop)} disabled={busy}>
                              {shop.isActive ? "Suspend Shop" : "Reactivate Shop"}
                            </Button>
                            <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
                              setBusy(true);
                              try {
                                const res = await fetch(`/api/admin/shops/${shop._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalogueEnabled: shop.catalogueEnabled === false }) });
                                const d = await res.json();
                                toast.add(d.success ? { title: "Done", description: `Catalogue ${shop.catalogueEnabled === false ? "switched on" : "switched off"} for this shop.`, type: "success" } : { title: "Error", description: d.error?.message || "Could not save", type: "error" });
                                fetchShops();
                              } finally { setBusy(false); }
                            }}>
                              {shop.catalogueEnabled === false ? "Switch catalogue on" : "Switch catalogue off"}
                            </Button>
                            <Link href={`/s/${shop.slug}`} target="_blank">
                              <Button variant="outline" size="sm">View Public Page</Button>
                            </Link>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteShop(shop)} disabled={busy}>
                              Delete Shop
                            </Button>
                          </div>

                          <ShopCustomersPanel shopId={shop._id} shopName={shop.name} />

                          <PlanGrantPanel endpoint={`/api/admin/shops/${shop._id}/grant`} plan={shop.plan ? { ...shop.plan } : null} onChanged={fetchShops} label={`${shop.name} (owner ${shop.owner?.name ?? ""})`} />

                          <div>
                            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Members</label>
                            <div className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
                              {detail.members.map((m) => {
                                const isOwnerRow = m._id === detail.ownerId;
                                return (
                                  <div key={m._id} className="flex items-center justify-between p-3">
                                    <div>
                                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                        {m.name} {isOwnerRow && <span className="text-xs text-zinc-500">(Owner)</span>}
                                        {!m.isActive && <span className="ml-2 text-xs text-red-600">(Suspended)</span>}
                                      </p>
                                      <p className="text-xs text-zinc-500">{m.barberCode}</p>
                                    </div>
                                    {!isOwnerRow && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700"
                                        onClick={() => handleRemoveMember(shop._id, m._id, m.name)}
                                        disabled={busy}
                                      >
                                        Remove
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              value={newMemberCode}
                              onChange={(e) => setNewMemberCode(e.target.value)}
                              placeholder="Barber code (e.g. b002)"
                              className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                            />
                            <Button size="sm" onClick={() => handleAddMember(shop._id)} disabled={busy || !newMemberCode.trim()}>
                              Add Barber
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <PaginationControls
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
        />
      </div>
    </div>
  );
}
