"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Store, Building2, CalendarDays, Settings, Database } from "lucide-react";

export function AdminMobileNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Overview", href: "/admin", icon: LayoutGrid },
    { name: "Stores", href: "/admin/barbers", icon: Store },
    { name: "Shops", href: "/admin/shops", icon: Building2 },
    { name: "Bookings", href: "/admin/bookings", icon: CalendarDays },
    { name: "Data", href: "/admin/data", icon: Database },
    { name: "Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <>
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 tracking-tight">
          Barber<span className="text-zinc-500 font-light">Admin</span>
        </h1>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-50 px-1 pb-safe">
        <nav className="flex justify-around py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center gap-1 min-w-[56px] ${
                  isActive
                    ? "text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
