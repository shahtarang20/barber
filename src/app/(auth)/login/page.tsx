"use client";

import { useState } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function LoginPage() {
  const hydrated = useHydrated();
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const barberCode = formData.get("barberCode");
    const password = formData.get("password");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barberCode, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || t('genericError'));
        setLoading(false);
        return;
      }

      if (data.data.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch (err) {
      setError(t('genericError'));
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{t('authWelcomeBack')}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          {t('authLoginDesc')}
        </p>
      </div>

      <form method="post" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/30">
            {error}
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="barberCode">{t('authCodeOrEmail')}</Label>
          <Input 
            id="barberCode" 
            name="barberCode" 
            placeholder={t('authCodePlaceholder')} 
            required 
            autoComplete="username"
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
              placeholder="••••••••" 
              required 
              autoComplete="current-password"
              className="h-11 pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 focus:outline-none"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t('authForgot')}
          </p>
        </div>

        <Button type="submit" className="w-full h-11 mt-6" disabled={loading || !hydrated}>
          {loading ? t('authSigningIn') : t('authSignIn')}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-zinc-500">
        {t('authNoAccount')}{" "}
        <Link href="/register" className="font-medium text-zinc-900 dark:text-zinc-50 hover:underline">
          {t('authRegisterHere')}
        </Link>
      </div>
    </div>
  );
}
