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
          Create your slots. Share your unique booking link. Let customers book instantly. 
          The simplest white-labeled booking system designed exclusively for independent barbers.
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
          <div className="bg-zinc-100 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 h-[400px] flex flex-col items-center justify-center p-8 text-center">
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200 mb-4">Your Own Unique PWA App</h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-md">
              Every barber gets their own unique installable web app link. Send it to your clients, and they can install it directly to their home screen to book slots instantly.
            </p>
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
