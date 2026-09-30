"use client";

import { useCallback, useEffect, useState } from "react";
import { LangContext, useI18nStore, type Language } from "@/lib/i18n";

/**
 * Keeps the chosen language in a cookie (so the server can render the first page in it) as well as the
 * older local storage copy. People who chose a language before the cookie existed are moved over once.
 */
export function LanguageProvider({ initial, hadCookie, children }: { initial: Language; hadCookie: boolean; children: React.ReactNode }) {
  const [language, setLang] = useState<Language>(initial);

  useEffect(() => {
    if (hadCookie) return;
    try {
      const stored = JSON.parse(localStorage.getItem("barber-i18n-storage") || "null")?.state?.language;
      if (stored && ["en", "hi", "gu", "mr"].includes(stored) && stored !== initial) setLang(stored);
    } catch {}
  }, [hadCookie, initial]);

  useEffect(() => {
    useI18nStore.setState({ language });
    document.documentElement.lang = language;
    document.cookie = `lang=${language}; path=/; max-age=31536000; SameSite=Lax`;
  }, [language]);

  // Tells the page's CSS the app has finished loading (until then, buttons look dimmed and a thin bar moves).
  useEffect(() => {
    document.documentElement.classList.add("hydrated");
  }, []);

  const setLanguage = useCallback((l: Language) => setLang(l), []);
  return <LangContext.Provider value={{ language, setLanguage }}>{children}</LangContext.Provider>;
}
