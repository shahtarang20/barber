"use client";

import { memo, useMemo } from "react";
import { qrSvg } from "@/lib/qr";

/** A QR code drawn on the phone (no outside service). */
export const QrCode = memo(function QrCode({ value, className }: { value: string; className?: string }) {
  const { path, box } = useMemo(() => qrSvg(value, 0), [value]);
  return (
    <svg viewBox={`0 0 ${box} ${box}`} className={className} role="img" aria-label="QR Code" shapeRendering="crispEdges">
      <path d={path} fill="#000" />
    </svg>
  );
});

/** Saves the QR code as a PNG picture (900 px, with a white border so it scans on any background). */
export async function downloadQrPng(value: string, filename: string) {
  const { path, box } = qrSvg(value, 4);
  const scale = Math.ceil(900 / box);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = box * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.fill(new Path2D(path.replace(/M(\d+) (\d+)h(\d+)v1h-\d+z/g, (_m, x, y, w) => `M${x * scale} ${y * scale}h${w * scale}v${scale}h-${w * scale}z`)));
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("could not make picture");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
