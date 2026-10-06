/**
 * Transform Controller Hooks
 *
 * Provides UI snapshots of transform state (throttled to 10fps).
 * For render loops, read controller.getActiveTransform() imperatively instead.
 *
 * Architecture: Single global TransformController singleton shared by all consumers.
 *
 * Usage:
 *   // For UI (button state, inspector)
 *   const transform = useTransformState();
 *
 *   // For render loops (canvas, overlay)
 *   const controller = getTransformController();
 *   requestAnimationFrame(() => {
 *     const transform = controller.getActiveTransform(); // Imperative read
 *     renderOverlay(transform);
 *   });
 */

import { useEffect, useState, useMemo } from "react";
import { getTransformController, type TransformListener } from "@/core/interactions";
import type { TransformState } from "@/types";

/**
 * Hook for UI snapshots of transform state.
 * Updates are throttled to 10fps to avoid React render storms.
 *
 * For high-frequency reads (render loops), use getTransformController() directly.
 */
export function useTransformState(): TransformState | null {
  const controller = getTransformController();
  const [state, setState] = useState<TransformState | null>(controller.getActiveTransform());

  useEffect(() => {
    // Subscribe to throttled updates (10fps max)
    const unsubscribe = controller.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [controller]);

  return state;
}

/**
 * Hook for transform controls.
 * Returns imperative control functions (no state).
 * Functions are memoized to prevent unnecessary re-renders.
 */
export function useTransformControls() {
  const controller = getTransformController();

  return useMemo(
    () => ({
      startTransform: (state: TransformState) => controller.startTransform(state),
      updateTransform: (state: TransformState) => controller.updateTransform(state),
      endTransform: () => controller.endTransform(),
      getActiveTransform: () => controller.getActiveTransform(),
    }),
    [controller],
  );
}

/**
 * Get transform controller for imperative reads.
 * Re-exported from core for convenience.
 */
export { getTransformController };
