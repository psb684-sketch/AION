import type { Clip, PlaybackMapping, TimelineSourceRange } from "@/types";
import { SpeedRampTimeline } from "./speedRamp";

export interface SourceTimeResolution {
  localTime: number;
  sourceTime: number;
  active: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

// ---------------------------------------------------------------------------
// PlaybackMapping dispatcher
// ---------------------------------------------------------------------------

/**
 * Given a clip's `playbackMapping` (or legacy `speed` scalar) and the clip-local
 * time (i.e. `timelineTime - clip.startTime`), return the source-media time.
 *
 * This is the canonical implementation of:
 *   timeline_time → PlaybackMapping → source_time
 *
 * All four mapping kinds are handled here so the rest of the codebase never
 * needs to know the internals.
 */
export function resolveSourceTimeFromMapping(
  mapping: PlaybackMapping | undefined,
  legacySpeed: number | undefined,
  localTime: number,
  trimIn: number,
  trimOut: number,
): number {
  // Absent mapping → fall back to legacy speed scalar → default 1.0
  if (!mapping) {
    const speed = typeof legacySpeed === "number" && legacySpeed > 0 ? legacySpeed : 1;
    return Math.max(0, trimIn + localTime * speed);
  }

  switch (mapping.kind) {
    case "normal": {
      const speed = Math.max(0.001, mapping.speed);
      return Math.max(0, trimIn + localTime * speed);
    }

    case "reverse": {
      const speed = Math.max(0.001, mapping.speed);
      // Play backward: at localTime=0 we read trimOut; at localTime=duration we'd read trimIn.
      return Math.max(0, trimOut - localTime * speed);
    }

    case "freeze": {
      // Source time is constant. The clip holds this frame for its entire duration.
      return Math.max(0, mapping.atSourceTime);
    }

    case "speed_ramp": {
      if (mapping.keyframes.length === 0) {
        // Degenerate ramp — treat as normal 1× speed.
        return Math.max(0, trimIn + localTime);
      }
      const ramp = new SpeedRampTimeline(
        mapping.keyframes.map((kf) => ({
          time: kf.time,
          speed: kf.speed,
          // SpeedRampTimeline accepts controlPoints as [x1,y1,x2,y2]
          controlPoints: kf.easing,
        })),
      );
      return Math.max(0, ramp.timelineToSourceTime(localTime, trimIn));
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function resolveClipSourceTime(
  clip: Pick<Clip, "startTime" | "duration" | "trimIn" | "trimOut"> & {
    speed?: number;
    playbackMapping?: PlaybackMapping;
  },
  timelineTime: number,
  options?: { clampToRange?: boolean; frameRate?: number },
): SourceTimeResolution {
  const localTime = timelineTime - clip.startTime;
  const active = localTime >= 0 && localTime < clip.duration;

  const rawSourceTime = resolveSourceTimeFromMapping(
    clip.playbackMapping,
    clip.speed,
    localTime,
    clip.trimIn,
    clip.trimOut,
  );

  if (options?.clampToRange) {
    // Enforce trimOut as required
    if (clip.trimOut === undefined) {
      console.error("[resolveClipSourceTime] CRITICAL: trimOut is undefined", {
        clipStartTime: clip.startTime,
        clipDuration: clip.duration,
        clipTrimIn: clip.trimIn,
        timelineTime,
      });
    }

    const safeTrimOut = clip.trimOut ?? clip.trimIn + clip.duration;
    const frameTime = options.frameRate ? 1 / options.frameRate : 0.001;
    const maxSourceTime = safeTrimOut - frameTime;
    const clamped = Math.min(rawSourceTime, maxSourceTime);
    const sourceTime = Math.max(clamped, clip.trimIn);
    return { localTime, sourceTime, active };
  }

  return { localTime, sourceTime: Math.max(0, rawSourceTime), active };
}

export function resolveTimelineItemSourceTime(
  source: TimelineSourceRange,
  placement: { startTime: number; duration: number },
  timelineTime: number,
  options?: { clampToRange?: boolean },
): SourceTimeResolution {
  const localTime = timelineTime - placement.startTime;
  const active = localTime >= 0 && localTime < placement.duration;
  const rate = source.playbackRate || 1;
  const rawOffset = localTime * rate;
  const rawSourceTime = source.reverse
    ? source.trimOut - rawOffset
    : source.trimIn + rawOffset;
  const min = Math.min(source.trimIn, source.trimOut);
  const max = Math.max(source.trimIn, source.trimOut);
  const sourceTime = options?.clampToRange
    ? clamp(rawSourceTime, min, max)
    : rawSourceTime;
  return { localTime, sourceTime: Math.max(0, sourceTime), active };
}
