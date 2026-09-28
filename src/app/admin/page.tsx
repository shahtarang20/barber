"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, barbersRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/barbers")
      ]);
      const statsData = await statsRes.json();
      const barbersData = await barbersRes.json();
      
      if (statsData.success) setStats(statsData.data);
      if (barbersData.success) setBarbers(barbersData.data);
    } catch (error) {
      console.error("Failed to fetch admin data", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Admin Overview</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">Manage all barber stores and platform metrics.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-zinc-500">Loading admin panel...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Barbers</p>
              <p className="text-3xl font-bold mt-2 text-zinc-900 dark:text-zinc-50">{stats?.totalBarbers || 0}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Customers</p>
              <p className="text-3xl font-bold mt-2 text-zinc-900 dark:text-zinc-50">{stats?.totalCustomers || 0}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 sm:p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-sm">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-500">Total Bookings</p>
              <p className="text-3xl font-bold mt-2 text-blue-700 dark:text-blue-400">{stats?.totalBookings || 0}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 p-4 sm:p-6 rounded-2xl border border-green-100 dark:border-green-900/30 shadow-sm">
              <p className="text-sm font-medium text-green-600 dark:text-green-500">Bookings Today</p>
              <p className="text-3xl font-bold mt-2 text-green-700 dark:text-green-400">{stats?.todayBookings || 0}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden mt-8">
            <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Active Stores (Barbers)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-4 font-medium">Barber Code</th>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Email</th>
                    <th className="px-6 py-4 font-medium">Public URL</th>
                    <th className="px-6 py-4 font-medium">Total Bookings</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {barbers.map((b) => (
                    <tr key={b._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">{b.barberCode}</td>
                      <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100 font-medium">{b.name}</td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{b.email}</td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                        <a href={`/b/${b.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">/b/{b.slug}</a>
                      </td>
                      <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">{b.bookingCount}</td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/b/${b.slug}`}>
                          <Button variant="outline" size="sm">View Public Page</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {barbers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">No barbers found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
