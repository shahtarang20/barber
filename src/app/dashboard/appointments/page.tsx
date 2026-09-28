"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export default function AppointmentsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/barber/bookings`);
      const data = await res.json();
      if (data.success) {
        setBookings(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: "cancel" | "complete" | "no-show") => {
    if (action === "cancel" && !confirm("Are you sure you want to cancel this booking?")) return;
    
    try {
      const res = await fetch(`/api/bookings/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchBookings();
      } else {
        alert(data.error?.message || `Failed to ${action} booking`);
      }
    } catch (error) {
      alert(`Error updating booking`);
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (filter === "ALL") return true;
    if (filter === "UPCOMING") return b.status === "CONFIRMED" && new Date(b.date) >= new Date(new Date().setHours(0,0,0,0));
    if (filter === "TODAY") return b.status === "CONFIRMED" && b.date === format(new Date(), "yyyy-MM-dd");
    return b.status === filter;
  });

  const tabs = [
    { label: "All", value: "ALL" },
    { label: "Upcoming", value: "UPCOMING" },
    { label: "Today", value: "TODAY" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Cancelled", value: "CANCELLED" },
    { label: "No Show", value: "NO_SHOW" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Appointments</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">Manage your customer bookings and history.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === tab.value 
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" 
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500">Loading appointments...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">No appointments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Booking ID</th>
                  <th className="px-6 py-4 font-medium">Customer</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium">Date & Time</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredBookings.map((b) => (
                  <tr key={b._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">{b.bookingNumber}</td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">{b.customerId?.name || "Unknown"}</td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{b.customerId?.phone || "N/A"}</td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">
                      {format(new Date(b.date), "MMM d, yyyy")} <span className="text-zinc-500 ml-2">{b.startTime}</span>
                    </td>
                    <td className="px-6 py-4">
                      {b.status === "CONFIRMED" && <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Confirmed</span>}
                      {b.status === "COMPLETED" && <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Completed</span>}
                      {b.status === "CANCELLED" && <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Cancelled</span>}
                      {b.status === "NO_SHOW" && <span className="px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">No Show</span>}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 flex justify-end">
                      {b.status === "CONFIRMED" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleAction(b._id, "complete")}>Complete</Button>
                          <Button variant="outline" size="sm" onClick={() => handleAction(b._id, "cancel")} className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50">Cancel</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleAction(b._id, "no-show")}>No Show</Button>
                        </>
                      )}
                      {b.status !== "CONFIRMED" && (
                        <span className="text-zinc-400 text-xs italic">No actions</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
