import React from "react";
import { LanguageSelector } from "@/components/LanguageSelector";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <LanguageSelector />
        </div>
        {children}
      </div>
    </div>
  );
}
