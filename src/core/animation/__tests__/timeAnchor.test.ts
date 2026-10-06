import { describe, it, expect } from "vitest";
import {
  resolveAnchorTime,
  resolveResponsiveKeyframes,
} from "../timeAnchor";
import {
  evaluateProperty,
  evaluateNumericKeyframes,
  evaluateVisualPropertyKeyframes,
} from "../../evaluation/animation";

describe("Responsive Time Anchoring Engine (Build-In / Build-Out Architecture)", () => {
  describe("resolveAnchorTime", () => {
    it("returns unmodified time for start, absolute, or undefined anchor", () => {
      expect(resolveAnchorTime(2.5, "start", 10)).toBe(2.5);
      expect(resolveAnchorTime(2.5, "absolute", 10)).toBe(2.5);
      expect(resolveAnchorTime(2.5, undefined, 10)).toBe(2.5);
    });

    it("projects end anchor backwards from clip duration", () => {
      expect(resolveAnchorTime(1.0, "end", 10)).toBe(9.0);
      expect(resolveAnchorTime(-1.0, "end", 10)).toBe(9.0);
      expect(resolveAnchorTime(0.0, "end", 10)).toBe(10.0);
    });

    it("handles zero or missing clip duration gracefully", () => {
      expect(resolveAnchorTime(1.0, "end", 0)).toBe(1.0);
      expect(resolveAnchorTime(1.0, "end", undefined)).toBe(1.0);
    });
  });

  describe("resolveResponsiveKeyframes", () => {
    it("handles empty or single keyframe arrays", () => {
      expect(resolveResponsiveKeyframes([])).toEqual([]);
      expect(resolveResponsiveKeyframes(undefined)).toEqual([]);

      const single = [{ id: "1", time: 0.5, value: 100 }];
      const resolved = resolveResponsiveKeyframes(single, 10);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].resolvedTime).toBe(0.5);
    });

    it("re-anchors outro keyframes dynamically when clip is retimed or extended", () => {
      const keyframes = [
        { id: "in-0", time: 0.0, anchor: "start" as const, value: 0 },
        { id: "in-1", time: 0.5, anchor: "start" as const, value: 100 },
        { id: "out-1", time: 0.5, anchor: "end" as const, value: 100 },
        { id: "out-0", time: 0.0, anchor: "end" as const, value: 0 },
      ];

      // Clip duration = 10s
      const resolved10s = resolveResponsiveKeyframes(keyframes, 10);
      expect(resolved10s[0].resolvedTime).toBe(0.0);
      expect(resolved10s[1].resolvedTime).toBe(0.5);
      expect(resolved10s[2].resolvedTime).toBe(9.5); // 10 - 0.5
      expect(resolved10s[3].resolvedTime).toBe(10.0); // 10 - 0.0

      // Same keyframes on a trimmed clip (duration = 4s)
      const resolved4s = resolveResponsiveKeyframes(keyframes, 4);
      expect(resolved4s[0].resolvedTime).toBe(0.0);
      expect(resolved4s[1].resolvedTime).toBe(0.5);
      expect(resolved4s[2].resolvedTime).toBe(3.5); // 4 - 0.5
      expect(resolved4s[3].resolvedTime).toBe(4.0); // 4 - 0.0
    });

    it("applies elastic compression when trimmed shorter than intro + outro duration", () => {
      // Intro takes 0.5s, outro takes 0.5s (Total needed = 1.0s)
      const keyframes = [
        { id: "in-0", time: 0.0, anchor: "start" as const, value: 0 },
        { id: "in-1", time: 0.5, anchor: "start" as const, value: 100 },
        { id: "out-1", time: 0.5, anchor: "end" as const, value: 100 },
        { id: "out-0", time: 0.0, anchor: "end" as const, value: 0 },
      ];

      // Clip is trimmed down to 0.6s (shorter than 1.0s)
      // Compression scale = 0.6 / 1.0 = 0.6
      const resolved = resolveResponsiveKeyframes(keyframes, 0.6);

      expect(resolved[0].resolvedTime).toBeCloseTo(0.0, 5);
      expect(resolved[1].resolvedTime).toBeCloseTo(0.3, 5); // 0.5 * 0.6
      expect(resolved[2].resolvedTime).toBeCloseTo(0.3, 5); // 0.6 - (0.5 * 0.6)
      expect(resolved[3].resolvedTime).toBeCloseTo(0.6, 5); // 0.6 - 0

      // Monotonic ordering is strictly preserved
      for (let i = 0; i < resolved.length - 1; i++) {
        expect(resolved[i + 1].resolvedTime).toBeGreaterThanOrEqual(
          resolved[i].resolvedTime
        );
      }
    });

    it("preserves unanchored legacy keyframes with 100% backward compatibility", () => {
      const legacyKeyframes = [
        { id: "1", time: 1.0, value: 10 },
        { id: "2", time: 3.0, value: 50 },
      ];

      const resolved = resolveResponsiveKeyframes(legacyKeyframes, 10);
      expect(resolved[0].resolvedTime).toBe(1.0);
      expect(resolved[1].resolvedTime).toBe(3.0);
    });
  });

  describe("Integration with Property Evaluator", () => {
    it("evaluates elastic sustain hold across dynamic clip duration", () => {
      const property = {
        defaultValue: 0,
        keyframes: [
          { id: "in-0", time: 0.0, anchor: "start" as const, value: 0, easing: "linear" as const },
          { id: "in-1", time: 0.5, anchor: "start" as const, value: 100, easing: "linear" as const },
          { id: "out-1", time: 0.5, anchor: "end" as const, value: 100, easing: "linear" as const },
          { id: "out-0", time: 0.0, anchor: "end" as const, value: 0, easing: "linear" as const },
        ],
      };

      // 1. With 10s clip duration:
      // At t = 0.25 (mid-intro): value ~ 50
      expect(evaluateProperty(property, 0.25, 10)).toBeCloseTo(50, 1);
      // At t = 5.0 (middle sustain): value must remain 100
      expect(evaluateProperty(property, 5.0, 10)).toBe(100);
      // At t = 9.75 (mid-outro): value ~ 50
      expect(evaluateProperty(property, 9.75, 10)).toBeCloseTo(50, 1);

      // 2. With 6s clip duration (clip trimmed):
      // Intro still ends at 0.5s
      expect(evaluateProperty(property, 0.5, 6)).toBe(100);
      // Outro dynamically shifted to start at 5.5s (6 - 0.5)
      // At t = 5.0, it is still sustaining at 100
      expect(evaluateProperty(property, 5.0, 6)).toBe(100);
      // At t = 5.75 (mid-outro for 6s clip): value ~ 50
      expect(evaluateProperty(property, 5.75, 6)).toBeCloseTo(50, 1);
    });

    it("evaluates visual property keyframes with clipDuration option", () => {
      const kfs = [
        { id: "1", time: 0.0, anchor: "start" as const, value: 0, easing: "linear" as const },
        { id: "2", time: 1.0, anchor: "start" as const, value: 100, easing: "linear" as const },
        { id: "3", time: 1.0, anchor: "end" as const, value: 100, easing: "linear" as const },
        { id: "4", time: 0.0, anchor: "end" as const, value: 0, easing: "linear" as const },
      ];

      // On 8s clip:
      // t = 4s is in sustain zone
      expect(evaluateVisualPropertyKeyframes(kfs, 4.0, 0, 8)).toBe(100);
      // t = 7.5s is halfway through outro (8 - 0.5)
      expect(evaluateVisualPropertyKeyframes(kfs, 7.5, 0, 8)).toBeCloseTo(50, 1);
    });
  });
});
