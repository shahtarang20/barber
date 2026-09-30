"use client";

import { useTranslation } from "@/lib/i18n";

export function LanguageSelector() {
  const { language, setLanguage } = useTranslation();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as any)}
      className="h-11 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
    >
      <option value="en">English</option>
      <option value="hi">हिन्दी</option>
      <option value="gu">ગુજરાતી</option>
      <option value="mr">मराठी</option>
    </select>
  );
}
