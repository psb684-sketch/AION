import { describe, it, expect } from "vitest";
import {
  extractSpatialPathNodes,
  computeAutoSmoothTangents,
  evaluateSpatialBezier,
  evaluateSpatialPosition,
  evaluateSpatialVelocity,
  calculateShutterDisplacement,
  generateSpatialPathSvg,
  generatePathFrameTicks,
  updateSpatialKeyframePosition,
  updateSpatialTangentHandle,
  insertSpatialKeyframeOnPath,
} from "../spatialMotionPath";
import type { Clip } from "@/types";

describe("spatialMotionPath mathematical engine", () => {
  const mockClip: Clip = {
    id: "clip-spatial-1",
    trackId: "track-1",
    name: "Motion Graphic",
    mediaId: "",
    startTime: 0,
    duration: 4,
    trimIn: 0,
    trimOut: 4,
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    rotation: 0,
    opacity: 1,
    visualKeyframes: {
      x: [
        { id: "x-1", time: 0, value: 100, easing: "linear" },
        { id: "x-2", time: 2, value: 500, easing: "linear" },
        { id: "x-3", time: 4, value: 900, easing: "linear" },
      ],
      y: [
        { id: "y-1", time: 0, value: 100, easing: "linear" },
        { id: "y-2", time: 2, value: 300, easing: "linear" },
        { id: "y-3", time: 4, value: 100, easing: "linear" },
      ],
    },
  };

  it("extracts spatial nodes pairing X and Y keyframes", () => {
    const nodes = extractSpatialPathNodes(mockClip);
    expect(nodes.length).toBe(3);
    expect(nodes[0].point).toEqual({ x: 100, y: 100 });
    expect(nodes[1].point).toEqual({ x: 500, y: 300 });
    expect(nodes[2].point).toEqual({ x: 900, y: 100 });
  });

  it("computes continuous Catmull-Rom smooth tangents for interior nodes", () => {
    const nodes = extractSpatialPathNodes(mockClip);
    expect(nodes[1].tangentIn).toBeDefined();
    expect(nodes[1].tangentOut).toBeDefined();

    // The interior node at (500, 300) between (100, 100) and (900, 100)
    // P_next - P_prev = (800, 0), so tangent direction is strictly horizontal (dy = 0)!
    expect(nodes[1].tangentOut?.y).toBeCloseTo(0, 1);
    expect(nodes[1].tangentOut?.x).toBeGreaterThan(0);
    expect(nodes[1].tangentIn?.x).toBeLessThan(0);
  });

  it("evaluates cubic Bezier point accurately across [0, 1]", () => {
    const p0 = { x: 0, y: 0 };
    const c1 = { x: 10, y: 30 };
    const c2 = { x: 20, y: 30 };
    const p1 = { x: 30, y: 0 };

    const start = evaluateSpatialBezier(p0, c1, c2, p1, 0);
    expect(start).toEqual(p0);

    const end = evaluateSpatialBezier(p0, c1, c2, p1, 1);
    expect(end).toEqual(p1);

    const mid = evaluateSpatialBezier(p0, c1, c2, p1, 0.5);
    expect(mid.x).toBeCloseTo(15, 1);
    expect(mid.y).toBeGreaterThan(0); // Curving upward towards control points
  });

  it("evaluates spatial position along clip timeline", () => {
    const pStart = evaluateSpatialPosition(mockClip, 0);
    expect(pStart.x).toBeCloseTo(100, 1);
    expect(pStart.y).toBeCloseTo(100, 1);

    const pMid = evaluateSpatialPosition(mockClip, 2);
    expect(pMid.x).toBeCloseTo(500, 1);
    expect(pMid.y).toBeCloseTo(300, 1);

    const pEnd = evaluateSpatialPosition(mockClip, 4);
    expect(pEnd.x).toBeCloseTo(900, 1);
    expect(pEnd.y).toBeCloseTo(100, 1);
  });

  it("calculates instantaneous velocity vectors", () => {
    const vel = evaluateSpatialVelocity(mockClip, 1, 30);
    expect(vel.speed).toBeGreaterThan(0);
    expect(vel.vx).toBeGreaterThan(0); // Moving to the right
  });

  it("computes synthetic shutter blur displacement accurately", () => {
    // 600 px/s at 30 fps with 180 deg shutter (tau = 1/60s) -> 10 px displacement
    const vel = { vx: 600, vy: 0 };
    const blur180 = calculateShutterDisplacement(vel, 180, 30);
    expect(blur180.exposureTime).toBeCloseTo(1 / 60, 4);
    expect(blur180.dx).toBeCloseTo(10, 2);
    expect(blur180.dy).toBe(0);
    expect(blur180.length).toBeCloseTo(10, 2);

    // 360 deg shutter -> 20 px displacement
    const blur360 = calculateShutterDisplacement(vel, 360, 30);
    expect(blur360.dx).toBeCloseTo(20, 2);
    expect(blur360.length).toBeCloseTo(20, 2);
  });

  it("generates valid SVG path data strings", () => {
    const nodes = extractSpatialPathNodes(mockClip);
    const svgD = generateSpatialPathSvg(nodes);
    expect(svgD.startsWith("M 100")).toBe(true);
    expect(svgD.includes("C ")).toBe(true);
  });

  it("generates frame ticks for speed visualization", () => {
    const ticks = generatePathFrameTicks(mockClip, 10);
    // 4 seconds at 10 fps yields ~41 ticks
    expect(ticks.length).toBeGreaterThanOrEqual(40);
    expect(ticks[0].point.x).toBeCloseTo(100, 1);
  });

  it("updates keyframe position keeping X and Y synchronized", () => {
    const nodes = extractSpatialPathNodes(mockClip);
    const update = updateSpatialKeyframePosition(mockClip, nodes[1].id, { x: 550, y: 350 });
    expect(update.visualKeyframes?.x?.find((k) => k.time === 2)?.value).toBe(550);
    expect(update.visualKeyframes?.y?.find((k) => k.time === 2)?.value).toBe(350);
  });

  it("adjusts spatial tangent handles and locks symmetry when enabled", () => {
    const nodes = extractSpatialPathNodes(mockClip);
    const update = updateSpatialTangentHandle(
      mockClip,
      nodes[1].id,
      "out",
      { x: 80, y: 20 },
      true,
    );
    const kf = update.visualKeyframes?.x?.find((k) => k.time === 2);
    expect(kf?.spatialOut).toEqual({ x: 80, y: 20 });
    // In handle should be mirrored
    expect(kf?.spatialIn?.x).toBeCloseTo(-80, 1);
    expect(kf?.spatialIn?.y).toBeCloseTo(-20, 1);
  });

  it("inserts new spatial keyframes along the path", () => {
    const update = insertSpatialKeyframeOnPath(mockClip, 1.0, { x: 300, y: 200 });
    expect(update.visualKeyframes?.x?.some((k) => k.time === 1.0)).toBe(true);
    expect(update.visualKeyframes?.y?.some((k) => k.time === 1.0)).toBe(true);
  });
});
