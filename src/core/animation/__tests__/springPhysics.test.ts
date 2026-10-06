import { describe, it, expect } from "vitest";
import {
  evaluateSpringProgress,
  evaluateSpring,
  SPRING_PRESETS,
  type SpringConfig,
} from "../springPhysics";

describe("Spring Physics Oscillator Engine", () => {
  describe("Boundary values", () => {
    it("returns 0 at progress <= 0 and 1 at progress >= 1", () => {
      expect(evaluateSpringProgress(0)).toBe(0);
      expect(evaluateSpringProgress(-0.5)).toBe(0);
      expect(evaluateSpringProgress(1)).toBe(1);
      expect(evaluateSpringProgress(1.5)).toBe(1);
    });

    it("handles zero or negative duration gracefully", () => {
      expect(evaluateSpring(0, 0)).toBe(1);
      expect(evaluateSpring(0.5, 0)).toBe(1);
      expect(evaluateSpring(-1, 0)).toBe(0);
      expect(evaluateSpring(0.5, -2)).toBe(1);
    });

    it("evaluates matching progress and duration-based time", () => {
      const pVal = evaluateSpringProgress(0.5, SPRING_PRESETS.snappy);
      const tVal = evaluateSpring(0.5, 1.0, SPRING_PRESETS.snappy);
      expect(tVal).toBeCloseTo(pVal, 6);
    });
  });

  describe("Underdamped spring behavior (Overshoot & Oscillation)", () => {
    it("bouncy preset overshoots the target value 1.0", () => {
      let maxVal = 0;
      for (let p = 0; p <= 1.0; p += 0.02) {
        const val = evaluateSpringProgress(p, SPRING_PRESETS.bouncy);
        if (val > maxVal) maxVal = val;
      }
      expect(maxVal).toBeGreaterThan(1.1); // at least 10% overshoot
    });

    it("wobbly preset produces sustained oscillating dynamics", () => {
      let maxVal = 0;
      for (let p = 0; p <= 1.0; p += 0.01) {
        const val = evaluateSpringProgress(p, SPRING_PRESETS.wobbly);
        if (val > maxVal) maxVal = val;
      }
      expect(maxVal).toBeGreaterThan(1.15); // exaggerated wobble
    });
  });

  describe("Critically damped and gentle spring behavior", () => {
    it("gentle preset has minimal to no overshoot", () => {
      let maxVal = 0;
      for (let p = 0; p <= 1.0; p += 0.02) {
        const val = evaluateSpringProgress(p, SPRING_PRESETS.gentle);
        if (val > maxVal) maxVal = val;
      }
      // Gentle preset damping is high enough that overshoot is negligible (< 1.02)
      expect(maxVal).toBeLessThan(1.02);
    });

    it("handles purely overdamped parameters without error", () => {
      const overdampedConfig: SpringConfig = {
        stiffness: 50,
        damping: 50, // zeta >> 1
        mass: 1,
      };
      let prev = 0;
      for (let p = 0.05; p < 1.0; p += 0.1) {
        const val = evaluateSpringProgress(p, overdampedConfig);
        expect(Number.isFinite(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(prev);
        prev = val;
      }
    });
  });

  describe("Spring presets integrity", () => {
    it("all presets produce finite real numbers across 0..1", () => {
      const presets = Object.values(SPRING_PRESETS);
      for (const preset of presets) {
        for (let p = 0; p <= 1.0; p += 0.05) {
          const val = evaluateSpringProgress(p, preset);
          expect(Number.isFinite(val)).toBe(true);
          expect(Number.isNaN(val)).toBe(false);
        }
      }
    });

    it("respects initialVelocity parameter", () => {
      const standard = evaluateSpringProgress(0.1, { stiffness: 150, damping: 15, mass: 1, initialVelocity: 0 });
      const fastInitial = evaluateSpringProgress(0.1, { stiffness: 150, damping: 15, mass: 1, initialVelocity: 15 });
      expect(fastInitial).toBeGreaterThan(standard);
    });
  });
});
