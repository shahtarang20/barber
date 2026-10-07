import { Playfair_Display, Cormorant_Garamond, Marcellus, DM_Serif_Display, Bodoni_Moda } from "next/font/google";

// Display faces for headings only (body stays on the app's Geist). Not preloaded: the browser downloads just the one a page
// actually draws (the others stay unused), and `swap` shows text at once in a size-matched fallback, so nothing jumps.
// Latin only: Hindi / Gujarati / Marathi headings use the phone's own Devanagari / Gujarati font through the fallback stack,
// which avoids shipping large script fonts. (Dynamic per-style imports were tried: they pull in every font's stylesheet.)
// next/font needs literal options, so they are written out per font.
const f1 = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-tpl-1", weight: ["500", "700"] });
const f2 = Cormorant_Garamond({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-tpl-2", weight: ["500", "600"], style: ["normal", "italic"] });
const f3 = Marcellus({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-tpl-3", weight: "400" });
const f4 = DM_Serif_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-tpl-4", weight: "400", style: ["normal", "italic"] });
const f5 = Bodoni_Moda({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-tpl-5", weight: ["400", "500", "600"], style: ["normal", "italic"] });

export const TEMPLATE_FONT_CLASS: Record<number, string> = { 1: f1.variable, 2: f2.variable, 3: f3.variable, 4: f4.variable, 5: f5.variable };
