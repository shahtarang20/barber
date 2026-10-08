"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { LayoutGrid, ClipboardList, Settings, Users, Store } from "lucide-react";

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const navItems = [
    { name: t('schedule'), href: "/dashboard", icon: LayoutGrid },
    { name: t('apptToday'), href: "/dashboard/appointments", icon: ClipboardList },
    { name: t('customers'), href: "/dashboard/customers", icon: Users },
    { name: t('shop'), href: "/dashboard/shop", icon: Store },
    { name: t('settings'), href: "/dashboard/settings", icon: Settings },
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
                className={`flex flex-col items-center gap-1 min-w-0 flex-1 ${
                  isActive
                    ? "text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium max-w-full truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
