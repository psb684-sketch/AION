import { describe, it, expect } from "vitest";
import { solveCubicBezier, createCubicBezier } from "../cubicBezier";

describe("Cubic Bézier Solver", () => {
  describe("solveCubicBezier boundary conditions", () => {
    it("returns 0 for x <= 0 and 1 for x >= 1", () => {
      expect(solveCubicBezier(0.42, 0.0, 0.58, 1.0, 0)).toBe(0);
      expect(solveCubicBezier(0.42, 0.0, 0.58, 1.0, -0.5)).toBe(0);
      expect(solveCubicBezier(0.42, 0.0, 0.58, 1.0, 1)).toBe(1);
      expect(solveCubicBezier(0.42, 0.0, 0.58, 1.0, 1.5)).toBe(1);
    });
  });

  describe("Linear curve identity", () => {
    it("returns exact progress for linear control points", () => {
      const linear = createCubicBezier(0, 0, 1, 1);
      for (const x of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0]) {
        expect(linear(x)).toBeCloseTo(x, 6);
        expect(solveCubicBezier(0, 0, 1, 1, x)).toBeCloseTo(x, 6);
      }
    });
  });

  describe("Standard easing behavior", () => {
    it("evaluates easeIn (slow acceleration)", () => {
      const easeIn = createCubicBezier(0.42, 0.0, 1.0, 1.0);
      expect(easeIn(0.2)).toBeLessThan(0.2);
      expect(easeIn(0.5)).toBeLessThan(0.5);
    });

    it("evaluates easeOut (fast start, smooth deceleration)", () => {
      const easeOut = createCubicBezier(0.0, 0.0, 0.58, 1.0);
      expect(easeOut(0.2)).toBeGreaterThan(0.2);
      expect(easeOut(0.5)).toBeGreaterThan(0.5);
    });

    it("evaluates easeInOut (symmetric mid-point)", () => {
      const easeInOut = createCubicBezier(0.42, 0.0, 0.58, 1.0);
      expect(easeInOut(0.5)).toBeCloseTo(0.5, 2);
      expect(easeInOut(0.2)).toBeLessThan(0.2);
      expect(easeInOut(0.8)).toBeGreaterThan(0.8);
    });
  });

  describe("Extreme slopes and bisection fallback", () => {
    it("handles extreme steep tangents without divergence or NaN", () => {
      const steep = createCubicBezier(0.0, 1.0, 0.0, 1.0);
      for (let x = 0; x <= 1.0; x += 0.1) {
        const val = steep(x);
        expect(Number.isFinite(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1.0001);
      }
    });

    it("handles s-curve with zero derivative regions", () => {
      const sCurve = createCubicBezier(1.0, 0.0, 0.0, 1.0);
      for (let x = 0; x <= 1.0; x += 0.1) {
        const val = sCurve(x);
        expect(Number.isFinite(val)).toBe(true);
      }
    });

    it("handles overshoot control points (y > 1 or y < 0)", () => {
      // easeOutBack: overshoot
      const easeOutBack = createCubicBezier(0.34, 1.56, 0.64, 1.0);
      const peak = easeOutBack(0.7);
      expect(peak).toBeGreaterThan(1.0); // Overshoots destination
      expect(easeOutBack(1.0)).toBe(1.0); // Settles at target
    });
  });
});
