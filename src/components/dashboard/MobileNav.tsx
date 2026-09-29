"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Settings, Users, Link as LinkIcon } from "lucide-react";

export function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Schedule", href: "/dashboard", icon: CalendarDays },
    { name: "Appointments", href: "/dashboard/appointments", icon: CalendarDays },
    { name: "Customers", href: "/dashboard/customers", icon: Users },
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
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
