import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";
import { Toaster } from "@/components/ui/toast";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/components/LanguageProvider";
import type { Language } from "@/lib/i18n";
import { siteUrl } from "@/lib/siteUrl";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "BarberSaaS", template: "%s | BarberSaaS" },
  description: "Book your barber appointments effortlessly.",
  openGraph: { type: "website", siteName: "BarberSaaS", title: "BarberSaaS", description: "Book your barber appointments effortlessly." },
  twitter: { card: "summary", title: "BarberSaaS", description: "Book your barber appointments effortlessly." },
  manifest: "/manifest.json",
  icons: { apple: "/apple-touch-icon.png" },
  // The app is designed in light colours only; stops phone browsers' "force dark" from inverting it.
  other: { "color-scheme": "light only" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BarberSaaS",
  },
};

/**
 * Runs the moment the browser reads the page head, before any database lookup finishes:
 *  1. keeps the browser's "this can be installed" signal if it arrives before the app has started,
 *  2. starts the background worker at once (the install button only appears once it is ready),
 *  3. puts the RIGHT manifest link first in the head for barber (/b/...) and shop (/s/...) pages.
 * Why 3: Next sends a page's <link rel="manifest"> late when the page first looks the barber or shop up in the database
 * (a cold server, or a slower database), placing it after </head>, where the browser ignores it, and then the page cannot
 * be installed at all on that visit. The first manifest link in the page wins, so this one decides.
 */
const HEAD_SCRIPT = String.raw`(function(){
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__installEvent=e;});
  if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){});}
  var m=location.pathname.match(/^\/(b|s)\/([^\/?#]+)/);
  if(m){var l=document.createElement('link');l.rel='manifest';l.href='/api/public/'+(m[1]==='b'?'barbers':'shops')+'/'+m[2]+'/manifest';document.head.insertBefore(l,document.head.firstChild);}
})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieLang = (await cookies()).get("lang")?.value;
  const language: Language = cookieLang === "hi" || cookieLang === "gu" || cookieLang === "mr" || cookieLang === "en" ? cookieLang : "en";
  return (
    <html
      lang={language}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <LanguageProvider initial={language} hadCookie={!!cookieLang}>
          <PWARegister />
          {children}
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
