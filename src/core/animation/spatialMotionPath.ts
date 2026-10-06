/**
 * Spatial Motion Path Engine
 *
 * Provides analytical 2D cubic Bézier trajectory geometry, Catmull-Rom continuous
 * auto-tangent derivation, instantaneous velocity vector calculations, frame tick density
 * distribution, and shutter-angle motion blur displacement for animated clips.
 */

import type {
  Clip,
  KeyframeEasing,
  KeyframeSpringConfig,
  VisualPropertyKeyframe,
} from "@/types";
import { resolveResponsiveKeyframes, getCurveEvaluator } from "./index";
import { evaluateVisualPropertyKeyframes } from "@/core/evaluation/animation";

export interface SpatialPoint {
  x: number;
  y: number;
}

export interface SpatialTangent {
  x: number;
  y: number;
}

export interface SpatialPathNode {
  id: string;
  time: number;
  point: SpatialPoint;
  tangentIn?: SpatialTangent;
  tangentOut?: SpatialTangent;
  hasExplicitTangents?: boolean;
  easing?: KeyframeEasing | (string & {});
  controlPoints?: [number, number, number, number];
  spring?: KeyframeSpringConfig;
}

export interface SpatialSegment {
  p0: SpatialPoint;
  p1: SpatialPoint;
  c1: SpatialPoint; // Absolute canvas coordinates
  c2: SpatialPoint; // Absolute canvas coordinates
  t0: number;
  t1: number;
  easing?: KeyframeEasing | (string & {});
  controlPoints?: [number, number, number, number];
  spring?: KeyframeSpringConfig;
}

export interface SpatialVelocity {
  vx: number;
  vy: number;
  speed: number;
  angle: number; // in radians
}

export interface ShutterBlurDisplacement {
  dx: number;
  dy: number;
  length: number;
  angle: number;
  shutterAngle: number;
  exposureTime: number;
}

export interface PathFrameTick {
  time: number;
  point: SpatialPoint;
  speed: number;
}

/**
 * Extracts and pairs X and Y keyframes from a clip into a continuous sequence
 * of 2D spatial path nodes sorted monotonically by time.
 */
export function extractSpatialPathNodes(clip: Clip): SpatialPathNode[] {
  const xKfs = (clip.visualKeyframes?.x || []) as VisualPropertyKeyframe[];
  const yKfs = (clip.visualKeyframes?.y || []) as VisualPropertyKeyframe[];

  if (xKfs.length === 0 && yKfs.length === 0) {
    return [];
  }

  const duration = clip.duration > 0 ? clip.duration : 1;
  const resolvedX = resolveResponsiveKeyframes(xKfs, duration);
  const resolvedY = resolveResponsiveKeyframes(yKfs, duration);

  // Collect all unique timestamps (within 10ms tolerance)
  const allTimes: number[] = [];
  const addTime = (t: number) => {
    const clamped = Math.max(0, Math.min(duration, t));
    const exists = allTimes.some((existing) => Math.abs(existing - clamped) < 0.015);
    if (!exists) {
      allTimes.push(clamped);
    }
  };

  resolvedX.forEach((k) => addTime(k.resolvedTime));
  resolvedY.forEach((k) => addTime(k.resolvedTime));
  allTimes.sort((a, b) => a - b);

  if (allTimes.length === 0) return [];

  // Build raw paired nodes
  const rawNodes: SpatialPathNode[] = allTimes.map((time, idx) => {
    // Find matching X and Y keyframes
    const matchedX = resolvedX.find((k) => Math.abs(k.resolvedTime - time) < 0.015);
    const matchedY = resolvedY.find((k) => Math.abs(k.resolvedTime - time) < 0.015);

    const xVal =
      matchedX !== undefined
        ? matchedX.value
        : evaluateVisualPropertyKeyframes(xKfs, time, clip.x, duration);
    const yVal =
      matchedY !== undefined
        ? matchedY.value
        : evaluateVisualPropertyKeyframes(yKfs, time, clip.y, duration);

    const sourceKf = matchedX || matchedY;
    const tangentIn = matchedX?.spatialIn || matchedY?.spatialIn;
    const tangentOut = matchedX?.spatialOut || matchedY?.spatialOut;

    return {
      id: sourceKf?.id || `node-${idx}-${time.toFixed(3)}`,
      time,
      point: { x: xVal, y: yVal },
      tangentIn: tangentIn ? { ...tangentIn } : undefined,
      tangentOut: tangentOut ? { ...tangentOut } : undefined,
      hasExplicitTangents: Boolean(tangentIn || tangentOut),
      easing: sourceKf?.easing,
      controlPoints: sourceKf?.controlPoints,
      spring: sourceKf?.spring,
    };
  });

  return computeAutoSmoothTangents(rawNodes);
}

/**
 * Calculates continuous Catmull-Rom / Fritsch-Carlson Bézier tangent handles
 * for spatial nodes that lack explicit manual tangents.
 */
export function computeAutoSmoothTangents(nodes: SpatialPathNode[]): SpatialPathNode[] {
  if (nodes.length <= 1) return nodes;

  const n = nodes.length;
  const result: SpatialPathNode[] = nodes.map((node) => ({ ...node }));

  for (let i = 0; i < n; i++) {
    const current = result[i];

    // Preserve explicit user-set tangents
    if (current.hasExplicitTangents && (current.tangentIn || current.tangentOut)) {
      continue;
    }

    if (n === 2) {
      // Direct two-point line segment: 1/3 distance handles along the chord
      const dx = nodes[1].point.x - nodes[0].point.x;
      const dy = nodes[1].point.y - nodes[0].point.y;

      if (i === 0) {
        current.tangentOut = { x: dx / 3, y: dy / 3 };
        current.tangentIn = { x: 0, y: 0 };
      } else {
        current.tangentIn = { x: -dx / 3, y: -dy / 3 };
        current.tangentOut = { x: 0, y: 0 };
      }
      continue;
    }

    if (i === 0) {
      // First node: tangent direction points to node 1
      const dx = nodes[1].point.x - nodes[0].point.x;
      const dy = nodes[1].point.y - nodes[0].point.y;
      current.tangentIn = { x: 0, y: 0 };
      current.tangentOut = { x: dx / 3, y: dy / 3 };
    } else if (i === n - 1) {
      // Last node: tangent direction comes from node n-2
      const dx = nodes[n - 1].point.x - nodes[n - 2].point.x;
      const dy = nodes[n - 1].point.y - nodes[n - 2].point.y;
      current.tangentIn = { x: -dx / 3, y: -dy / 3 };
      current.tangentOut = { x: 0, y: 0 };
    } else {
      // Interior node: continuous Catmull-Rom tangent aligned with (P_{i+1} - P_{i-1})
      const prev = nodes[i - 1].point;
      const next = nodes[i + 1].point;
      const cur = current.point;

      const chordX = next.x - prev.x;
      const chordY = next.y - prev.y;
      const chordLen = Math.hypot(chordX, chordY);

      if (chordLen < 1e-4) {
        current.tangentIn = { x: 0, y: 0 };
        current.tangentOut = { x: 0, y: 0 };
        continue;
      }

      const dirX = chordX / chordLen;
      const dirY = chordY / chordLen;

      // Scale handles proportionally to adjacent segment lengths (Centripetal property)
      const distIn = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      const distOut = Math.hypot(next.x - cur.x, next.y - cur.y);

      const handleInLen = Math.min(distIn / 3, chordLen / 3);
      const handleOutLen = Math.min(distOut / 3, chordLen / 3);

      current.tangentIn = { x: -dirX * handleInLen, y: -dirY * handleInLen };
      current.tangentOut = { x: dirX * handleOutLen, y: dirY * handleOutLen };
    }
  }

  return result;
}

/**
 * Builds analytical cubic segments connecting consecutive spatial nodes.
 */
export function buildSpatialSegments(nodes: SpatialPathNode[]): SpatialSegment[] {
  if (nodes.length < 2) return [];

  const segments: SpatialSegment[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const n0 = nodes[i];
    const n1 = nodes[i + 1];

    const outTan = n0.tangentOut || { x: 0, y: 0 };
    const inTan = n1.tangentIn || { x: 0, y: 0 };

    segments.push({
      p0: { ...n0.point },
      p1: { ...n1.point },
      c1: { x: n0.point.x + outTan.x, y: n0.point.y + outTan.y },
      c2: { x: n1.point.x + inTan.x, y: n1.point.y + inTan.y },
      t0: n0.time,
      t1: n1.time,
      easing: n0.easing,
      controlPoints: n0.controlPoints,
      spring: n0.spring,
    });
  }

  return segments;
}

/**
 * Evaluates a point on a 2D cubic Bézier curve at parameter s in [0, 1].
 */
export function evaluateSpatialBezier(
  p0: SpatialPoint,
  c1: SpatialPoint,
  c2: SpatialPoint,
  p1: SpatialPoint,
  s: number,
): SpatialPoint {
  const t = Math.max(0, Math.min(1, s));
  const oneMinusT = 1 - t;
  const t2 = t * t;
  const oneMinusT2 = oneMinusT * oneMinusT;

  const b0 = oneMinusT2 * oneMinusT;
  const b1 = 3 * oneMinusT2 * t;
  const b2 = 3 * oneMinusT * t2;
  const b3 = t2 * t;

  return {
    x: b0 * p0.x + b1 * c1.x + b2 * c2.x + b3 * p1.x,
    y: b0 * p0.y + b1 * c1.y + b2 * c2.y + b3 * p1.y,
  };
}

/**
 * Evaluates the first spatial derivative dB/ds vector along a 2D cubic Bézier curve.
 */
export function evaluateSpatialBezierDerivative(
  p0: SpatialPoint,
  c1: SpatialPoint,
  c2: SpatialPoint,
  p1: SpatialPoint,
  s: number,
): SpatialPoint {
  const t = Math.max(0, Math.min(1, s));
  const oneMinusT = 1 - t;

  const term0 = 3 * oneMinusT * oneMinusT;
  const term1 = 6 * oneMinusT * t;
  const term2 = 3 * t * t;

  return {
    x: term0 * (c1.x - p0.x) + term1 * (c2.x - c1.x) + term2 * (p1.x - c2.x),
    y: term0 * (c1.y - p0.y) + term1 * (c2.y - c1.y) + term2 * (p1.y - c2.y),
  };
}

/**
 * Evaluates the exact 2D spatial position for a clip at a given local time offset.
 */
export function evaluateSpatialPosition(clip: Clip, localTime: number): SpatialPoint {
  const nodes = extractSpatialPathNodes(clip);
  if (nodes.length === 0) {
    return { x: clip.x, y: clip.y };
  }
  if (nodes.length === 1) {
    return { ...nodes[0].point };
  }

  const duration = clip.duration > 0 ? clip.duration : 1;
  const clampedTime = Math.max(0, Math.min(duration, localTime));

  if (clampedTime <= nodes[0].time) {
    return { ...nodes[0].point };
  }
  if (clampedTime >= nodes[nodes.length - 1].time) {
    return { ...nodes[nodes.length - 1].point };
  }

  const segments = buildSpatialSegments(nodes);
  for (const seg of segments) {
    if (clampedTime >= seg.t0 && clampedTime <= seg.t1) {
      const dt = seg.t1 - seg.t0;
      const normalizedU = dt <= 0 ? 0 : (clampedTime - seg.t0) / dt;
      const curveEval = getCurveEvaluator(
        seg.easing ?? "easeInOut",
        seg.controlPoints,
        seg.spring,
      );
      const s = curveEval(normalizedU);
      return evaluateSpatialBezier(seg.p0, seg.c1, seg.c2, seg.p1, s);
    }
  }

  return { x: clip.x, y: clip.y };
}

/**
 * Calculates instantaneous spatial velocity vector (vx, vy in px/s) at localTime.
 */
export function evaluateSpatialVelocity(
  clip: Clip,
  localTime: number,
  fps = 30,
): SpatialVelocity {
  const nodes = extractSpatialPathNodes(clip);
  if (nodes.length < 2) {
    return { vx: 0, vy: 0, speed: 0, angle: 0 };
  }

  const duration = clip.duration > 0 ? clip.duration : 1;
  const clampedTime = Math.max(0, Math.min(duration, localTime));
  const segments = buildSpatialSegments(nodes);

  let activeSeg: SpatialSegment | null = null;
  for (const seg of segments) {
    if (clampedTime >= seg.t0 && clampedTime <= seg.t1) {
      activeSeg = seg;
      break;
    }
  }

  if (!activeSeg) {
    activeSeg =
      clampedTime < nodes[0].time
        ? segments[0]
        : segments[segments.length - 1];
  }

  const segDuration = Math.max(0.001, activeSeg.t1 - activeSeg.t0);
  const u = Math.max(0, Math.min(1, (clampedTime - activeSeg.t0) / segDuration));

  // Compute speed curve derivative ds/du using high-accuracy central difference
  const curveEval = getCurveEvaluator(
    activeSeg.easing ?? "easeInOut",
    activeSeg.controlPoints,
    activeSeg.spring,
  );
  const eps = 0.001;
  const uMinus = Math.max(0, u - eps);
  const uPlus = Math.min(1, u + eps);
  const dsDu = (curveEval(uPlus) - curveEval(uMinus)) / (uPlus - uMinus);

  // Time rate of change ds/dt = (ds/du) * (1 / segDuration)
  const dsDt = dsDu / segDuration;

  // Spatial rate of change dB/ds
  const s = curveEval(u);
  const dBezier = evaluateSpatialBezierDerivative(
    activeSeg.p0,
    activeSeg.c1,
    activeSeg.c2,
    activeSeg.p1,
    s,
  );

  // v = (dB/ds) * (ds/dt)
  const vx = dBezier.x * dsDt;
  const vy = dBezier.y * dsDt;
  const speed = Math.hypot(vx, vy);
  const angle = Math.atan2(vy, vx);

  return { vx, vy, speed, angle };
}

/**
 * Calculates synthetic shutter-angle displacement vector for GPU motion blur.
 *
 * Shutter angle of 180 deg corresponds to exposure time tau = 1 / (2 * fps).
 * Displacement D = v * tau.
 */
export function calculateShutterDisplacement(
  velocity: { vx: number; vy: number },
  shutterAngle = 180,
  fps = 30,
): ShutterBlurDisplacement {
  const safeFps = Math.max(1, fps);
  const safeShutter = Math.max(0, Math.min(360, shutterAngle));
  const exposureTime = safeShutter / (360 * safeFps);

  const dx = velocity.vx * exposureTime;
  const dy = velocity.vy * exposureTime;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  return {
    dx,
    dy,
    length,
    angle,
    shutterAngle: safeShutter,
    exposureTime,
  };
}

/**
 * Generates an SVG path data string (d="M ... C ...") representing the continuous spatial curve.
 */
export function generateSpatialPathSvg(nodes: SpatialPathNode[]): string {
  if (nodes.length === 0) return "";
  if (nodes.length === 1) {
    return `M ${nodes[0].point.x.toFixed(2)} ${nodes[0].point.y.toFixed(2)}`;
  }

  const segments = buildSpatialSegments(nodes);
  let d = `M ${segments[0].p0.x.toFixed(2)} ${segments[0].p0.y.toFixed(2)}`;

  for (const seg of segments) {
    d += ` C ${seg.c1.x.toFixed(2)} ${seg.c1.y.toFixed(2)}, ${seg.c2.x.toFixed(2)} ${seg.c2.y.toFixed(2)}, ${seg.p1.x.toFixed(2)} ${seg.p1.y.toFixed(2)}`;
  }

  return d;
}

/**
 * Computes frame tick positions along the path to visually communicate acceleration and deceleration.
 */
export function generatePathFrameTicks(clip: Clip, fps = 30): PathFrameTick[] {
  const duration = clip.duration > 0 ? clip.duration : 1;
  const safeFps = Math.max(1, Math.min(120, fps));
  const dt = 1 / safeFps;
  const ticks: PathFrameTick[] = [];

  for (let t = 0; t <= duration + 1e-4; t += dt) {
    const curTime = Math.min(duration, t);
    const point = evaluateSpatialPosition(clip, curTime);
    const velocity = evaluateSpatialVelocity(clip, curTime, safeFps);

    ticks.push({
      time: Math.round(curTime * 1000) / 1000,
      point,
      speed: velocity.speed,
    });
  }

  return ticks;
}

/**
 * Updates the 2D canvas coordinates of a keyframe node, keeping X and Y keyframe tracks synchronized.
 */
export function updateSpatialKeyframePosition(
  clip: Clip,
  nodeId: string,
  newPoint: SpatialPoint,
): Partial<Clip> {
  const nodes = extractSpatialPathNodes(clip);
  const targetNode = nodes.find((n) => n.id === nodeId);
  if (!targetNode) return {};

  const currentVisual = { ...(clip.visualKeyframes || {}) };
  const currentX = [...(currentVisual.x || [])];
  const currentY = [...(currentVisual.y || [])];

  const updateTrack = (track: VisualPropertyKeyframe[], val: number): VisualPropertyKeyframe[] => {
    const idx = track.findIndex((k) => Math.abs(k.time - targetNode.time) < 0.015 || k.id === nodeId);
    if (idx >= 0) {
      const updated = [...track];
      updated[idx] = { ...updated[idx], value: Math.round(val * 10) / 10 };
      return updated;
    }
    return [
      ...track,
      {
        id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: targetNode.time,
        value: Math.round(val * 10) / 10,
        easing: (targetNode.easing ?? "easeInOut") as KeyframeEasing,
      } as VisualPropertyKeyframe,
    ].sort((a, b) => a.time - b.time);
  };

  currentVisual.x = updateTrack(currentX, newPoint.x);
  currentVisual.y = updateTrack(currentY, newPoint.y);

  return { visualKeyframes: currentVisual };
}

/**
 * Adjusts a spatial Bézier tangent handle (in or out) for a keyframe node.
 * When lockSymmetric is true, keeps the opposite handle collinear.
 */
export function updateSpatialTangentHandle(
  clip: Clip,
  nodeId: string,
  handleType: "in" | "out",
  delta: SpatialPoint,
  lockSymmetric = true,
): Partial<Clip> {
  const nodes = extractSpatialPathNodes(clip);
  const targetNode = nodes.find((n) => n.id === nodeId);
  if (!targetNode) return {};

  const currentVisual = { ...(clip.visualKeyframes || {}) };
  const currentX = [...(currentVisual.x || [])];

  // We store spatialIn and spatialOut on the primary position keyframe (in track x)
  const idx = currentX.findIndex(
    (k) => Math.abs(k.time - targetNode.time) < 0.015 || k.id === nodeId,
  );
  if (idx < 0) return {};

  const kf = { ...currentX[idx] };
  const roundedDelta = {
    x: Math.round(delta.x * 10) / 10,
    y: Math.round(delta.y * 10) / 10,
  };

  if (handleType === "out") {
    kf.spatialOut = roundedDelta;
    if (lockSymmetric) {
      // Mirror direction for incoming handle
      const lenIn = kf.spatialIn ? Math.hypot(kf.spatialIn.x, kf.spatialIn.y) : Math.hypot(delta.x, delta.y);
      const outLen = Math.hypot(delta.x, delta.y);
      if (outLen > 1e-4) {
        const factor = lenIn / outLen;
        kf.spatialIn = {
          x: Math.round(-delta.x * factor * 10) / 10,
          y: Math.round(-delta.y * factor * 10) / 10,
        };
      }
    }
  } else {
    kf.spatialIn = roundedDelta;
    if (lockSymmetric) {
      // Mirror direction for outgoing handle
      const lenOut = kf.spatialOut ? Math.hypot(kf.spatialOut.x, kf.spatialOut.y) : Math.hypot(delta.x, delta.y);
      const inLen = Math.hypot(delta.x, delta.y);
      if (inLen > 1e-4) {
        const factor = lenOut / inLen;
        kf.spatialOut = {
          x: Math.round(-delta.x * factor * 10) / 10,
          y: Math.round(-delta.y * factor * 10) / 10,
        };
      }
    }
  }

  currentX[idx] = kf;
  currentVisual.x = currentX;

  return { visualKeyframes: currentVisual };
}

/**
 * Inserts a new spatial keyframe at a given local time and canvas position.
 */
export function insertSpatialKeyframeOnPath(
  clip: Clip,
  localTime: number,
  position: SpatialPoint,
  easing: KeyframeEasing = "easeInOut",
): Partial<Clip> {
  const currentVisual = { ...(clip.visualKeyframes || {}) };
  const currentX = [...(currentVisual.x || [])];
  const currentY = [...(currentVisual.y || [])];

  const duration = clip.duration > 0 ? clip.duration : 1;
  const clampedTime = Math.max(0, Math.min(duration, Math.round(localTime * 100) / 100));

  const kfId = `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newX: VisualPropertyKeyframe = {
    id: kfId,
    time: clampedTime,
    value: Math.round(position.x * 10) / 10,
    easing,
  };
  const newY: VisualPropertyKeyframe = {
    id: `kf-${Date.now()}-y`,
    time: clampedTime,
    value: Math.round(position.y * 10) / 10,
    easing,
  };

  currentVisual.x = [...currentX.filter((k) => Math.abs(k.time - clampedTime) >= 0.02), newX].sort(
    (a, b) => a.time - b.time,
  );
  currentVisual.y = [...currentY.filter((k) => Math.abs(k.time - clampedTime) >= 0.02), newY].sort(
    (a, b) => a.time - b.time,
  );

  return { visualKeyframes: currentVisual };
}
