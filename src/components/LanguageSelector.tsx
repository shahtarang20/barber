"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

/** `refresh`: for pages whose words are drawn by the server (like the home page): re-draw them in the new language. */
export function LanguageSelector({ refresh = false }: { refresh?: boolean }) {
  const { language, setLanguage } = useTranslation();
  const router = useRouter();

  return (
    <select
      value={language}
      onChange={(e) => {
        const next = e.target.value as "en" | "hi" | "gu" | "mr";
        if (refresh) {
          // The server reads this cookie to choose the language, so write it before asking for the page again.
          document.cookie = `lang=${next}; path=/; max-age=31536000; SameSite=Lax`;
          router.refresh();
        }
        setLanguage(next);
      }}
      className="h-11 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
    >
      <option value="en">English</option>
      <option value="hi">हिन्दी</option>
      <option value="gu">ગુજરાતી</option>
      <option value="mr">मराठी</option>
    </select>
  );
}
