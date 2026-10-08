"use client";

import { useState } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation, type TranslationKey } from "@/lib/i18n";

export default function RegisterPage() {
  const hydrated = useHydrated();
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successCode, setSuccessCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = (formData.get("phone") as string).trim();
    const password = formData.get("password") as string;

    if (phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "").length !== 10) {
      setError(t('authPhoneInvalid'));
      setLoading(false);
      return;
    }
    
    // The booking link is made by the server (clean and always unique) — he can change it later.

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // The server's messages are English; the common ones are shown in the chosen language.
        const known: Record<string, TranslationKey> = {
          "Name must be at least 2 characters": "authErrName", "Name must be at most 80 characters": "authErrName",
          "Invalid email address": "authErrEmail", "Email already registered": "authErrEmailTaken",
          "Password must be at least 6 characters": "authErrPassword",
        };
        const key = res.status === 429 ? "err_RATE_LIMITED" : known[data.error?.message as string];
        setError(key ? t(key) : data.error?.message || t('genericError'));
        setLoading(false);
        return;
      }

      setSuccessCode(data.data.barberCode);
      setLoading(false);
      
    } catch (err) {
      setError(t('genericError'));
      setLoading(false);
    }
  };

  if (successCode) {
    return (
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 text-center">
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">{t('authRegSuccess')}</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-6">
          {t('authCodeGenerated')}
        </p>
        
        <div className="bg-zinc-100 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-8">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">{t('authYourCode')}</p>
          <p className="text-3xl font-mono font-bold text-blue-600 dark:text-blue-400">{successCode}</p>
        </div>
        <p className="text-sm font-medium text-orange-600 dark:text-orange-400 -mt-4 mb-6">{t('authWriteCode')}</p>

        <Button onClick={() => router.push("/login")} className="w-full h-11">
          {t('authContinueLogin')}
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{t('authCreateTitle')}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          {t('authCreateDesc')}
        </p>
      </div>

      <form method="post" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/30">
            {error}
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="name">{t('authFullName')}</Label>
          <Input 
            id="name" 
            name="name" 
            placeholder="Rahul Sharma" 
            required 
            autoComplete="name"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">{t('authPhone')}</Label>
          <Input 
            id="phone" 
            name="phone" 
            type="tel" 
            inputMode="numeric" 
            placeholder="98XXXXXXXX" 
            required 
            autoComplete="tel"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('authEmailOptional')}</Label>
          <Input 
            id="email" 
            name="email" 
            type="email" 
            placeholder="m@example.com" 
            autoComplete="email"
            className="h-11"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password">{t('authPassword')}</Label>
          <div className="relative">
            <Input 
              id="password" 
              name="password" 
              type={showPassword ? "text" : "password"} 
              placeholder={t('authPasswordHint')} 
              required 
              autoComplete="new-password"
              className="h-11 pr-12"
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 focus:outline-none"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full h-11 mt-6" disabled={loading || !hydrated}>
          {loading ? t('authCreating') : t('authCreateBtn')}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-zinc-500">
        {t('authHaveAccount')}{" "}
        <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-50 hover:underline inline-flex items-center min-h-11 px-1">
          {t('authSignIn')}
        </Link>
      </div>
    </div>
  );
}
