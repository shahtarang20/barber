"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
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

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500">Loading stores...</div>
        ) : barbers.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">{query ? `No store matches "${query}".` : "No stores found."}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Store ID</th>
                  <th className="px-6 py-4 font-medium">Owner Name</th>
                  <th className="px-6 py-4 font-medium">Email / Contact</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Premium (₹)</th>
                  <th className="px-6 py-4 font-medium">Due Date</th>
                  <th className="px-6 py-4 font-medium">Link limit / month</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {barbers.map((b) => (
                  <tr key={b._id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${!b.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">{b.barberCode}</td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100 font-medium">{b.name}</td>
                    <td className="px-6 py-4">
                      <div className="text-zinc-900 dark:text-zinc-100">{b.email || "—"}</div>
                      <div className="text-zinc-500 text-xs">{b.phone || "No phone"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleUpdate(b._id, { isActive: !b.isActive })}
                        className={`px-3 py-1 rounded-full text-xs font-bold ${b.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                      >
                        {b.isActive ? 'Active' : 'Suspended'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        type="number" 
                        defaultValue={b.premiumAmount || 0} 
                        onBlur={(e) => handleUpdate(b._id, { premiumAmount: Number(e.target.value) })}
                        className="w-24 px-2 py-1 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-transparent text-zinc-900 dark:text-zinc-100"
                        placeholder="Amount"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        type="number" 
                        min="1" max="31"
                        defaultValue={b.premiumDueDay || 28} 
                        onBlur={(e) => handleUpdate(b._id, { premiumDueDay: Number(e.target.value) })}
                        className="w-16 px-2 py-1 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-transparent text-zinc-900 dark:text-zinc-100"
                        placeholder="Day"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number" min="0"
                        key={`${b._id}-${b.linkBookingLimit ?? "d"}`}
                        defaultValue={b.linkBookingLimit ?? ""}
                        placeholder={`Default (${defaultLimit || "∞"})`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === String(b.linkBookingLimit ?? "")) return;
                          handleUpdate(b._id, { linkBookingLimit: v === "" ? null : Number(v) }).then(fetchBarbers);
                        }}
                        className="w-28 px-2 py-1 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-transparent text-zinc-900 dark:text-zinc-100"
                      />
                      <div className={`text-xs mt-1 ${b.linkLimitEffective > 0 && b.linkUsed >= b.linkLimitEffective ? "text-red-600 font-medium" : "text-zinc-500"}`}>
                        {b.linkUsed ?? 0} used{b.linkLimitEffective > 0 ? ` of ${b.linkLimitEffective}` : " · no limit"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleResetPassword(b._id, b.name)}>Reset Password</Button>
                      <Link href={`/b/${b.slug}`} target="_blank">
                        <Button variant="outline" size="sm">Visit Store</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
