"use client";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** A proper confirmation step for anything that deletes content. */
export function ConfirmDialog({ open, title, description, confirmLabel, busy, onConfirm, onCancel, children }: {
  open: boolean; title: string; description: string; confirmLabel: string; busy?: boolean; onConfirm: () => void; onCancel: () => void; children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>{t("ownCancel")}</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>{busy ? t("ownWorking") : confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
