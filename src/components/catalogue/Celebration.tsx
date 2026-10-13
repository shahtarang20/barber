"use client";

import { useEffect, useRef } from "react";

/**
 * A one-shot celebration burst — confetti ribbons and a few flower petals raining down — drawn on a full-screen canvas
 * that sits above the page and ignores taps. Used when a customer wins a wheel prize or opens their birthday greeting,
 * so the happy moment feels earned. Honours prefers-reduced-motion (then it does nothing). Cleans itself up.
 */
export function Celebration({ run, durationMs = 2600 }: { run: boolean; durationMs?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!run) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr; };
    resize();
    const W = () => canvas.width, H = () => canvas.height;

    const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#6366f1", "#ec4899", "#eab308"];
    const FLOWERS = ["🌸", "🌼", "🏵️", "✨"];
    type Bit = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; color: string; flower: string | null; };
    const count = Math.min(170, Math.round(window.innerWidth / 4));
    const bits: Bit[] = Array.from({ length: count }).map(() => {
      const isFlower = Math.random() < 0.22;
      return {
        x: Math.random() * W(),
        y: -Math.random() * H() * 0.5,
        vx: (Math.random() - 0.5) * 1.6 * dpr,
        vy: (2 + Math.random() * 3.2) * dpr,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        size: (isFlower ? 16 : 6 + Math.random() * 6) * dpr,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        flower: isFlower ? FLOWERS[(Math.random() * FLOWERS.length) | 0] : null,
      };
    });

    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, W(), H());
      for (const b of bits) {
        b.x += b.vx; b.y += b.vy; b.vy += 0.015 * dpr; b.rot += b.vr;
        if (b.y > H() + 20) { b.y = -20; b.x = Math.random() * W(); }
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.globalAlpha = Math.max(0, 1 - t / durationMs);
        if (b.flower) {
          ctx.font = `${b.size}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(b.flower, 0, 0);
        } else {
          ctx.fillStyle = b.color;
          ctx.fillRect(-b.size / 2, -b.size / 2, b.size, b.size * 0.5);
        }
        ctx.restore();
      }
      if (t < durationMs) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W(), H());
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [run, durationMs]);

  if (!run) return null;
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60]" style={{ width: "100%", height: "100%" }} />;
}
