"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { QrCode } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const isOnLinkPage = pathname === "/dashboard/link";

  return (
    <div className="flex items-center justify-between p-4 md:px-8 md:py-5 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 md:hidden">BarberSaaS</h1>
      <div className="hidden md:block" />
      <Link
        href="/dashboard/link"
        title="Your booking link & QR code"
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isOnLinkPage
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
            : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-zinc-50 dark:hover:bg-zinc-900/50"
        }`}
      >
        <QrCode className="w-5 h-5" />
        <span className="hidden sm:inline">Link & QR</span>
      </Link>
    </div>
  );
}
