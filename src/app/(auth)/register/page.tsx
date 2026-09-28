"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successCode, setSuccessCode] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    
    // Auto generate a simple slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.floor(Math.random() * 1000);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, slug }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || "Registration failed");
        setLoading(false);
        return;
      }

      setSuccessCode(data.data.barberCode);
      setLoading(false);
      
    } catch (err) {
      setError("An unexpected error occurred.");
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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">Registration Successful</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-6">
          Your unique Barber Code has been generated. You will use this code to log in.
        </p>
        
        <div className="bg-zinc-100 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-8">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Your Barber Code</p>
          <p className="text-3xl font-mono font-bold text-blue-600 dark:text-blue-400">{successCode}</p>
        </div>

        <Button onClick={() => router.push("/login")} className="w-full h-11">
          Continue to Login
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Create an account</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          Enter your details below to create your barber profile
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/30">
            {error}
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
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
          <Label htmlFor="email">Email</Label>
          <Input 
            id="email" 
            name="email" 
            type="email" 
            placeholder="m@example.com" 
            required 
            autoComplete="email"
            className="h-11"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input 
            id="password" 
            name="password" 
            type="password" 
            placeholder="Create a strong password" 
            required 
            autoComplete="new-password"
            className="h-11"
            minLength={6}
          />
        </div>

        <Button type="submit" className="w-full h-11 mt-6" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-50 hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
