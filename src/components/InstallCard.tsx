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
    <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-left">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold">{appName.charAt(0).toUpperCase()}</div>
        <div className="min-w-0">
          <p className="font-semibold text-indigo-950">{t("installTitle").replace("{name}", appName)}</p>
          <p className="text-sm text-indigo-900/80 mt-0.5">{t("installBenefit")}</p>
        </div>
      </div>
      {!manualOnly && (
        <Button onClick={onClick} disabled={busy || signal === "waiting"} className="w-full h-12 mt-3 bg-indigo-600 hover:bg-indigo-700 text-white">
          {signal === "waiting"
            ? <span className="inline-block w-4 h-4 mr-2 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
            : <Download className="w-4 h-4 mr-2" />}
          {signal === "waiting" ? t("installPreparing") : t("installButton")}
        </Button>
      )}
      {(manualOnly || steps) && <InstallHelp help={help} className="mt-3 text-indigo-950 bg-white rounded-lg p-3 border border-indigo-100" />}
    </div>
  );
}
