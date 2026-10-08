import React from "react";
import { redirect } from "next/navigation";
import { signedInHome } from "@/lib/auth";
import { LanguageSelector } from "@/components/LanguageSelector";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const home = await signedInHome();
  if (home) redirect(home);
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
