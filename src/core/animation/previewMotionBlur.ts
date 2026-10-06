/**
 * Preview Motion Blur
 *
 * Provides CSS/SVG filter parameters for DOM canvas motion blur preview
 * (used when the native GPU compositor is idle or unavailable).
 * The GPU shutter blur pass in multi_track_blend.wgsl handles the production path.
 */

import { evaluateSpatialVelocity, calculateShutterDisplacement } from "@/core/animation/spatialMotionPath";
import type { Clip, ClipMotionBlurConfig } from "@/types";

export interface PreviewMotionBlurParams {
  /** CSS filter string e.g. "blur(3px)" or SVG filter ID reference */
  cssFilter: string;
  /** Whether the blur is active (speed above threshold) */
  active: boolean;
  /** Pixel displacement length in preview display space */
  displayLength: number;
  /** Angle in radians */
  angle: number;
}

/** Minimum displacement length in canvas pixels to activate blur */
const MIN_DISPLACEMENT_PX = 3;

/**
 * Calculates preview motion blur parameters for a clip at the given presentation time.
 * Outputs CSS filter string for the DOM canvas fallback path.
 *
 * @param clip          - The animated clip
 * @param presentationTime - Global playback time in seconds
 * @param scale         - Canvas → display scale factor
 * @param fps           - Project frame rate
 */
export function getPreviewMotionBlurParams(
  clip: Clip,
  presentationTime: number,
  scale = 1,
  fps = 30,
): PreviewMotionBlurParams {
  const noop: PreviewMotionBlurParams = {
    cssFilter: "none",
    active: false,
    displayLength: 0,
    angle: 0,
  };

  const config: ClipMotionBlurConfig | undefined = clip.motionBlur;
  if (!config?.enabled) return noop;

  const localTime = Math.max(
    0,
    Math.min(clip.duration, presentationTime - clip.startTime),
  );

  const xLen = clip.visualKeyframes?.x?.length ?? 0;
  const yLen = clip.visualKeyframes?.y?.length ?? 0;
  if (xLen < 2 && yLen < 2) return noop;

  const velocity = evaluateSpatialVelocity(clip, localTime, fps);
  if (velocity.speed < 0.5) return noop;

  const shutterAngle = config.shutterAngle ?? 180;
  const displacement = calculateShutterDisplacement(
    { vx: velocity.vx, vy: velocity.vy },
    shutterAngle,
    fps,
  );

  const displayLength = displacement.length * scale;
  if (displayLength < MIN_DISPLACEMENT_PX) return noop;

  // Clamp blur sigma to a reasonable maximum (8px display blur sigma)
  // beyond which the multi-sample GPU path should be used anyway.
  const sigma = Math.min(8, displayLength * 0.4);

  return {
    cssFilter: `blur(${sigma.toFixed(1)}px)`,
    active: true,
    displayLength,
    angle: displacement.angle,
  };
}
