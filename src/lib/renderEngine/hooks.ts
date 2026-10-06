/**
 * Render Engine — React Subscription Hooks
 *
 * The only interface ClipFilmstrip (and any other React component) should use
 * to consume render engine state. Components must NOT import RenderRuntime,
 * RenderScheduler, or any policy module directly for orchestration.
 *
 * Pattern: hooks access RenderRuntime via useRenderRuntime() hook from ProjectSession.
 */

import { useEffect, useRef, useState } from "react";
import { useRenderRuntime } from "@/hooks/useRenderRuntime";
import { type RenderState, type RenderArtifact, type RenderEpochId, SpatialTier, TemporalTier, InteractionState, VelocityState, RendererMode } from "./types";
import { computeEpochId } from "./epoch";

// ─── Default state (no runtime initialised yet) ───────────────────────────────

function defaultRenderState(clipId: string): RenderState {
  return {
    clipId,
    currentTier: { spatialTier: SpatialTier.L0, temporalTier: TemporalTier.L0 },
    targetTier: { spatialTier: SpatialTier.L0, temporalTier: TemporalTier.L0 },
    epochId: computeEpochId({
      clipId,
      clipVersion: 0,
      transformGraphVersion: 0,
      viewportBounds: { x: 0, y: 0, width: 0, height: 0 },
      velocityState: VelocityState.Stable,
      zoomLevel: 1.0,
      spatialTier: SpatialTier.L0,
      temporalTier: TemporalTier.L0,
      rendererMode: RendererMode.Canvas2D,
    }),
    interactionState: InteractionState.Idle,
    visibleArtifacts: [],
    isFallback: true,
  };
}

// ─── Primary hook ─────────────────────────────────────────────────────────────

/**
 * Subscribe to the full RenderState for a clip.
 * Re-renders only when the state reference changes (shallow stable from runtime).
 *
 * Usage:
 *   const renderState = useRenderState(clip.id);
 */
export function useRenderState(clipId: string): RenderState {
  const runtime = useRenderRuntime();
  const [state, setState] = useState<RenderState>(() => defaultRenderState(clipId));
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!runtime) {
      setState(defaultRenderState(clipId));
      return;
    }

    runtime.registerClip(clipId);
    unsubRef.current = runtime.subscribe(clipId, (newState) => {
      setState(newState);
    });

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
      runtime.unregisterClip(clipId);
    };
  }, [runtime, clipId]);

  return state;
}

// ─── Derived hooks ────────────────────────────────────────────────────────────

/**
 * Subscribe to visible RenderArtifacts for a clip.
 * Phase 1: returns empty array (artifacts populated in Phase 3 transport layer).
 */
export function useRenderArtifacts(clipId: string): readonly RenderArtifact[] {
  return useRenderState(clipId).visibleArtifacts;
}

/**
 * Subscribe to the current RenderEpochId for a clip.
 * Useful for components that need to detect epoch changes without
 * re-rendering on every state field change.
 */
export function useEpoch(clipId: string): RenderEpochId {
  return useRenderState(clipId).epochId;
}

/**
 * Subscribe to the current InteractionState.
 * Useful for overlays that need to show/hide during scrubbing.
 */
export function useInteractionState(clipId: string): InteractionState {
  return useRenderState(clipId).interactionState;
}

/**
 * True if the clip is currently rendering from a fallback (lower tier,
 * poster frame, or placeholder) rather than the correct tier.
 */
export function useIsFallback(clipId: string): boolean {
  return useRenderState(clipId).isFallback;
}
