/**
 * Core compositor resolver - time-based frame resolution.
 * This is the heart of the NLE engine.
 *
 * Philosophy:
 * - Time-centric, not track-centric
 * - Returns compositing stacks, not single clips
 * - Deterministic ordering rules
 * - Pure functions, no side effects
 */

import type {
  CompositorClip,
  RenderLayer,
  RenderStack,
  EvaluatedClip,
} from "./types";
import { compareCompositorClips } from "./ordering";
import { getClipEndTime } from "@/lib/timeline/timelineClip";
import { resolveClipSourceTime } from "@/core/timeline/sourceTime";

/**
 * Resolve the complete render stack at a specific time.
 * Returns all active layers ordered for compositing (bottom to top).
 *
 * Compositing order (deterministic):
 * 1. Layer type (background < primary < overlay < text < effect)
 * 2. Track index (HIGHER index renders BELOW - top track in UI renders on top)
 * 3. Z-index (explicit layer ordering)
 * 4. Evaluation priority (tie-breaker)
 *
 * @param time - Timeline time in seconds
 * @param clips - All clips in the timeline
 * @returns Ordered render stack (background to foreground)
 */
export function resolveRenderStack(
  time: number,
  clips: CompositorClip[],
): RenderStack {
  const activeCandidates = clips.filter((clip) => {
    const clipEnd = getClipEndTime(clip);
    return clip.startTime <= time && time < clipEnd;
  });

  if (activeCandidates.length === 0) {
    return { time, layers: [], hasContent: false };
  }

  const evaluatedLayers = activeCandidates
    .map((clip) => evaluateClipAtTime(clip, time))
    .filter((layer) => layer.opacity > 0);

  const sortedLayers = evaluatedLayers.sort((a, b) =>
    compareCompositorClips(a.clip, b.clip),
  );

  return { time, layers: sortedLayers, hasContent: sortedLayers.length > 0 };
}

/**
 * Evaluate a clip's state at a specific time.
 *
 * `localTime` on the returned layer is derived via the clip's `PlaybackMapping`:
 * it respects freeze, reverse, speed-ramp, and normal playback. The value is
 * the source-media local time, NOT merely `timelineTime − clip.startTime`.
 *
 * @param clip - The clip to evaluate
 * @param time - Global timeline time in seconds
 * @returns Render layer with evaluated state
 */
export function evaluateClipAtTime(
  clip: CompositorClip,
  time: number,
): RenderLayer {
  const { localTime } = resolveClipSourceTime(clip, time);

  return {
    clip,
    localTime,
    opacity: clip.opacity,
    transform: {
      x: clip.x,
      y: clip.y,
      width: clip.width,
      height: clip.height,
      rotation: clip.rotation,
    },
    inTransition: false,
  };
}

/**
 * Evaluate a clip's full state at a specific time.
 * More detailed than `evaluateClipAtTime` — the calling code can extend this
 * to include keyframe interpolation and effect evaluation in future phases.
 *
 * `localTime` on the returned result is the source-media local time after
 * `PlaybackMapping` has been applied (freeze, reverse, speed-ramp all handled).
 *
 * @param clip - The clip to evaluate
 * @param time - Global timeline time in seconds
 * @returns Complete evaluated state
 */
export function evaluateClip(
  clip: CompositorClip,
  time: number,
): EvaluatedClip {
  const clipEnd = getClipEndTime(clip);
  const isActive = clip.startTime <= time && time < clipEnd;

  if (!isActive) {
    return {
      clip,
      isActive: false,
      localTime: 0,
      opacity: 0,
      transform: {
        x: clip.x,
        y: clip.y,
        width: clip.width,
        height: clip.height,
        rotation: clip.rotation,
        scale: 1,
      },
      effects: [],
    };
  }

  // Resolve source-media time via the full PlaybackMapping dispatcher.
  // Handles all four mapping kinds: normal, reverse, freeze, speed_ramp.
  const { localTime } = resolveClipSourceTime(clip, time);

  return {
    clip,
    isActive: true,
    localTime,
    opacity: clip.opacity,
    transform: {
      x: clip.x,
      y: clip.y,
      width: clip.width,
      height: clip.height,
      rotation: clip.rotation,
      scale: 1,
    },
    effects: [],
  };
}

/**
 * Get all clips that overlap a time range.
 * Useful for batch operations, export, etc.
 */
export function getClipsInRange(
  startTime: number,
  endTime: number,
  clips: CompositorClip[],
): CompositorClip[] {
  return clips.filter((clip) => {
    const clipEnd = getClipEndTime(clip);
    return clip.startTime < endTime && clipEnd > startTime;
  });
}

/**
 * Check if a specific time has any renderable content.
 */
export function hasContentAtTime(
  time: number,
  clips: CompositorClip[],
): boolean {
  return clips.some((clip) => {
    const clipEnd = getClipEndTime(clip);
    return clip.startTime <= time && time < clipEnd;
  });
}
