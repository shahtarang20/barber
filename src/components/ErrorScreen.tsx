"use client";

import { useSyncExternalStore } from "react";

type L = "en" | "hi" | "gu" | "mr";
const TEXT: Record<L, { notFoundT: string; notFoundD: string; errT: string; errD: string; retry: string; home: string }> = {
  en: { notFoundT: "Page not found", notFoundD: "This page does not exist or the link is wrong.", errT: "Something went wrong", errD: "Please try again. If it keeps happening, try again in a few minutes.", retry: "Try again", home: "Go to home" },
  hi: { notFoundT: "पेज नहीं मिला", notFoundD: "यह पेज मौजूद नहीं है या लिंक गलत है।", errT: "कुछ गड़बड़ हो गई", errD: "कृपया दोबारा कोशिश करें। अगर बार-बार हो, तो कुछ मिनट बाद कोशिश करें।", retry: "दोबारा कोशिश करें", home: "होम पर जाएँ" },
  gu: { notFoundT: "પેજ મળ્યું નહીં", notFoundD: "આ પેજ અસ્તિત્વમાં નથી અથવા લિંક ખોટી છે.", errT: "કંઈક ખોટું થયું", errD: "કૃપા કરીને ફરી પ્રયાસ કરો. વારંવાર થાય તો થોડી મિનિટ પછી પ્રયાસ કરો.", retry: "ફરી પ્રયાસ કરો", home: "હોમ પર જાઓ" },
  mr: { notFoundT: "पेज सापडले नाही", notFoundD: "हे पेज अस्तित्वात नाही किंवा लिंक चुकीची आहे.", errT: "काहीतरी चुकले", errD: "कृपया पुन्हा प्रयत्न करा. वारंवार होत असल्यास काही मिनिटांनी प्रयत्न करा.", retry: "पुन्हा प्रयत्न करा", home: "होमवर जा" },
};

function readLang(): L {
  const v = typeof document !== "undefined" ? document.documentElement.lang : "en";
  return v === "hi" || v === "gu" || v === "mr" ? v : "en";
}
const subscribe = () => () => {};

/** Friendly full-page message that works even outside the app's providers (used by not-found, error and global-error). */
export function ErrorScreen({ kind, onRetry }: { kind: "notFound" | "error"; onRetry?: () => void }) {
  const lang = useSyncExternalStore(subscribe, readLang, () => "en" as L);
  const t = TEXT[lang];
  const btn = "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium";
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#fafafa", color: "#18181b", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "#71717a", marginBottom: 8 }}>BarberSaaS</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{kind === "notFound" ? t.notFoundT : t.errT}</h1>
        <p style={{ fontSize: 15, color: "#52525b", marginBottom: 20 }}>{kind === "notFound" ? t.notFoundD : t.errD}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {onRetry && <button type="button" onClick={onRetry} className={btn} style={{ background: "#18181b", color: "#fff", border: 0, cursor: "pointer" }}>{t.retry}</button>}
          {/* A plain link (not next/link) so it also works when the app itself is broken. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className={btn} style={{ border: "1px solid #d4d4d8", color: "#18181b", textDecoration: "none" }}>{t.home}</a>
        </div>
      </div>
    </main>
  );
}
