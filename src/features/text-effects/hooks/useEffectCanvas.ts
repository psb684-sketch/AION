// src/features/text-effects/hooks/useEffectCanvas.ts
import { useEffect, useRef } from "react";
import { useEffectsStore } from "../store/effectsStore";
import { renderTextEffectToContext } from "../renderer";
import { getFontLoader } from "@/core/fonts/FontLoader";
import type { TextEffectDefinition } from "../types/types";

export function useEffectCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  text: string
) {
  const { selectedEffect } = useEffectsStore();
  const rafId = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedEffect) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    const startTime = performance.now();
    const fontSize = getPreviewFontSize(selectedEffect, canvas.width, canvas.height);

    const hasAnimation = selectedEffect.animation && selectedEffect.animation.type !== "none";

    const renderFrame = (time?: number, clipStartTime?: number, clipDuration?: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderTextEffectToContext(ctx, text, selectedEffect, fontSize, canvas.width / 2, canvas.height / 2, canvas.width, canvas.height, time, clipStartTime, clipDuration);
    };

    const startRendering = () => {
      if (disposed) return;

      if (!hasAnimation) {
        renderFrame();
        return;
      }

      // ── Animated effect: drive a rAF loop ──────────────────
      const loop = (now: number) => {
        if (disposed) return;
        const elapsedSec = (now - startTime) / 1000;
        const durationSec = (selectedEffect.durationMs ?? 2000) / 1000;
        const loopTime = elapsedSec % durationSec;

        renderFrame(loopTime, 0, durationSec);

        rafId.current = requestAnimationFrame(loop);
      };

      rafId.current = requestAnimationFrame(loop);
    };

    const loadFontAndRender = async () => {
      if (selectedEffect.font?.family) {
        try {
          await getFontLoader().ensureFont({
            family: selectedEffect.font.family,
            weight: selectedEffect.font.weight,
            style: selectedEffect.font.style,
          });
        } catch (error) {
          console.warn(`[TextEffects] Failed to pre-load preview font "${selectedEffect.font.family}":`, error);
        }
      }

      if (typeof document !== "undefined" && document.fonts) {
        await document.fonts.ready;
      }

      startRendering();
    };

    void loadFontAndRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId.current);
    };
  }, [selectedEffect, text]);   // re-render if user types new text
}

function getPreviewFontSize(effect: TextEffectDefinition, canvasWidth: number, canvasHeight: number): number {
  const sourceFontSize = typeof (effect as any).fontSize === "number" ? (effect as any).fontSize : 80;
  const sourceWidth = typeof (effect as any).canvasWidth === "number" && (effect as any).canvasWidth > 0 ? (effect as any).canvasWidth : canvasWidth;
  const sourceHeight = typeof (effect as any).canvasHeight === "number" && (effect as any).canvasHeight > 0 ? (effect as any).canvasHeight : canvasHeight;
  const scale = Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight);

  return Math.max(12, sourceFontSize * (Number.isFinite(scale) && scale > 0 ? scale : 1));
}
