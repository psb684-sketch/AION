/**
 * Keyframe Track Operations & Velocity Curve Mathematics.
 *
 * Provides pure utility functions for keyframe retiming, snapping, duplication,
 * Bézier velocity ($dv/dt$) calculations, and curve sampling for the Timeline and
 * Curve Editor UI.
 */

import type { Keyframe, KeyframeEasing, KeyframeSpringConfig } from "@/types/keyframes";
import {
  solveCubicBezier,
  type BezierControlPoints,
} from "./cubicBezier";
import { getCurveEvaluator } from "./curvePresets";

export interface CurveSamplePoint {
  t: number;
  value: number;
  velocity: number;
}

/**
 * Calculates the instantaneous velocity ($dv/dt$) of a cubic Bézier curve at parameter $t \in [0, 1]$.
 *
 * Uses the derivative ratio: $\frac{dy}{dx} = \frac{dy/ds}{dx/ds}$ where $s$ is the
 * solved parametric polynomial root for $x(s) = t$.
 */
export function evaluateBezierVelocity(
  controlPoints: BezierControlPoints,
  t: number,
): number {
  const [x1, y1, x2, y2] = controlPoints;

  // Identity / Linear optimization
  if (x1 === y1 && x2 === y2) {
    return 1.0;
  }

  const clampedT = Math.max(0, Math.min(1, t));
  if (clampedT <= 0.0001) {
    // Left boundary derivative limit: if x1 > 0, dy/dx ~ y1 / x1
    return x1 > 0.001 ? Math.max(-5, Math.min(10, y1 / x1)) : 1.0;
  }
  if (clampedT >= 0.9999) {
    // Right boundary derivative limit: dy/dx ~ (1 - y2) / (1 - x2)
    const dx = 1 - x2;
    return dx > 0.001 ? Math.max(-5, Math.min(10, (1 - y2) / dx)) : 1.0;
  }

  // Numerical approximation via central difference for rock-solid stability
  // across all polynomial singularities and overshoot/undershoot bounds:
  const eps = 0.005;
  const tA = Math.max(0, clampedT - eps);
  const tB = Math.min(1, clampedT + eps);
  const dt = tB - tA;
  if (dt <= 0.00001) return 1.0;

  const yA = solveCubicBezier(x1, y1, x2, y2, tA);
  const yB = solveCubicBezier(x1, y1, x2, y2, tB);
  return (yB - yA) / dt;
}

/**
 * Generates uniform samples along the curve for visual plotting in SVG / Canvas.
 */
export function generateCurveSamples(
  controlPoints?: BezierControlPoints,
  easing?: KeyframeEasing,
  spring?: KeyframeSpringConfig,
  sampleCount = 60,
): CurveSamplePoint[] {
  const evaluator = getCurveEvaluator(
    easing ?? (controlPoints ? "cubic-bezier" : "linear"),
    controlPoints,
    spring,
  );

  const points: CurveSamplePoint[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    const value = evaluator(t);
    const velocity = controlPoints
      ? evaluateBezierVelocity(controlPoints, t)
      : i === 0 || i === sampleCount
        ? 1.0
        : (evaluator(Math.min(1, t + 0.01)) - evaluator(Math.max(0, t - 0.01))) / 0.02;

    points.push({ t, value, velocity });
  }

  return points;
}

export interface RetimeOptions {
  snapToTimes?: number[];
  snapThreshold?: number;
}

/**
 * Retimes a keyframe to a new timestamp, with boundary clamping and optional snapping.
 */
export function retimeKeyframe<T extends Keyframe<any>>(
  keyframes: T[],
  keyframeId: string,
  targetTime: number,
  clipDuration: number,
  options?: RetimeOptions,
): T[] {
  let clampedTime = Math.max(0, Math.min(clipDuration, targetTime));

  // Snap to targets (e.g. other keyframes, playhead, clip markers)
  if (options?.snapToTimes && options.snapToTimes.length > 0) {
    const threshold = options.snapThreshold ?? 0.05;
    for (const snapTime of options.snapToTimes) {
      if (Math.abs(clampedTime - snapTime) <= threshold) {
        clampedTime = snapTime;
        break;
      }
    }
  }

  const updated = keyframes.map((kf) => {
    if (kf.id === keyframeId) {
      return { ...kf, time: clampedTime };
    }
    return kf;
  });

  return sortKeyframes(updated);
}

/**
 * Duplicates an existing keyframe to a new timestamp.
 */
export function duplicateKeyframe<T extends Keyframe<any>>(
  keyframes: T[],
  sourceKeyframeId: string,
  targetTime: number,
  clipDuration: number,
): T[] {
  const source = keyframes.find((kf) => kf.id === sourceKeyframeId);
  if (!source) return keyframes;

  const clampedTime = Math.max(0, Math.min(clipDuration, targetTime));
  const newKeyframe: T = {
    ...source,
    id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: clampedTime,
  };

  return sortKeyframes([...keyframes, newKeyframe]);
}

/**
 * Deletes a keyframe by its unique ID.
 */
export function deleteKeyframe<T extends Keyframe<any>>(
  keyframes: T[],
  keyframeId: string,
): T[] {
  return keyframes.filter((kf) => kf.id !== keyframeId);
}

/**
 * Applies easing and optional Bézier tangents / spring config to a specific keyframe.
 */
export function applyCurveToKeyframe<T extends Keyframe<any>>(
  keyframes: T[],
  keyframeIndex: number,
  easing: KeyframeEasing,
  controlPoints?: [number, number, number, number],
  spring?: KeyframeSpringConfig,
): T[] {
  if (keyframeIndex < 0 || keyframeIndex >= keyframes.length) {
    return keyframes;
  }

  return keyframes.map((kf, idx) => {
    if (idx === keyframeIndex) {
      return {
        ...kf,
        easing,
        controlPoints,
        spring,
      };
    }
    return kf;
  });
}

/**
 * Applies easing and optional Bézier tangents / spring config to all keyframes in a track.
 */
export function applyCurveToAllKeyframes<T extends Keyframe<any>>(
  keyframes: T[],
  easing: KeyframeEasing,
  controlPoints?: [number, number, number, number],
  spring?: KeyframeSpringConfig,
): T[] {
  return keyframes.map((kf) => ({
    ...kf,
    easing,
    controlPoints,
    spring,
  }));
}

/**
 * Finds the surrounding keyframe segment for a given local clip time.
 */
export function findActiveKeyframeSegment<T extends Keyframe<any>>(
  keyframes: T[],
  localTime: number,
): {
  index: number;
  startKeyframe: T;
  endKeyframe?: T;
  progress: number;
} | null {
  if (!keyframes || keyframes.length === 0) return null;

  const sorted = sortKeyframes(keyframes);

  if (localTime <= sorted[0].time) {
    return {
      index: 0,
      startKeyframe: sorted[0],
      endKeyframe: sorted[1],
      progress: 0,
    };
  }

  const lastIdx = sorted.length - 1;
  if (localTime >= sorted[lastIdx].time) {
    return {
      index: Math.max(0, lastIdx - 1),
      startKeyframe: sorted[Math.max(0, lastIdx - 1)],
      endKeyframe: sorted[lastIdx],
      progress: 1,
    };
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (localTime >= start.time && localTime <= end.time) {
      const dt = end.time - start.time;
      const progress = dt > 0.0001 ? (localTime - start.time) / dt : 0;
      return {
        index: i,
        startKeyframe: start,
        endKeyframe: end,
        progress,
      };
    }
  }

  return {
    index: 0,
    startKeyframe: sorted[0],
    endKeyframe: sorted[1],
    progress: 0,
  };
}

/**
 * Sorts keyframes monotonically by time.
 */
export function sortKeyframes<T extends Keyframe<any>>(keyframes: T[]): T[] {
  return [...keyframes].sort((a, b) => a.time - b.time);
}
