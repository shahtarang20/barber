"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { CatalogueScope } from "@/lib/catalogueClient";
import { uploadPicture, uploadVideo } from "@/lib/mediaClient";

/** Chooses a file, uploads it (with progress for videos) and hands back its address. */
export function UploadButton({ scope, kind, label, onUploaded, disabled }: { scope: CatalogueScope; kind: "image" | "video"; label: string; onUploaded: (url: string) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<number | "wait" | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(kind === "video" ? 0 : "wait");
    try {
      const asset = kind === "image" ? await uploadPicture(scope, file) : await uploadVideo(scope, file, (p) => setBusy(p));
      onUploaded(asset.url);
    } catch (err) {
      toast.add({ title: "Upload failed", description: (err as Error).message, type: "error" });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-label={label} data-testid={`upload-${kind}`} accept={kind === "image" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/quicktime"} onChange={(e) => pick(e.target.files?.[0])} />
      <Button type="button" variant="outline" disabled={disabled || busy !== null} onClick={() => input.current?.click()}>
        <Upload /> {busy === null ? label : typeof busy === "number" ? `Uploading ${busy}%` : "Uploading…"}
      </Button>
    </>
  );
}
