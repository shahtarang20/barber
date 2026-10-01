"use client";

import useSWR from "swr";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** The barber's own code, always visible: it is what he gives the shop owner to be invited, and what he logs in with. */
export function MyBarberCode() {
  const { t } = useTranslation();
  const { data } = useSWR("/api/barber/profile", fetcher);
  const code: string | undefined = data?.success ? data.data.barberCode : undefined;
  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.add({ title: t("myCodeCopied"), description: code, type: "success" });
    } catch {}
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[12rem]">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("myCodeTitle")}</p>
        <p className="text-2xl font-bold font-mono tracking-wide text-zinc-900 dark:text-zinc-50">{code}</p>
        <p className="text-xs text-zinc-500 mt-1">{t("myCodeHint")}</p>
      </div>
      <Button variant="outline" onClick={copy} className="h-11">
        <Copy className="w-4 h-4 mr-2" /> {t("myCodeCopy")}
      </Button>
    </div>
  );
}
