"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { showDate } from "@/lib/usePlan";

interface Row { _id: string; name: string; phone: string; visits: number; upcoming: number; lastVisit: string | null; barbers: string[] }
interface Payload { data: { shop: { name: string }; customers: Row[] }; pagination: { total: number; page: number; pages: number } }
const fetcher = (url: string) => fetch(url).then(async (r) => { const j = await r.json().catch(() => null); if (!r.ok || !j?.success) throw new Error(j?.error?.message || "Could not load"); return j as Payload; });

/**
 * Admin: the customers of ONE shop, listed under that shop's name. It is the same list the shop's own barbers see
 * (same code), so what the admin sees under "Alpha Salon" is exactly Alpha Salon's customers and nobody else's.
 */
export function ShopCustomersPanel({ shopId, shopName }: { shopId: string; shopName: string }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, isLoading } = useSWR(`/api/admin/shops/${shopId}/customers?page=${page}&limit=10&search=${encodeURIComponent(query)}`, fetcher, { revalidateOnFocus: false });
  const rows = data?.data.customers ?? [];
  const total = data?.pagination.total ?? 0;

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900" aria-label={`Customers of ${shopName}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Customers of {shopName} <span className="font-normal text-zinc-500">({total})</span></h3>
        <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1); }} className="flex gap-2">
          <input type="search" aria-label={`Search ${shopName}'s customers`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone" className="h-9 w-40 rounded-md border border-zinc-200 bg-transparent px-2 text-sm dark:border-zinc-700" />
          <Button type="submit" variant="outline" size="sm">Search</Button>
        </form>
      </div>
      {error ? <p role="alert" className="text-sm text-red-600">{(error as Error).message}</p> : isLoading ? <p className="text-sm text-zinc-500">Loading…</p> : rows.length === 0 ? <p className="text-sm text-zinc-500">{query ? "No customer matches." : "This shop has no customers yet."}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="text-zinc-500"><tr><th className="py-1 pr-3 font-medium">Customer</th><th className="py-1 pr-3 font-medium">Phone</th><th className="py-1 pr-3 font-medium">Visits</th><th className="py-1 pr-3 font-medium">Upcoming</th><th className="py-1 pr-3 font-medium">Last visit</th><th className="py-1 font-medium">Barbers</th></tr></thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r._id}><td className="py-1.5 pr-3 font-medium">{r.name}</td><td className="py-1.5 pr-3">{r.phone || "—"}</td><td className="py-1.5 pr-3">{r.visits}</td><td className="py-1.5 pr-3">{r.upcoming}</td><td className="py-1.5 pr-3">{r.lastVisit ? showDate(r.lastVisit) : "—"}</td><td className="py-1.5">{r.barbers.join(", ")}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-zinc-500">Page {data.pagination.page} of {data.pagination.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </section>
  );
}
