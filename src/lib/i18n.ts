import { createContext, useContext, useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { lookup, registerDict, loadDict, type Language, type TranslationKey } from './i18n-load';

export { registerDict, loadDict };
export type { Language, TranslationKey };



/**
 * The chosen language, handed down from the server (a cookie) so the very first screen a slow phone
 * shows is already in that language, instead of English until the page's JavaScript has loaded.
 */
export const LangContext = createContext<{ language: Language; setLanguage: (lang: Language) => void } | null>(null);

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'barber-i18n-storage',
    }
  )
);

export function useTranslation() {
  const ctx = useContext(LangContext);
  const storeLanguage = useI18nStore((state) => state.language);
  const language = ctx?.language ?? storeLanguage;

  // Same function between renders while the language is unchanged, so memoized children are not re-rendered for nothing.
  const t = useMemo(() => (key: TranslationKey) => lookup(language, key), [language]);

  return { t, language, setLanguage: ctx?.setLanguage ?? useI18nStore.getState().setLanguage };
}

/** Looks up a label outside a React component (e.g. in the toast helper), in the language currently selected. */
export function translate(key: TranslationKey): string {
  return lookup(useI18nStore.getState().language, key);
}
