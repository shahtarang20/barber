"use client";

import { ExternalLink, Copy } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { copyText } from "@/lib/shareLink";
import type { InstallHelp as Help } from "@/lib/useInstall";
import { InstallSteps } from "@/components/InstallSteps";

/**
 * "How to install" for a customer who cannot install with one tap, matched to their browser:
 * numbered steps for browsers that can install through their menu, and for browsers that cannot at all
 * (UC, Opera Mini, Xiaomi...) or pages opened inside WhatsApp: an "Open in Chrome" button and a "Copy link" button.
 */
export function InstallHelp({ help, className = "" }: { help: Help; className?: string }) {
  const { t } = useTranslation();
  const text = t(help.key);

  // Android lets a link jump straight into Chrome on this same page. If a browser blocks that, "Copy link" is the safety net.
  const here = typeof window !== "undefined" ? window.location : null;
  const chromeLink = here
    ? `intent://${here.host}${here.pathname}${here.search}#Intent;scheme=${here.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(here.href)};end`
    : "#";

  const copy = async () => {
    await copyText(window.location.href);
    toast.add({ title: t("linkCopy"), description: t("installLinkCopiedHint"), type: "success" });
  };

  return (
    <div className={className}>
      {help.key === "installOtherBrowser" ? <p role="status" className="text-sm leading-snug font-medium">{text}</p> : <InstallSteps text={text} />}
      {help.chromeButtons && (
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={chromeLink} className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg bg-zinc-900 text-white text-sm font-semibold flex-1 min-w-[9rem]">
            <ExternalLink className="w-4 h-4" /> {t("installOpenChrome")}
          </a>
          <button type="button" onClick={copy} className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg border border-zinc-300 bg-white text-zinc-900 text-sm font-semibold flex-1 min-w-[9rem]">
            <Copy className="w-4 h-4" /> {t("linkCopy")}
          </button>
          <p className="basis-full text-xs opacity-75">{t("installButtonHint")}</p>
        </div>
      )}
    </div>
  );
}
