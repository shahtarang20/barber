"use client";

import { format } from "date-fns";
import { useTranslation } from "@/lib/i18n";

// date-fns has no Marathi (and its Hindi/Gujarati short names are awkward), so the few patterns the app
// uses are written out here for all three languages. Digits stay as normal numbers, like the rest of the app.
const NAMES = {
  hi: {
    monthsLong: ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्तूबर", "नवंबर", "दिसंबर"],
    monthsShort: ["जन", "फ़र", "मार्च", "अप्रै", "मई", "जून", "जुल", "अग", "सित", "अक्तू", "नव", "दिस"],
    daysLong: ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"],
    daysShort: ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"],
  },
  gu: {
    monthsLong: ["જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઑગસ્ટ", "સપ્ટેમ્બર", "ઑક્ટોબર", "નવેમ્બર", "ડિસેમ્બર"],
    monthsShort: ["જાન્યુ", "ફેબ્રુ", "માર્ચ", "એપ્રિ", "મે", "જૂન", "જુલા", "ઑગ", "સપ્ટે", "ઑક્ટો", "નવે", "ડિસે"],
    daysLong: ["રવિવાર", "સોમવાર", "મંગળવાર", "બુધવાર", "ગુરુવાર", "શુક્રવાર", "શનિવાર"],
    daysShort: ["રવિ", "સોમ", "મંગળ", "બુધ", "ગુરુ", "શુક્ર", "શનિ"],
  },
  mr: {
    monthsLong: ["जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून", "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर"],
    monthsShort: ["जाने", "फेब्रु", "मार्च", "एप्रि", "मे", "जून", "जुलै", "ऑग", "सप्टें", "ऑक्टो", "नोव्हें", "डिसें"],
    daysLong: ["रविवार", "सोमवार", "मंगळवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"],
    daysShort: ["रवि", "सोम", "मंगळ", "बुध", "गुरु", "शुक्र", "शनि"],
  },
} as const;

/** Like date-fns `format`, but month and day names come out in the chosen language. */
export function formatInLanguage(date: Date, pattern: string, language: "en" | "hi" | "gu" | "mr"): string {
  if (language === "en") return format(date, pattern);
  const n = NAMES[language];
  return pattern.replace(/EEEE|EEE|MMMM|MMM|yyyy|dd|d/g, (tok) => {
    switch (tok) {
      case "EEEE": return n.daysLong[date.getDay()];
      case "EEE": return n.daysShort[date.getDay()];
      case "MMMM": return n.monthsLong[date.getMonth()];
      case "MMM": return n.monthsShort[date.getMonth()];
      case "yyyy": return String(date.getFullYear());
      case "dd": return String(date.getDate()).padStart(2, "0");
      default: return String(date.getDate());
    }
  });
}

export function useDateFormat() {
  const { language } = useTranslation();
  return (date: Date, pattern: string) => formatInLanguage(date, pattern, language);
}
