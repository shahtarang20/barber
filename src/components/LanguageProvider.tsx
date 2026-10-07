import { loadDict, type Language } from "@/lib/i18n-load";
import { LanguageClient } from "./LanguageClient";

/**
 * Server side: fetches the labels of the chosen language (English is already in the app) and hands them to the
 * client provider, so only that one language is sent to the phone instead of all four.
 */
export async function LanguageProvider({ initial, hadCookie, children }: { initial: Language; hadCookie: boolean; children: React.ReactNode }) {
  const dict = initial === "en" ? null : await loadDict(initial);
  return <LanguageClient initial={initial} hadCookie={hadCookie} initialDict={dict}>{children}</LanguageClient>;
}
