"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CustomerStyleSelect } from "@/components/admin/CustomerStyleSelect";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import dynamic from "next/dynamic";
const PlanPaymentsDialog = dynamic(() => import("@/components/admin/PlanPaymentsDialog").then((m) => m.PlanPaymentsDialog), { ssr: false });
import { showDate } from "@/lib/usePlan";
import { PaginationControls } from "@/components/ui/pagination-controls";

export default function AdminBarbersPage() {
  const [barbers, setBarbers] = useState<any[]>([]);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; pages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  // Wait a moment after typing stops, then search from page 1.
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [search]);
  const [defaultLimit, setDefaultLimit] = useState(0);
  const [defaultVisitorLimit, setDefaultVisitorLimit] = useState(0);
  const [payFor, setPayFor] = useState<{ _id: string; name: string; premiumAmount: number } | null>(null);

  useEffect(() => {
    fetchBarbers();
  }, [page, limit, query]);

  const fetchBarbers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/barbers?page=${page}&limit=${limit}&search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setBarbers(data.data);
        setPagination(data.pagination || null);
        setDefaultLimit(data.defaultLinkLimit ?? 0);
        setDefaultVisitorLimit(data.defaultVisitorLimit ?? 0);
      }
    } catch (error) {
      console.error("Failed to fetch barbers", error);
    } finally {
      setLoading(false);
    }
  };

  const saveDefaultLimit = async (value: string) => {
    const res = await fetch("/api/admin/link-limit", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultLimit: Number(value || 0) }) });
    const data = await res.json();
    if (data.success) {
      toast.add({ title: "Success", description: "Default link limit saved", type: "success" });
      fetchBarbers();
    } else {
      toast.add({ title: "Error", description: data.error?.message || "Could not save", type: "error" });
    }
  };

  const saveDefaultVisitorLimit = async (value: string) => {
    const res = await fetch("/api/admin/visitor-limit", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultLimit: Number(value || 0) }) });
    const data = await res.json();
    if (data.success) {
      toast.add({ title: "Success", description: "Default visitor limit saved", type: "success" });
      fetchBarbers();
    } else {
      toast.add({ title: "Error", description: data.error?.message || "Could not save", type: "error" });
    }
  };

  const handleUpdate = async (id: string, updates: any) => {
    try {
      const res = await fetch(`/api/admin/barbers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setBarbers(barbers.map(b => b._id === id ? { ...b, ...updates } : b));
        toast.add({ title: "Success", description: "Store updated", type: "success" });
      } else {
        toast.add({ title: "Error", description: data.error?.message || "Failed to update barber", type: "error" });
      }
    } catch (error) {
      toast.add({ title: "Error", description: "Error updating barber", type: "error" });
    }
  };

  const handleResetPassword = async (id: string, name: string) => {
    if (!confirm(`Reset ${name}'s password? Their current password will stop working immediately.`)) return;
    try {
      const res = await fetch(`/api/admin/barbers/${id}/reset-password`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        window.prompt(
          `New temporary password for ${name} (copy this now — it won't be shown again). Share it with them securely:`,
          data.data.tempPassword
        );
      } else {
        toast.add({ title: "Error", description: data.error?.message || "Failed to reset password", type: "error" });
      }
    } catch (error) {
      toast.add({ title: "Error", description: "Error resetting password", type: "error" });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Manage Stores</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">View and manage all active barber stores on the platform.</p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search a barber by name, code, phone, email or link…"
        className="w-full h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 text-sm"
      />

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[16rem]">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">Booking-link limit (default)</p>
          <p className="text-sm text-zinc-500">Bookings per month a barber or shop can receive through their link. 0 = unlimited. A number typed in a row below overrides this.</p>
        </div>
        <input
          key={defaultLimit}
          type="number" min="0"
          defaultValue={defaultLimit}
          onBlur={(e) => e.target.value !== String(defaultLimit) && saveDefaultLimit(e.target.value)}
          className="w-28 px-2 py-2 border border-zinc-200 rounded-md bg-transparent text-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[16rem]">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">Visitor limit (default)</p>
          <p className="text-sm text-zinc-500">How many different visitors (unique IP addresses) may open a barber&apos;s or shop&apos;s link in a month. 0 = unlimited. Visitors already counted keep access; the next new one sees &quot;closed&quot;. A number typed in a row below overrides this.</p>
        </div>
        <input
          key={`v${defaultVisitorLimit}`}
          type="number" min="0"
          aria-label="Default visitor limit per month"
          defaultValue={defaultVisitorLimit}
          onBlur={(e) => e.target.value !== String(defaultVisitorLimit) && saveDefaultVisitorLimit(e.target.value)}
          className="w-28 px-2 py-2 border border-zinc-200 rounded-md bg-transparent text-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500">Loading stores...</div>
        ) : barbers.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">{query ? `No store matches "${query}".` : "No stores found."}</div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {barbers.map((b) => {
              const field = "w-full h-10 px-2 border border-zinc-200 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-transparent text-zinc-900 dark:text-zinc-100";
              const lab = "mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400";
              return (
                <li key={b._id} className={`p-4 sm:p-5 space-y-4 ${!b.isActive ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">{b.barberCode}</span>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 break-words min-w-0">{b.name}</h3>
                    <button
                      onClick={() => handleUpdate(b._id, { isActive: !b.isActive })}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${b.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                    >
                      {b.isActive ? "Active" : "Suspended"}
                    </button>
                    {b.plan && (b.plan.status !== "FREE" || b.plan.granted) ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${b.plan.status === "ACTIVE" ? "bg-green-100 text-green-700" : b.plan.status === "GRACE" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>{b.plan.granted ? "FREE ACCESS" : b.plan.status}</span>
                    ) : <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600">Free</span>}
                    <div className="ml-auto flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleResetPassword(b._id, b.name)}>Reset Password</Button>
                      <Link href={`/b/${b.slug}`} target="_blank"><Button variant="outline" size="sm">Visit Store</Button></Link>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="min-w-0">
                      <span className={lab}>Email</span>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100 break-all">{b.email || "—"}</p>
                    </div>
                    <div className="min-w-0">
                      <label className={lab} htmlFor={`ph-${b._id}`}>Phone</label>
                      <input
                        id={`ph-${b._id}`}
                        type="tel" inputMode="numeric"
                        key={`${b._id}-${b.phone ?? ""}`}
                        defaultValue={b.phone ?? ""}
                        placeholder="Add phone"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === (b.phone ?? "")) return;
                          handleUpdate(b._id, { phone: v }).then(fetchBarbers);
                        }}
                        className={field}
                      />
                      {b.phone && (
                        <div className="mt-1 flex gap-3 text-xs">
                          <a className="text-blue-600 hover:underline" href={`tel:${b.phone}`}>Call</a>
                          <a className="text-green-700 hover:underline" href={`https://wa.me/91${b.phone}`} target="_blank" rel="noreferrer">WhatsApp</a>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <label className={lab} htmlFor={`pm-${b._id}`}>Premium (₹)</label>
                      <input id={`pm-${b._id}`} type="number" defaultValue={b.premiumAmount || 0} onBlur={(e) => handleUpdate(b._id, { premiumAmount: Number(e.target.value) })} className={field} placeholder="Amount" />
                    </div>
                    <div className="min-w-0">
                      <label className={lab} htmlFor={`dd-${b._id}`}>Due day of month</label>
                      <input id={`dd-${b._id}`} type="number" min="1" max="31" defaultValue={b.premiumDueDay || 28} onBlur={(e) => handleUpdate(b._id, { premiumDueDay: Number(e.target.value) })} className={field} placeholder="Day" />
                    </div>

                    <div className="min-w-0">
                      <span className={lab}>Plan</span>
                      {b.plan && (b.plan.status !== "FREE" || b.plan.granted) ? (
                        <p className="text-xs text-zinc-600 dark:text-zinc-300">{b.plan.granted ? `${b.plan.tier.toLowerCase()} until` : b.plan.estimated ? "due" : "ends"} {showDate(b.plan.endsOn)}{b.plan.daysLeft !== null && b.plan.daysLeft <= 3 ? ` (${b.plan.daysLeft < 0 ? `${-b.plan.daysLeft}d ago` : `${b.plan.daysLeft}d`})` : ""}</p>
                      ) : <p className="text-xs text-zinc-500">Free plan</p>}
                      <button type="button" className="mt-1 min-h-8 text-xs text-blue-600 underline" onClick={() => setPayFor({ _id: b._id, name: b.name, premiumAmount: b.premiumAmount || 0 })}>Payments</button>
                    </div>
                    <div className="min-w-0">
                      <label className={lab} htmlFor={`ll-${b._id}`}>Link limit / month</label>
                      <input
                        id={`ll-${b._id}`}
                        type="number" min="0"
                        key={`${b._id}-${b.linkBookingLimit ?? "d"}`}
                        defaultValue={b.linkBookingLimit ?? ""}
                        placeholder={`Default (${defaultLimit || "∞"})`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === String(b.linkBookingLimit ?? "")) return;
                          handleUpdate(b._id, { linkBookingLimit: v === "" ? null : Number(v) }).then(fetchBarbers);
                        }}
                        className={field}
                      />
                      <div className={`text-xs mt-1 ${b.linkLimitEffective > 0 && b.linkUsed >= b.linkLimitEffective ? "text-red-600 font-medium" : "text-zinc-500"}`}>
                        {b.linkUsed ?? 0} used{b.linkLimitEffective > 0 ? ` of ${b.linkLimitEffective}` : " · no limit"}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <label className={lab} htmlFor={`vl-${b._id}`}>Visitors (IPs) / month</label>
                      <input
                        id={`vl-${b._id}`}
                        type="number" min="0"
                        aria-label={`Visitor limit for ${b.name}`}
                        key={`${b._id}-v${b.visitorLimit ?? "d"}`}
                        defaultValue={b.visitorLimit ?? ""}
                        placeholder={`Default (${defaultVisitorLimit || "∞"})`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === String(b.visitorLimit ?? "")) return;
                          handleUpdate(b._id, { visitorLimit: v === "" ? null : Number(v) }).then(fetchBarbers);
                        }}
                        className={field}
                      />
                      <div className={`text-xs mt-1 ${b.visitorLimitEffective > 0 && b.visitorUsed >= b.visitorLimitEffective ? "text-red-600 font-medium" : "text-zinc-500"}`}>
                        {b.visitorUsed ?? 0} visitors{b.visitorLimitEffective > 0 ? ` of ${b.visitorLimitEffective}` : " · no limit"}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <span className={lab}>Catalogue</span>
                      <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={b.catalogueEnabled !== false}
                          onChange={(e) => handleUpdate(b._id, { catalogueEnabled: e.target.checked })}
                          aria-label={`Premium catalogue for ${b.name}`}
                        />
                        {b.catalogueEnabled !== false ? "On" : "Off"}
                      </label>
                      <div className="mt-1"><CustomerStyleSelect ownerType="BARBER" ownerId={b._id} name={b.name} /></div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {payFor && <PlanPaymentsDialog barber={payFor} onClose={() => setPayFor(null)} onChanged={fetchBarbers} />}
        <PaginationControls
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
        />
      </div>
    </div>
  );
}
