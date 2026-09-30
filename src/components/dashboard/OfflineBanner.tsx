"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

/** A red strip at the top while the phone has no internet, so a failed tap is never a mystery. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-medium text-white">
      <WifiOff className="w-4 h-4 shrink-0" /> {t("offlineBanner")}
    </div>
  );
}
