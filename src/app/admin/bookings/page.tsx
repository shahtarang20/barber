"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { PaginationControls } from "@/components/ui/pagination-controls";

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
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

  useEffect(() => {
    fetchBookings();
  }, [page, limit, query]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings?page=${page}&limit=${limit}&search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setBookings(data.data);
        setPagination(data.pagination || null);
      }
    } catch (error) {
      console.error("Failed to fetch bookings", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Global Bookings</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">View all bookings across all stores on the platform.</p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by Booking ID, customer name or phone, barber name or code, or shop name…"
        className="w-full h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 text-sm"
      />

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500">Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">No bookings found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Booking ID</th>
                  <th className="px-6 py-4 font-medium">Shop</th>
                  <th className="px-6 py-4 font-medium">Store (Barber)</th>
                  <th className="px-6 py-4 font-medium">Customer</th>
                  <th className="px-6 py-4 font-medium">Date & Time</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {bookings.map((b) => (
                  <tr key={b._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">{b.bookingNumber}</td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">{b.shopName ? <span className="font-medium">{b.shopName}</span> : <span className="text-zinc-400">Solo barber</span>}</td>
                    <td className="px-6 py-4">
                      <div className="text-zinc-900 dark:text-zinc-100 font-medium">{b.barberId?.name || "Unknown"}</div>
                      <div className="text-zinc-500 text-xs">{b.barberId?.barberCode || ""}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-zinc-900 dark:text-zinc-100 font-medium">{b.customerId?.name || "Unknown"}</div>
                      <div className="text-zinc-500 text-xs">{b.customerId?.phone || "No phone"}</div>
                    </td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">
                      {b.date ? format(new Date(b.date), "MMM d, yyyy") : "N/A"} <span className="text-zinc-500 ml-2">{b.startTime}</span>
                    </td>
                    <td className="px-6 py-4">
                      {b.status === "CONFIRMED" && <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Confirmed</span>}
                      {b.status === "COMPLETED" && <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Completed</span>}
                      {b.status === "CANCELLED" && <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Cancelled</span>}
                      {b.status === "NO_SHOW" && <span className="px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">No Show</span>}
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
