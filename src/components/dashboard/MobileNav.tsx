"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ClipboardList, Settings, Users, Store } from "lucide-react";

export function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Schedule", href: "/dashboard", icon: LayoutGrid },
    { name: "Today", href: "/dashboard/appointments", icon: ClipboardList },
    { name: "Customers", href: "/dashboard/customers", icon: Users },
    { name: "Shop", href: "/dashboard/shop", icon: Store },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-50 px-2 pb-safe">
        <nav className="flex justify-around py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center gap-1 min-w-[64px] ${
                  isActive
                    ? "text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
