import { describe, it, expect } from "vitest";
import { getCurveEvaluator, CURVE_PRESETS } from "../curvePresets";

describe("Curve Presets & Evaluator Factory", () => {
  describe("Preset Catalog", () => {
    it("contains registered standard, kinetic, speed, and spring presets", () => {
      expect(CURVE_PRESETS.linear).toBeDefined();
      expect(CURVE_PRESETS.easeIn).toBeDefined();
      expect(CURVE_PRESETS.easeOut).toBeDefined();
      expect(CURVE_PRESETS.easeInOut).toBeDefined();
      expect(CURVE_PRESETS.easeOutBack).toBeDefined();
      expect(CURVE_PRESETS.easeInBack).toBeDefined();
      expect(CURVE_PRESETS.speedHero).toBeDefined();
      expect(CURVE_PRESETS.speedBullet).toBeDefined();
      expect(CURVE_PRESETS.speedMontage).toBeDefined();
      expect(CURVE_PRESETS.springSnappy).toBeDefined();
      expect(CURVE_PRESETS.springBouncy).toBeDefined();
      expect(CURVE_PRESETS.springGentle).toBeDefined();
    });
  });

  describe("getCurveEvaluator standard aliases", () => {
    it("handles kebab-case CSS aliases", () => {
      const easeIn = getCurveEvaluator("ease-in");
      const easeOut = getCurveEvaluator("ease-out");
      const easeInOut = getCurveEvaluator("ease-in-out");

      expect(easeIn(0.5)).toBeLessThan(0.5);
      expect(easeOut(0.5)).toBeGreaterThan(0.5);
      expect(easeInOut(0.5)).toBeCloseTo(0.5, 2);
    });

    it("evaluates linear correctly", () => {
      const linear = getCurveEvaluator("linear");
      expect(linear(0.25)).toBeCloseTo(0.25, 5);
      expect(linear(0.75)).toBeCloseTo(0.75, 5);
    });
  });

  describe("getCurveEvaluator kinetic & spring presets", () => {
    it("evaluates easeOutBack with overshoot", () => {
      const easeOutBack = getCurveEvaluator("easeOutBack");
      let maxVal = 0;
      for (let p = 0; p <= 1.0; p += 0.05) {
        const val = easeOutBack(p);
        if (val > maxVal) maxVal = val;
      }
      expect(maxVal).toBeGreaterThan(1.0);
    });

    it("evaluates easeInBack with wind-up anticipation (value < 0)", () => {
      const easeInBack = getCurveEvaluator("easeInBack");
      let minVal = 0;
      for (let p = 0; p <= 0.5; p += 0.05) {
        const val = easeInBack(p);
        if (val < minVal) minVal = val;
      }
      expect(minVal).toBeLessThan(0);
    });

    it("evaluates spring presets via string ID", () => {
      const bouncy = getCurveEvaluator("springBouncy");
      let maxVal = 0;
      for (let p = 0; p <= 1.0; p += 0.05) {
        const val = bouncy(p);
        if (val > maxVal) maxVal = val;
      }
      expect(maxVal).toBeGreaterThan(1.05);
    });
  });

  describe("Bounces and special mathematical curves", () => {
    it("evaluates easeOutBounce and bounce alias", () => {
      const bounce = getCurveEvaluator("bounce");
      const easeOutBounce = getCurveEvaluator("easeOutBounce");
      expect(bounce(0)).toBe(0);
      expect(bounce(1)).toBe(1);
      expect(bounce(0.5)).toBeCloseTo(easeOutBounce(0.5), 6);
    });

    it("evaluates easeInBounce and easeInOutBounce", () => {
      const easeInBounce = getCurveEvaluator("easeInBounce");
      const easeInOutBounce = getCurveEvaluator("easeInOutBounce");
      expect(easeInBounce(0)).toBe(0);
      expect(easeInBounce(1)).toBe(1);
      expect(easeInOutBounce(0)).toBe(0);
      expect(easeInOutBounce(1)).toBe(1);
    });

    it("evaluates hold interpolation", () => {
      const hold = getCurveEvaluator("hold");
      expect(hold(0)).toBe(0);
      expect(hold(0.5)).toBe(0);
      expect(hold(0.99)).toBe(0);
      expect(hold(1.0)).toBe(1);
    });
  });

  describe("Custom parameters overrides", () => {
    it("prioritizes customPoints when provided", () => {
      const custom = getCurveEvaluator("linear", [0.42, 0.0, 1.0, 1.0]);
      // Despite passing "linear" as first param, custom Bézier points should take precedence
      expect(custom(0.5)).toBeLessThan(0.5);
    });

    it("prioritizes customSpring when provided", () => {
      const customSpring = getCurveEvaluator("linear", undefined, {
        stiffness: 120,
        damping: 8,
        mass: 1,
      });
      let maxVal = 0;
      for (let p = 0; p <= 1.0; p += 0.05) {
        const val = customSpring(p);
        if (val > maxVal) maxVal = val;
      }
      expect(maxVal).toBeGreaterThan(1.1);
    });
  });
});
