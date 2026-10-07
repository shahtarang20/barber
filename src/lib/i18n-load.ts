import { en } from './i18n-dict/en';

export type Language = 'en' | 'hi' | 'gu' | 'mr';
export type Dict = Record<string, string>;
export type TranslationKey = keyof typeof en;

/**
 * Labels per language. Only English is bundled with the app (it is also the fallback for any label a language is
 * missing); Hindi / Gujarati / Marathi are separate files that are sent only to people who use them
 * (the server passes the active one to LanguageProvider; switching language loads the new one on demand).
 * To add a label: put it in i18n-dict/en.ts, then in hi.ts / gu.ts / mr.ts.
 * No React in this file, so server components can use it too.
 */
export const dicts: Partial<Record<Language, Dict>> = { en };

export { en };

export function registerDict(language: Language, dict: Dict) {
  dicts[language] = dict;
}

/** Loads one language's labels (a separate small file; English is always already available). */
export async function loadDict(language: Language): Promise<Dict> {
  if (dicts[language]) return dicts[language]!;
  const mod =
    language === 'hi' ? await import('./i18n-dict/hi')
    : language === 'gu' ? await import('./i18n-dict/gu')
    : language === 'mr' ? await import('./i18n-dict/mr')
    : { default: en as Dict };
  dicts[language] = mod.default;
  return mod.default;
}

export function lookup(language: Language, key: TranslationKey): string {
  return dicts[language]?.[key] || en[key];
}
