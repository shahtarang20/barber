"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LangContext, loadDict, registerDict, useI18nStore, type Language } from "@/lib/i18n";

/**
 * Keeps the chosen language in a cookie (so the server can render the first page in it) as well as the
 * older local storage copy. People who chose a language before the cookie existed are moved over once.
 * Switching language first loads that language's labels (one small file), then switches, so the screen never
 * flashes English in between.
 */
export function LanguageClient({ initial, hadCookie, initialDict, children }: { initial: Language; hadCookie: boolean; initialDict: Record<string, string> | null; children: React.ReactNode }) {
  // Registered during render (before any child reads a label), on the server and in the browser alike.
  if (initialDict) registerDict(initial, initialDict);

  const [language, setLang] = useState<Language>(initial);
  const latest = useRef<Language>(initial);

  const change = useCallback((l: Language) => {
    latest.current = l;
    loadDict(l).then(
      (d) => { registerDict(l, d); if (latest.current === l) setLang(l); },
      () => { /* offline and not downloaded yet: stay on the current language */ },
    );
  }, []);

  useEffect(() => {
    if (hadCookie) return;
    try {
      const stored = JSON.parse(localStorage.getItem("barber-i18n-storage") || "null")?.state?.language;
      if (stored && ["en", "hi", "gu", "mr"].includes(stored) && stored !== initial) change(stored);
    } catch {}
  }, [hadCookie, initial, change]);

  useEffect(() => {
    useI18nStore.setState({ language });
    document.documentElement.lang = language;
    document.cookie = `lang=${language}; path=/; max-age=31536000; SameSite=Lax`;
  }, [language]);

  // Tells the page's CSS the app has finished loading (until then, buttons look dimmed and a thin bar moves).
  useEffect(() => {
    document.documentElement.classList.add("hydrated");
  }, []);

  const value = useMemo(() => ({ language, setLanguage: change }), [language, change]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
