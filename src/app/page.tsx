import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signedInHome } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/LanguageSelector";
import { loadDict, lookup, type Language, type TranslationKey } from "@/lib/i18n-load";

// A server page: the home page is words and links only, so it needs no script of its own on the phone
// (only the language picker is interactive).
export default async function Home() {
  const home = await signedInHome();
  if (home) redirect(home);
  const cookieLang = (await cookies()).get("lang")?.value;
  const language: Language = cookieLang === "hi" || cookieLang === "gu" || cookieLang === "mr" ? cookieLang : "en";
  await loadDict(language);
  const t = (key: TranslationKey) => lookup(language, key);
  const steps = [
    { title: t("landingStep1T"), text: t("landingStep1D") },
    { title: t("landingStep2T"), text: t("landingStep2D") },
    { title: t("landingStep3T"), text: t("landingStep3D") },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-[family-name:var(--font-geist-sans)]">
      {/* Header */}
      <header className="px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm fixed top-0 w-full z-10">
        <div className="font-bold text-base min-[360px]:text-lg sm:text-xl tracking-tight whitespace-nowrap shrink-0">BarberSaaS</div>
        <nav className="flex items-center gap-1 min-[360px]:gap-1.5 sm:gap-4 shrink-0">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="font-medium text-xs min-[360px]:text-sm sm:text-base px-1.5 min-[360px]:px-2 sm:px-4 whitespace-nowrap">{t("landingLogin")}</Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="font-medium text-xs min-[360px]:text-sm sm:text-base px-2.5 min-[360px]:px-3 sm:px-4 whitespace-nowrap">{t("landingStart")}</Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="flex justify-center mb-6">
          <LanguageSelector refresh />
        </div>
        <h1 className="text-balance text-3xl min-[400px]:text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4 sm:mb-6 leading-[1.1] sm:leading-tight">
          {t("landingHeroA")} <span className="text-green-500 block sm:inline mt-1 sm:mt-0">{t("landingHeroB")}</span>
        </h1>
        <p className="text-base sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-1 sm:px-2">
          {t("landingSub")}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4">
          <Link href="/register" className="w-full sm:w-auto">
            <Button size="lg" className="h-12 sm:h-14 w-full px-8 text-base sm:text-lg rounded-full">{t("landingStartFree")}</Button>
          </Link>
          <a href="#how-it-works" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="h-12 sm:h-14 w-full px-8 text-base sm:text-lg rounded-full bg-white dark:bg-zinc-900">
              {t("landingHow")}
            </Button>
          </a>
        </div>

        {/* How it works */}
        <section id="how-it-works" className="mt-20 scroll-mt-24">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8">{t("landingHowTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-3 text-left">
            {steps.map((s) => (
              <div key={s.title} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-10 text-center text-zinc-500 px-4">
        <p>{t("landingFooter")}</p>
      </footer>
    </div>
  );
}
