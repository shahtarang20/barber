"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { useInstall, setInstallCardShown, stepsKey } from "@/lib/useInstall";

/**
 * Shown on the "booking confirmed" screen — the moment a customer is happiest with the app.
 * One tap installs it (Android / desktop). Where a button cannot install (iPhone, or a page opened inside WhatsApp and
 * similar) the steps are shown straight away instead of hiding them behind a tap.
 */
export function InstallCard({ appName }: { appName: string }) {
  const { t } = useTranslation();
  const { standalone, isIOS, isInApp, install } = useInstall();
  const [steps, setSteps] = useState(false);
  const [busy, setBusy] = useState(false);
  const manualOnly = isIOS || isInApp; // no install button can work here

  useEffect(() => {
    if (standalone) return;
    setInstallCardShown(true); // the small banner stays out of the way while this card is on screen
    return () => setInstallCardShown(false);
  }, [standalone]);

  if (standalone) return null;

  const onClick = async () => {
    setBusy(true);
    const result = await install(); // may wait a moment for the browser to say it is ready
    setBusy(false);
    if (result === "accepted") toast.add({ title: t("installTitle").replace("{name}", appName), description: t("installDone"), type: "success" });
    else if (result === "unavailable") setSteps(true);
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
        <Button onClick={onClick} disabled={busy} className="w-full h-12 mt-3 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Download className="w-4 h-4 mr-2" /> {t("installButton")}
        </Button>
      )}
      {(manualOnly || steps) && <p role="status" className="mt-3 text-sm text-indigo-950 bg-white rounded-lg p-3 border border-indigo-100">{t(stepsKey(isIOS, isInApp))}</p>}
    </div>
  );
}
