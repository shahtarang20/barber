import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-[family-name:var(--font-geist-sans)]">
      {/* Header */}
      <header className="px-6 lg:px-8 h-16 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm fixed top-0 w-full z-10">
        <div className="font-bold text-xl tracking-tight">BarberSaaS</div>
        <nav className="flex gap-4">
          <Link href="/login">
            <Button variant="ghost" className="font-medium">Log in</Button>
          </Link>
          <Link href="/register">
            <Button className="font-medium">Get Started Free</Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="pt-32 pb-16 px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
          Stop managing barber appointments on <span className="text-green-500">WhatsApp.</span>
        </h1>
        <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Create your slots. Share your booking link. Let customers book instantly. 
          The simplest booking system designed exclusively for independent barbers.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/register">
            <Button size="lg" className="h-14 px-8 text-lg rounded-full">Get Started Free</Button>
          </Link>
          <Link href="#how-it-works">
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full bg-white dark:bg-zinc-900">
              See How It Works
            </Button>
          </Link>
        </div>

        {/* Feature Preview */}
        <div className="mt-20 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden p-2">
          <div className="bg-zinc-100 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 h-[400px] flex items-center justify-center">
            {/* Abstract UI representation */}
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="border-b border-zinc-100 dark:border-zinc-800 p-4">
                <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div>
              </div>
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-md border border-zinc-100 dark:border-zinc-800">
                    <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                    <div className="h-6 w-20 bg-green-100 dark:bg-green-900/30 rounded-full"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Placeholder */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-12 text-center text-zinc-500 mt-20">
        <p>© 2026 BarberSaaS. All rights reserved.</p>
      </footer>
    </div>
  );
}
