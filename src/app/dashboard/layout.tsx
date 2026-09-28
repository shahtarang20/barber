import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { InstallPrompt } from "@/components/InstallPrompt";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get("auth_token")?.value;
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    redirect("/login");
  }

  if (payload.role === "ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <MobileNav />
      <main className="flex-1 overflow-auto pb-20 md:pb-0 relative">
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
          {children}
        </div>
        <InstallPrompt />
      </main>
    </div>
  );
}
