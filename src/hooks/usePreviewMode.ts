/**
 * usePreviewMode Hook
 *
 * Coordinates preview mode switching between Program and Source contexts.
 * Handles both UI state (which panel is shown) and transport state (which context is active).
 *
 * Architecture:
 *   UI Action → Hook → [UIStore + TransportAuthority] → Both states stay in sync
 *
 * This prevents the dual mutation anti-pattern where calling code has to manually
 * coordinate UIStore.previewAsset() + session.transportAuthority.setActiveContext().
 */

import { useCallback } from "react";
import { useUIStore } from "@/store/uiStore";
import { getActiveSessionOrNull } from "@/core/runtime/ProjectSession";
import type { MediaAsset } from "@/types";

export function usePreviewMode() {
  const { previewMode, previewAsset: setUIPreviewAsset, previewTextPreset: setUIPreviewTextPreset, exitSourceMode: setUIExitSourceMode } = useUIStore();

  /**
   * Switch to Source Preview with a media asset.
   * Automatically pauses any playing Program context.
   */
  const previewAsset = useCallback(
    (asset: MediaAsset) => {
      // 1. Update UI state
      setUIPreviewAsset(asset);

      // 2. Switch transport context (auto-pauses previous context)
      const session = getActiveSessionOrNull();
      if (session?.transportAuthority) {
        session.transportAuthority.setActiveContext("source");
      }
    },
    [setUIPreviewAsset],
  );

  /**
   * Switch to Source Preview with a text preset.
   * Automatically pauses any playing Program context.
   */
  const previewTextPreset = useCallback(
    (preset: any, type: "effect" | "template") => {
      // 1. Update UI state
      setUIPreviewTextPreset(preset, type);

      // 2. Switch transport context (auto-pauses previous context)
      const session = getActiveSessionOrNull();
      if (session?.transportAuthority) {
        session.transportAuthority.setActiveContext("source");
      }
    },
    [setUIPreviewTextPreset],
  );

  /**
   * Switch back to Program Preview.
   * Automatically pauses any playing Source context.
   */
  const exitSourceMode = useCallback(() => {
    // 1. Update UI state
    setUIExitSourceMode();

    // 2. Switch transport context (auto-pauses previous context)
    const session = getActiveSessionOrNull();
    if (session?.transportAuthority) {
      session.transportAuthority.setActiveContext("program");
    }
  }, [setUIExitSourceMode]);

  return {
    previewMode,
    previewAsset,
    previewTextPreset,
    exitSourceMode,
  };
}
