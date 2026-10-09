"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { useInstall, setInstallCardShown } from "@/lib/useInstall";
import { InstallHelp } from "@/components/InstallHelp";

/**
 * Shown on the "booking confirmed" screen — the moment a customer is happiest with the app.
 *  - the browser is ready: a big Install button, one tap installs,
 *  - the browser is still getting ready (slow phones): the same button, greyed with "Getting ready…", so it is never a button that cannot work,
 *  - one-tap install is not possible here (iPhone, a page opened inside WhatsApp, an old phone): the steps are shown straight away.
 */
export function InstallCard({ appName }: { appName: string }) {
  const { t } = useTranslation();
  const { standalone, signal, isMobile, help, install } = useInstall();
  const [steps, setSteps] = useState(false);
  const [busy, setBusy] = useState(false);
  const manualOnly = signal === "none";

  useEffect(() => {
    if (standalone) return;
    setInstallCardShown(true); // the small banner stays out of the way while this card is on screen
    return () => setInstallCardShown(false);
  }, [standalone]);

  if (standalone || (signal === "none" && !isMobile)) return null; // nothing useful to show on a computer that cannot install

  const onClick = async () => {
    setBusy(true);
    const result = await install();
    setBusy(false);
    if (result === "accepted") toast.add({ title: t("installTitle").replace("{name}", appName), description: t("installDone"), type: "success" });
    else if (result === "unavailable") setSteps(true); // the browser refused at the last moment: show the steps instead of doing nothing
  };

  return (
    <div className="mb-6 rounded-2xl border p-4 text-left" style={{ background: "var(--t-surface, #eef2ff)", borderColor: "var(--t-line2, #c7d2fe)", color: "var(--t-ink, #1e1b4b)" }}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-xl font-bold" style={{ background: "var(--t-btn-bg, #4f46e5)", color: "var(--t-btn-ink, #fff)" }}>{appName.charAt(0).toUpperCase()}</div>
        <div className="min-w-0">
          <p className="font-semibold" style={{ color: "var(--t-ink, #1e1b4b)" }}>{t("installTitle").replace("{name}", appName)}</p>
          <p className="text-sm mt-0.5" style={{ color: "var(--t-muted, #3730a3)" }}>{t("installBenefit")}</p>
        </div>
      </div>
      {!manualOnly && (
        <Button onClick={onClick} disabled={busy || signal === "waiting"} className="w-full h-12 mt-3 border-0 hover:opacity-90" style={{ background: "var(--t-btn-bg, #4f46e5)", color: "var(--t-btn-ink, #fff)" }}>
          {signal === "waiting"
            ? <span className="inline-block w-4 h-4 mr-2 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
            : <Download className="w-4 h-4 mr-2" />}
          {signal === "waiting" ? t("installPreparing") : t("installButton")}
        </Button>
      )}
      {(manualOnly || steps) && <InstallHelp help={help} className="mt-3 rounded-lg p-3 border" />}
    </div>
  );
}
