import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";
import { Toaster } from "@/components/ui/toast";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/components/LanguageProvider";
import type { Language } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "BarberSaaS",
  description: "Book your barber appointments effortlessly.",
  manifest: "/manifest.json",
  // The app is designed in light colours only; stops phone browsers' "force dark" from inverting it.
  other: { "color-scheme": "light only" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BarberSaaS",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieLang = (await cookies()).get("lang")?.value;
  const language: Language = cookieLang === "hi" || cookieLang === "gu" || cookieLang === "mr" || cookieLang === "en" ? cookieLang : "en";
  return (
    <html
      lang={language}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
