"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

/** "Some existing bookings are outside your new hours" notice. Its own file so the dialog library loads only when it is needed. */
export default function SettingsWarningDialog({ open, onOpenChange, count }: { open: boolean; onOpenChange: (open: boolean) => void; count: number }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="w-5 h-5" />
            {t('settingsWarningTitle')}
          </DialogTitle>
          <DialogDescription className="text-zinc-600 dark:text-zinc-400 pt-2 text-base leading-relaxed">
            {t('settingsWarningDesc').replace('{count}', count.toString())}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 flex gap-3 sm:justify-end">
          <Button variant="default" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {t('done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
