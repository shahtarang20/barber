"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

/**
 * Full-screen viewer for one service's pictures and videos (swipe sideways). Opened from the card's play button or by tapping a card
 * that has more than one picture. Only one video plays at a time; Escape or the close button leaves. Nothing loads until it opens.
 */
export function MediaViewer({ name, images, videos, startAtVideo, onClose }: { name: string; images: string[]; videos: string[]; startAtVideo: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const slides = [...(startAtVideo ? videos.map((u) => ({ u, v: true })) : []), ...images.map((u) => ({ u, v: false })), ...(startAtVideo ? [] : videos.map((u) => ({ u, v: true })))];

  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  // Starting on a video: the tap that opened the viewer counts as permission to play it.
  useEffect(() => {
    if (startAtVideo) rowRef.current?.querySelector("video")?.play().catch(() => {});
  }, [startAtVideo]);

  return (
    <div role="dialog" aria-modal="true" aria-label={name} className="tp-viewer" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button ref={closeRef} type="button" className="tp-viewer__close" aria-label={t("catViewerClose")} onClick={onClose}><X size={22} aria-hidden="true" /></button>
      <div ref={rowRef} className="tp-viewer__row" onPlayCapture={(e) => { rowRef.current?.querySelectorAll("video").forEach((v) => { if (v !== e.target) v.pause(); }); }}>
        {slides.map((s, i) => (
          <div key={`${i}-${s.u}`} className="tp-viewer__slide">
            {s.v
              ? <video src={s.u} controls playsInline preload="metadata" aria-label={name} />
              // eslint-disable-next-line @next/next/no-img-element -- owner-supplied address
              : <img src={s.u} alt={name} decoding="async" />}
          </div>
        ))}
      </div>
      <p className="tp-viewer__name">{name}</p>
    </div>
  );
}
