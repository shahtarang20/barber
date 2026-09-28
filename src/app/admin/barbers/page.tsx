"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminBarbersPage() {
  const [barbers, setBarbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBarbers();
  }, []);

  const fetchBarbers = async () => {
    try {
      const res = await fetch("/api/admin/barbers");
      const data = await res.json();
      if (data.success) setBarbers(data.data);
    } catch (error) {
      console.error("Failed to fetch barbers", error);
    } finally {
      setLoading(false);
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
      } else {
        alert(data.error?.message || "Failed to update barber");
      }
    } catch (error) {
      alert("Error updating barber");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Manage Stores</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">View and manage all active barber stores on the platform.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500">Loading stores...</div>
        ) : barbers.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">No stores found.</div>
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
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {barbers.map((b) => (
                  <tr key={b._id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${!b.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">{b.barberCode}</td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100 font-medium">{b.name}</td>
                    <td className="px-6 py-4">
                      <div className="text-zinc-900 dark:text-zinc-100">{b.email}</div>
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
                    <td className="px-6 py-4 text-right space-x-2">
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
      </div>
    </div>
  );
}
