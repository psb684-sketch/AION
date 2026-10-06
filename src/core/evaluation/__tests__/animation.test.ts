import { describe, it, expect } from "vitest";
import {
  evaluateProperty,
  interpolateColor,
  solveCubicBezier,
  getEasingProgress,
  isKeyframed,
} from "../animation";

describe("Keyframe Animation System", () => {
  describe("isKeyframed", () => {
    it("identifies keyframed properties", () => {
      expect(isKeyframed({ keyframes: [], defaultValue: 10 })).toBe(true);
      expect(isKeyframed(10)).toBe(false);
      expect(isKeyframed("hello")).toBe(false);
      expect(isKeyframed(undefined)).toBe(false);
    });
  });

  describe("solveCubicBezier", () => {
    it("evaluates boundary conditions", () => {
      expect(solveCubicBezier(0.25, 0.1, 0.25, 1.0, 0)).toBe(0);
      expect(solveCubicBezier(0.25, 0.1, 0.25, 1.0, 1)).toBe(1);
    });

    it("approximates points along the curve", () => {
      const mid = solveCubicBezier(0.42, 0.0, 0.58, 1.0, 0.5);
      expect(mid).toBeCloseTo(0.5, 2);
    });
  });

  describe("getEasingProgress", () => {
    it("handles standard ease keywords", () => {
      expect(getEasingProgress("linear", 0.3)).toBeCloseTo(0.3, 4);
      expect(getEasingProgress("ease-in", 0.5)).toBeLessThan(0.5);
      expect(getEasingProgress("ease-out", 0.5)).toBeGreaterThan(0.5);
    });

    it("evaluates custom cubic-bezier curves", () => {
      const customVal = getEasingProgress("cubic-bezier", 0.4, [0.1, 0.2, 0.8, 0.9]);
      expect(customVal).toBeGreaterThan(0);
      expect(customVal).toBeLessThan(1);
    });
  });

  describe("interpolateColor", () => {
    it("interpolates hex colors", () => {
      const color = interpolateColor("#000000", "#ffffff", 0.5);
      expect(color).toContain("rgba(128, 128, 128");
    });

    it("handles color transparency", () => {
      const color = interpolateColor("transparent", "rgba(255, 0, 0, 1.0)", 0.5);
      expect(color).toContain("rgba(128, 0, 0");
    });
  });

  describe("evaluateProperty", () => {
    it("returns static values immediately", () => {
      expect(evaluateProperty(42, 0.5, 10)).toBe(42);
      expect(evaluateProperty("red", 0.2, 5)).toBe("red");
    });

    it("falls back to default value if keyframes are empty", () => {
      const prop = { keyframes: [], defaultValue: 99 };
      expect(evaluateProperty(prop, 0.5, 10)).toBe(99);
    });

    it("clamps to first keyframe when before start", () => {
      const prop = {
        keyframes: [
          { time: 1.0, value: 10, easing: "linear" as const },
          { time: 2.0, value: 20, easing: "linear" as const },
        ],
        defaultValue: 0,
      };
      expect(evaluateProperty(prop, 0.5, 10)).toBe(10);
    });

    it("clamps to last keyframe when after end", () => {
      const prop = {
        keyframes: [
          { time: 1.0, value: 10, easing: "linear" as const },
          { time: 2.0, value: 20, easing: "linear" as const },
        ],
        defaultValue: 0,
      };
      expect(evaluateProperty(prop, 2.5, 10)).toBe(20);
    });

    it("interpolates linearly between keyframes", () => {
      const prop = {
        keyframes: [
          { time: 0.0, value: 100, easing: "linear" as const },
          { time: 2.0, value: 200, easing: "linear" as const },
        ],
        defaultValue: 0,
      };
      expect(evaluateProperty(prop, 1.0, 2)).toBeCloseTo(150, 4);
    });

    it("interpolates colors between keyframes", () => {
      const prop = {
        keyframes: [
          { time: 0.0, value: "#ff0000", easing: "linear" as const },
          { time: 1.0, value: "#0000ff", easing: "linear" as const },
        ],
        defaultValue: "#000000",
      };
      const res = evaluateProperty(prop, 0.5, 1);
      expect(res).toContain("rgba(128, 0, 128");
    });
  });
});
